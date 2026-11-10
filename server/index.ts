import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase, db } from './db/database.ts';
import { adapterManager } from './adapters/adapterManager.ts';
import { jobTracker } from './services/jobTracker.ts';
import { printersRouter } from './routes/printers.ts';
import { jobsRouter } from './routes/jobs.ts';
import { usersRouter } from './routes/users.ts';
import { maintenanceRouter } from './routes/maintenance.ts';
import { statsRouter } from './routes/stats.ts';
import { eventsRouter } from './routes/events.ts';
import { settingsRouter } from './routes/settings.ts';
import { Printer } from '../src/types/index.ts';
import {
  isAdminPinConfigured,
  lanBrowserGuard,
  verifyAdminPin,
} from './utils/security.ts';

const app = new Hono();
const isDev = process.env.NODE_ENV !== 'production';

app.use('*', logger());

// Security response headers (clickjacking, MIME-sniffing, referrer & CSP hardening)
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');

  let meteOrigin = '';
  if (process.env.METE_URL) {
    try {
      meteOrigin = new URL(process.env.METE_URL).origin;
    } catch {}
  }
  const imgSources = ["'self'", 'data:', 'blob:', meteOrigin].filter(Boolean).join(' ');
  c.header(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src ${imgSources}; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'`
  );
});

// Restrict CORS strictly (no wildcard '*') to prevent LAN drive-by data exfiltration
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      if (!origin) return undefined;
      try {
        const originUrl = new URL(origin);
        const host = c.req.header('host');
        if (host && originUrl.host === host) {
          return origin;
        }
        if (isDev && (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1')) {
          return origin;
        }
      } catch {}
      return undefined;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Admin-Pin'],
  })
);

// Protect API against cross-site browser requests & oversized payloads (max 128 KB)
app.use('/api/*', lanBrowserGuard);
app.use(
  '/api/*',
  bodyLimit({
    maxSize: 128 * 1024,
    onError: (c) => c.json({ error: 'Request payload too large (max 128 KB)' }, 413),
  })
);

// Auth status & PIN verification endpoints
app.get('/api/auth/status', (c) => {
  return c.json({ adminPinRequired: isAdminPinConfigured() });
});

app.post('/api/auth/verify', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const valid = verifyAdminPin(body?.pin);
  if (!valid) {
    return c.json({ valid: false, error: 'Ungültiger Admin-PIN' }, 401);
  }
  return c.json({ valid: true });
});

// Mount API routes
app.route('/api/printers', printersRouter);
app.route('/api/jobs', jobsRouter);
app.route('/api/users', usersRouter);
app.route('/api/maintenance', maintenanceRouter);
app.route('/api/stats', statsRouter);
app.route('/api/settings', settingsRouter);
app.route('/api/events', eventsRouter);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// Serve frontend build in production if dist/ exists
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  console.log(`[PrintJobs] Serving frontend static assets from ${distDir}`);
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api')) {
      return c.json({ error: 'Endpoint not found' }, 404);
    }
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return c.html(fs.readFileSync(indexPath, 'utf-8'));
    }
    return c.text('Not found', 404);
  });
}

const PORT = Number(process.env.PORT) || 3001;

async function bootstrap() {
  console.log('[PrintJobs] Initializing SQLite database...');
  initDatabase();

  if (isAdminPinConfigured()) {
    console.log('[PrintJobs] Admin-PIN protection is ENABLED for administrative actions.');
  } else {
    console.log('[PrintJobs] Admin-PIN protection disabled (set ADMIN_PIN env var to protect admin actions).');
  }

  console.log('[PrintJobs] Starting Adapter Manager & Discovery...');
  await adapterManager.startAll();

  console.log('[PrintJobs] Starting Job Tracker...');
  jobTracker.start();

  const meteUrl = process.env.METE_URL;
  if (meteUrl) {
    const meteInterval = Number(process.env.METE_SYNC_INTERVAL_MINS) || 15;
    console.log(`[PrintJobs] Starting MeTe Member Sync (${meteUrl}, every ${meteInterval}m)...`);
    const { startMeteAutoSync } = await import('./services/meteSync.ts');
    startMeteAutoSync(meteInterval);
  } else {
    console.log('[PrintJobs] MeTe Member Sync disabled (set METE_URL to enable).');
  }

  // Connect existing printers
  const existingPrinters = db.prepare('SELECT * FROM printers').all() as any[];
  for (const row of existingPrinters) {
    const printer: Printer = {
      id: row.id,
      name: row.name,
      model: row.model,
      make: row.make,
      adapter_type: row.adapter_type,
      host: row.host,
      port: row.port,
      access_code: row.access_code,
      status: row.status || 'idle',
      last_seen_at: row.last_seen_at,
      created_at: row.created_at,
    };
    try {
      await adapterManager.connectPrinter(printer);
    } catch (err: any) {
      console.warn(`[PrintJobs] Could not auto-connect to printer ${printer.name}:`, err.message);
    }
  }

  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
  }, (info) => {
    console.log(`[PrintJobs API] Server running on http://0.0.0.0:${info.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[PrintJobs API] Fatal startup error:', err);
  process.exit(1);
});
