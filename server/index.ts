import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initDatabase, db } from './db/database.ts';
import { adapterManager } from './adapters/adapterManager.ts';
import { jobTracker } from './services/jobTracker.ts';
import { printersRouter } from './routes/printers.ts';
import { jobsRouter } from './routes/jobs.ts';
import { usersRouter } from './routes/users.ts';
import { maintenanceRouter } from './routes/maintenance.ts';
import { statsRouter } from './routes/stats.ts';
import { eventsRouter } from './routes/events.ts';
import { Printer } from '../src/types/index.ts';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

import { settingsRouter } from './routes/settings.ts';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';

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
