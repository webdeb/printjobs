import { Hono } from 'hono';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { db } from '../db/database.ts';
import { adapterManager } from '../adapters/adapterManager.ts';
import { liveTelemetryCache, broadcastEvent } from '../services/jobTracker.ts';
import { Printer } from '../../src/types/index.ts';
import {
  requireAdminPin,
  validateAccessCode,
  validatePort,
  validatePrinterHost,
} from '../utils/security.ts';

export const printersRouter = new Hono();

// Snapshot cache & concurrency guards to prevent FFmpeg / RTSPS DoS
const SNAPSHOT_TTL_MS = 4500;
const MAX_CONCURRENT_FFMPEG = 3;
let activeFfmpegCount = 0;
const inFlightCaptures = new Map<string, Promise<Buffer | null>>();

function isPortOpen(host: string, port: number, timeout = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

// List all configured printers with real-time telemetry
printersRouter.get('/', (c) => {
  const rows = db.prepare('SELECT * FROM printers ORDER BY created_at ASC').all() as any[];

  const printers: Printer[] = rows.map((row) => {
    let telemetry = undefined;
    if (liveTelemetryCache.has(row.id)) {
      telemetry = liveTelemetryCache.get(row.id);
    } else if (row.telemetry_json) {
      try {
        telemetry = JSON.parse(row.telemetry_json);
      } catch {}
    }

    return {
      id: row.id,
      name: row.name,
      model: row.model,
      make: row.make,
      adapter_type: row.adapter_type,
      host: row.host,
      port: row.port,
      access_code: row.access_code,
      status: (telemetry?.progress_percent && telemetry.progress_percent > 0) ? 'printing' : (row.status || 'idle'),
      telemetry,
      last_seen_at: row.last_seen_at,
      created_at: row.created_at,
    };
  });

  return c.json(printers);
});

// Get automatically discovered printers on the network
printersRouter.get('/discovered', async (c) => {
  const discovered = await adapterManager.discoverAll();

  const existingIds = new Set(
    (db.prepare('SELECT id FROM printers').all() as any[]).map((p) => p.id)
  );

  const enriched = discovered.map((p) => ({
    ...p,
    already_added: existingIds.has(p.id),
  }));

  return c.json(enriched);
});

// Add or update a printer (protected by ADMIN_PIN if configured)
printersRouter.post('/', requireAdminPin, async (c) => {
  const body = await c.req.json();
  const { id, name, model, make, adapter_type, host, port, access_code } = body;

  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(id.trim())) {
    return c.json({ error: 'Ungültige Drucker-ID.' }, 400);
  }
  if (!name || typeof name !== 'string' || name.trim().length > 80) {
    return c.json({ error: 'Ungültiger Druckername.' }, 400);
  }

  const hostCheck = validatePrinterHost(host);
  if (!hostCheck.valid) {
    return c.json({ error: hostCheck.reason || 'Ungültiger Host.' }, 400);
  }

  const defaultPort = adapter_type === 'bambulab' ? 8883 : adapter_type === 'snapmaker' || adapter_type === 'klipper' ? 7125 : 80;
  const validPort = validatePort(port, defaultPort);
  if (validPort === null) {
    return c.json({ error: 'Ungültiger Port (1–65535).' }, 400);
  }

  const codeCheck = validateAccessCode(access_code);
  if (!codeCheck.valid) {
    return c.json({ error: codeCheck.reason || 'Ungültiger Access Code.' }, 400);
  }

  const allowedAdapters = new Set(['bambulab', 'snapmaker', 'prusalink', 'klipper', 'generic']);
  const safeAdapter = allowedAdapters.has(adapter_type) ? adapter_type : 'bambulab';
  const cleanId = id.trim();
  const cleanName = name.trim();
  const cleanModel = typeof model === 'string' && model.trim() ? model.trim().slice(0, 64) : '3D Printer';
  const cleanMake = typeof make === 'string' && make.trim() ? make.trim().slice(0, 64) : (safeAdapter === 'bambulab' ? 'Bambu Lab' : 'Generic');

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO printers (id, name, model, make, adapter_type, host, port, access_code, status, last_seen_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      model = excluded.model,
      make = excluded.make,
      adapter_type = excluded.adapter_type,
      host = excluded.host,
      port = excluded.port,
      access_code = excluded.access_code
  `);

  insert.run(
    cleanId,
    cleanName,
    cleanModel,
    cleanMake,
    safeAdapter,
    hostCheck.host,
    validPort,
    codeCheck.code,
    now,
    now
  );

  const newPrinter: Printer = {
    id: cleanId,
    name: cleanName,
    model: cleanModel,
    make: cleanMake,
    adapter_type: safeAdapter,
    host: hostCheck.host,
    port: validPort,
    access_code: codeCheck.code,
    status: 'idle',
    last_seen_at: now,
    created_at: now,
  };

  // Reconnect if already connected, or connect new
  try {
    await adapterManager.disconnectPrinter(cleanId, safeAdapter).catch(() => {});
    await adapterManager.connectPrinter(newPrinter);
  } catch (err: any) {
    console.warn(`[PrintersRouter] Could not connect to ${newPrinter.name}:`, err.message);
  }

  broadcastEvent('printer_added', newPrinter);
  return c.json(newPrinter, 201);
});

// Delete a printer while preserving historical print jobs & Materialkasse records
printersRouter.delete('/:id', requireAdminPin, async (c) => {
  const id = c.req.param('id') || '';
  const printer = db.prepare('SELECT * FROM printers WHERE id = ?').get(id) as any;

  if (!printer) {
    return c.json({ error: 'Printer not found' }, 404);
  }

  // Snapshot printer name/model into job metadata before deleting printer record
  try {
    const jobs = db.prepare('SELECT id, metadata_json FROM print_jobs WHERE printer_id = ?').all(id) as any[];
    const updateMeta = db.prepare('UPDATE print_jobs SET metadata_json = ? WHERE id = ?');
    for (const j of jobs) {
      let meta: Record<string, any> = {};
      try {
        if (j.metadata_json) meta = JSON.parse(j.metadata_json);
      } catch {}
      meta.printerName = meta.printerName || printer.name;
      meta.printerModel = meta.printerModel || printer.model;
      updateMeta.run(JSON.stringify(meta), j.id);
    }
  } catch (err: any) {
    console.warn(`[PrintersRouter] Could not snapshot printer name onto jobs:`, err.message);
  }

  await adapterManager.disconnectPrinter(id, printer.adapter_type);
  db.prepare('DELETE FROM printers WHERE id = ?').run(id);

  broadcastEvent('printer_deleted', { id });
  return c.json({ success: true, id });
});

// Request live camera snapshot from printer (hardened against RCE, SSRF, and FFmpeg DoS)
printersRouter.get('/:id/camera', async (c) => {
  const id = c.req.param('id');
  const printer = db.prepare('SELECT * FROM printers WHERE id = ?').get(id) as any;
  if (!printer) return c.json({ error: 'Printer not found' }, 404);

  // Defense-in-depth: validate host, port, and access_code from DB before network/process calls
  const hostCheck = validatePrinterHost(printer.host);
  const codeCheck = validateAccessCode(printer.access_code);
  if (!hostCheck.valid || !codeCheck.valid) {
    return c.json({ available: false, reason: 'Ungültige Drucker-Netzwerkkonfiguration.' }, 400);
  }

  const cacheDir = process.env.CACHE_DIR || path.resolve(process.cwd(), 'camera_cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return c.json({ error: 'Invalid printer ID' }, 400);
  const snapshotFile = path.join(cacheDir, `cam_${safeId}.jpg`);

  // Serve fresh cached snapshot if younger than TTL (prevents RTSPS/FFmpeg flooding)
  try {
    if (fs.existsSync(snapshotFile)) {
      const stat = fs.statSync(snapshotFile);
      if (Date.now() - stat.mtimeMs < SNAPSHOT_TTL_MS && stat.size > 0) {
        const imgBuffer = fs.readFileSync(snapshotFile);
        return new Response(new Uint8Array(imgBuffer), {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'private, max-age=4',
          },
        });
      }
    }
  } catch {}

  // 1. Bambu Lab RTSPS on port 322 (X1-Carbon / X1E)
  if (printer.adapter_type === 'bambulab' && codeCheck.code) {
    // Coalesce concurrent requests for the same printer onto a single FFmpeg run
    let capturePromise = inFlightCaptures.get(safeId);
    if (!capturePromise) {
      capturePromise = (async (): Promise<Buffer | null> => {
        const port322Open = await isPortOpen(hostCheck.host, 322, 1000);
        if (!port322Open) return null;

        if (activeFfmpegCount >= MAX_CONCURRENT_FFMPEG) {
          throw new Error('Too many concurrent camera streams active');
        }

        const rtspUrl = `rtsps://bblp:${encodeURIComponent(codeCheck.code)}@${hostCheck.host}:322/streaming/live/1`;
        const ffmpegBin = process.env.FFMPEG_PATH || (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');
        const tempFile = path.join(cacheDir, `cam_${safeId}_${crypto.randomUUID()}.tmp.jpg`);

        activeFfmpegCount++;
        try {
          await new Promise<void>((resolve, reject) => {
            // execFile invokes the binary directly WITHOUT /bin/sh — immune to shell injection
            execFile(
              ffmpegBin,
              [
                '-y',
                '-rtsp_transport', 'tcp',
                '-t', '3.5',
                '-i', rtspUrl,
                '-frames:v', '1',
                '-q:v', '3',
                tempFile,
              ],
              {
                env: {
                  PATH: process.env.PATH || '/usr/bin:/bin',
                  http_proxy: '',
                  https_proxy: '',
                  all_proxy: '',
                  HTTP_PROXY: '',
                  HTTPS_PROXY: '',
                  ALL_PROXY: '',
                },
                timeout: 4500,
              },
              (err) => (err ? reject(err) : resolve())
            );
          });

          if (fs.existsSync(tempFile)) {
            fs.renameSync(tempFile, snapshotFile);
            return fs.readFileSync(snapshotFile);
          }
          return null;
        } finally {
          activeFfmpegCount = Math.max(0, activeFfmpegCount - 1);
          try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          } catch {}
        }
      })();

      inFlightCaptures.set(safeId, capturePromise);
    }

    try {
      const imgBuffer = await capturePromise;
      if (imgBuffer) {
        return new Response(new Uint8Array(imgBuffer), {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'private, max-age=4',
          },
        });
      }
    } catch (err: any) {
      console.warn(`[Camera] FFmpeg capture failed for ${printer.name}:`, err.message);
    } finally {
      inFlightCaptures.delete(safeId);
    }

    return c.json({
      available: false,
      model: printer.model,
      reason: `Kein direkter RTSPS-Stream auf Port 322 verfügbar (${printer.model}-Serie nutzt ggf. Bambu P2P-Stream auf Port 6000).`,
    }, 404);
  }

  // 2. Snapmaker / Klipper / Moonraker snapshot
  if (printer.adapter_type === 'snapmaker' || printer.adapter_type === 'klipper') {
    const validPort = validatePort(printer.port, 7125) || 7125;
    const endpoints = [
      `http://${hostCheck.host}:${validPort}/webcam/?action=snapshot`,
      `http://${hostCheck.host}:8080/?action=snapshot`,
      `http://${hostCheck.host}/webcam/?action=snapshot`,
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, { redirect: 'error', signal: AbortSignal.timeout(1500) });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.startsWith('image/')) {
          const buf = Buffer.from(await res.arrayBuffer());
          // Reject unexpectedly large payloads (> 5 MB)
          if (buf.byteLength > 0 && buf.byteLength <= 5 * 1024 * 1024) {
            try {
              fs.writeFileSync(snapshotFile, buf);
            } catch {}
            return new Response(new Uint8Array(buf), {
              headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'private, max-age=4',
              },
            });
          }
        }
      } catch {}
    }
    return c.json({
      available: false,
      model: printer.model,
      reason: 'Keine Webcam an Klipper/Moonraker erkannt.',
    }, 404);
  }

  return c.json({ available: false, reason: 'Keine Kamera für diesen Drucker konfiguriert.' }, 404);
});
