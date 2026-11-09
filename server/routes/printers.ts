import { Hono } from 'hono';
import { db } from '../db/database.ts';
import { adapterManager } from '../adapters/adapterManager.ts';
import { liveTelemetryCache, broadcastEvent } from '../services/jobTracker.ts';
import { Printer } from '../../src/types/index.ts';

export const printersRouter = new Hono();

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

  // Check which are already added
  const existingIds = new Set(
    (db.prepare('SELECT id FROM printers').all() as any[]).map((p) => p.id)
  );

  const enriched = discovered.map((p) => ({
    ...p,
    already_added: existingIds.has(p.id),
  }));

  return c.json(enriched);
});

// Add a new printer
printersRouter.post('/', async (c) => {
  const body = await c.req.json();
  const { id, name, model, make, adapter_type, host, port, access_code } = body;

  if (!id || !name || !host) {
    return c.json({ error: 'Missing required fields (id, name, host)' }, 400);
  }

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
    id,
    name,
    model || '3D Printer',
    make || (adapter_type === 'bambulab' ? 'Bambu Lab' : 'Generic'),
    adapter_type || 'bambulab',
    host,
    Number(port) || (adapter_type === 'bambulab' ? 8883 : 80),
    access_code || '',
    now,
    now
  );

  const newPrinter: Printer = {
    id,
    name,
    model: model || '3D Printer',
    make: make || 'Generic',
    adapter_type: adapter_type || 'bambulab',
    host,
    port: Number(port) || 8883,
    access_code,
    status: 'idle',
    last_seen_at: now,
    created_at: now,
  };

  // Attempt to connect immediately
  try {
    await adapterManager.connectPrinter(newPrinter);
  } catch (err: any) {
    console.warn(`[PrintersRouter] Could not connect to ${newPrinter.name}:`, err.message);
  }

  broadcastEvent('printer_added', newPrinter);
  return c.json(newPrinter, 201);
});

// Delete a printer
printersRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const printer = db.prepare('SELECT * FROM printers WHERE id = ?').get(id) as any;

  if (!printer) {
    return c.json({ error: 'Printer not found' }, 404);
  }

  await adapterManager.disconnectPrinter(id, printer.adapter_type);
  db.prepare('DELETE FROM printers WHERE id = ?').run(id);

  broadcastEvent('printer_deleted', { id });
  return c.json({ success: true, id });
});

// Request live camera snapshot from printer
printersRouter.get('/:id/camera', async (c) => {
  const id = c.req.param('id');
  const printer = db.prepare('SELECT * FROM printers WHERE id = ?').get(id) as any;
  if (!printer) return c.json({ error: 'Printer not found' }, 404);

  const { exec } = await import('child_process');
  const fs = await import('fs');
  const path = await import('path');
  const net = await import('net');

  const cacheDir = process.env.CACHE_DIR || path.resolve(process.cwd(), 'camera_cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  const snapshotFile = path.join(cacheDir, `cam_${safeId}.jpg`);

  // Quick check if a port is open
  const isPortOpen = (host: string, port: number, timeout = 1000): Promise<boolean> => {
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
  };

  // 1. Bambu Lab RTSPS on port 322 (X1-Carbon / X1E)
  if (printer.adapter_type === 'bambulab' && printer.access_code) {
    const port322Open = await isPortOpen(printer.host, 322, 1000);

    if (port322Open) {
      console.log(`[Camera] Capturing RTSPS snapshot for ${printer.name} (${printer.host}:322)...`);
      const rtspUrl = `rtsps://bblp:${printer.access_code}@${printer.host}:322/streaming/live/1`;
      const ffmpegBin = process.env.FFMPEG_PATH || (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');

      try {
        await new Promise<void>((resolve, reject) => {
          exec(
            `"${ffmpegBin}" -y -rtsp_transport tcp -t 3.5 -i "${rtspUrl}" -vframes 1 -q:v 3 "${snapshotFile}"`,
            {
              env: {
                ...process.env,
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

        if (fs.existsSync(snapshotFile)) {
          const imgBuffer = fs.readFileSync(snapshotFile);
          return new Response(imgBuffer, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
      } catch (err: any) {
        console.warn(`[Camera] FFmpeg capture failed for ${printer.name}:`, err.message);
      }
    }

    // If port 322 is closed (P1P, P1S, A1 Mini, A2L)
    const port6000Open = await isPortOpen(printer.host, 6000, 800);
    return c.json({
      available: false,
      model: printer.model,
      port6000_open: port6000Open,
      reason: port322Open 
        ? 'RTSP-Stream konnte temporär nicht dekodiert werden.'
        : `Die Bambu ${printer.model}-Serie nutzt einen ESP32-Chip mit ThroughTek (TUTK) P2P-Protokoll auf Port 6000 anstelle eines Standard-RTSP-Streams (Port 322 der X1-Serie). Live-Video kann direkt in Bambu Studio / Handy über den Access Code betrachtet werden.`,
    }, 404);
  }

  // 2. Snapmaker / Klipper / Moonraker snapshot
  if (printer.adapter_type === 'snapmaker') {
    const endpoints = [
      `http://${printer.host}:${printer.port}/webcam/?action=snapshot`,
      `http://${printer.host}:8080/?action=snapshot`,
      `http://${printer.host}/webcam/?action=snapshot`,
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, { signal: AbortSignal.timeout(1500) });
        if (res.ok && res.headers.get('content-type')?.includes('image')) {
          const buf = await res.arrayBuffer();
          return new Response(buf, { headers: { 'Content-Type': 'image/jpeg' } });
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
