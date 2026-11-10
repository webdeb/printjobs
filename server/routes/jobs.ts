import { Hono } from 'hono';
import { db } from '../db/database.ts';
import { broadcastEvent } from '../services/jobTracker.ts';
import { calculateCostCents } from '../services/pricing.ts';
import { PrintJob } from '../../src/types/index.ts';
import { maskEmail, requireAdminPin } from '../utils/security.ts';

export const jobsRouter = new Hono();

// List jobs with query filters
jobsRouter.get('/', (c) => {
  const printerId = c.req.query('printer_id');
  const userId = c.req.query('user_id');
  const status = c.req.query('status');
  const search = c.req.query('search');

  let query = `
    SELECT 
      j.*,
      p.name as printer_name,
      p.model as printer_model,
      u.name as assigned_user_name,
      u.email as assigned_user_email
    FROM print_jobs j
    LEFT JOIN printers p ON j.printer_id = p.id
    LEFT JOIN users u ON j.assigned_user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (printerId) {
    query += ' AND j.printer_id = ?';
    params.push(printerId);
  }
  if (userId) {
    if (userId === 'unassigned') {
      query += ' AND j.assigned_user_id IS NULL';
    } else {
      query += ' AND j.assigned_user_id = ?';
      params.push(Number(userId));
    }
  }
  if (status && status !== 'all') {
    query += ' AND j.status = ?';
    params.push(status);
  }
  if (search) {
    query += ' AND (j.job_name LIKE ? OR p.name LIKE ? OR u.name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ` ORDER BY 
    CASE WHEN j.status = 'running' THEN 0 ELSE 1 END,
    j.start_time DESC,
    j.id DESC 
  LIMIT 200`;

  const rows = db.prepare(query).all(...params) as any[];

  const jobs: PrintJob[] = rows.map((r) => {
    let fallbackPrinterName = r.printer_name;
    let fallbackPrinterModel = r.printer_model;
    if ((!fallbackPrinterName || !fallbackPrinterModel) && r.metadata_json) {
      try {
        const meta = JSON.parse(r.metadata_json);
        fallbackPrinterName = fallbackPrinterName || meta.printerName;
        fallbackPrinterModel = fallbackPrinterModel || meta.printerModel;
      } catch {}
    }

    return {
      id: r.id,
      printer_id: r.printer_id,
      printer_name: fallbackPrinterName,
      printer_model: fallbackPrinterModel,
      job_name: r.job_name,
      status: r.status,
      start_time: r.start_time,
      end_time: r.end_time,
      duration_seconds: r.duration_seconds,
      material_type: r.material_type,
      material_color_hex: r.material_color_hex,
      material_used_grams: r.material_used_grams,
      assigned_user_id: r.assigned_user_id,
      assigned_user_name: r.assigned_user_name,
      assigned_user_email: maskEmail(r.assigned_user_email),
      assigned_at: r.assigned_at,
      cost_cents: r.cost_cents,
      is_paid: Boolean(r.is_paid),
      metadata: r.metadata_json,
    };
  });

  return c.json(jobs);
});

// Assign print job to a user (or unassign if userId is null)
jobsRouter.post('/:id/assign', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const userId = body.userId === null ? null : Number(body.userId);

  const job = db.prepare('SELECT id FROM print_jobs WHERE id = ?').get(id);
  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  let userName = null;
  if (userId !== null) {
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    userName = user.name;
  }

  const assignedAt = userId ? new Date().toISOString() : null;

  db.prepare(`
    UPDATE print_jobs
    SET assigned_user_id = ?, assigned_at = ?
    WHERE id = ?
  `).run(userId, assignedAt, id);

  broadcastEvent('job_assigned', {
    jobId: id,
    assignedUserId: userId,
    assignedUserName: userName,
  });

  return c.json({ success: true, jobId: id, userId, userName });
});

// Toggle or update paid status (protected by ADMIN_PIN if configured)
jobsRouter.post('/:id/pay', requireAdminPin, async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  
  const current = db.prepare('SELECT is_paid FROM print_jobs WHERE id = ?').get(id) as any;
  if (!current) {
    return c.json({ error: 'Job not found' }, 404);
  }

  const isPaid = body.is_paid !== undefined ? (body.is_paid ? 1 : 0) : (current.is_paid ? 0 : 1);
  db.prepare('UPDATE print_jobs SET is_paid = ? WHERE id = ?').run(isPaid, id);

  broadcastEvent('job_paid_updated', { jobId: id, is_paid: Boolean(isPaid) });
  return c.json({ success: true, jobId: id, is_paid: Boolean(isPaid) });
});

// Manually add a print job
jobsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const {
    printer_id,
    job_name,
    material_type = 'PLA',
    material_color_hex = '#10B981',
    material_used_grams = 50,
    duration_seconds = 3600,
    assigned_user_id = null,
  } = body;

  if (!printer_id || !job_name) {
    return c.json({ error: 'printer_id and job_name are required' }, 400);
  }

  const costCents = calculateCostCents(material_type, Number(material_used_grams));

  const now = new Date();
  const startTime = new Date(now.getTime() - Number(duration_seconds) * 1000).toISOString();
  const endTime = now.toISOString();

  const insert = db.prepare(`
    INSERT INTO print_jobs (
      printer_id, job_name, status, start_time, end_time, duration_seconds,
      material_type, material_color_hex, material_used_grams, assigned_user_id,
      assigned_at, cost_cents, is_paid
    ) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const result = insert.run(
    printer_id,
    job_name,
    startTime,
    endTime,
    Number(duration_seconds),
    material_type,
    material_color_hex,
    Number(material_used_grams),
    assigned_user_id ? Number(assigned_user_id) : null,
    assigned_user_id ? new Date().toISOString() : null,
    costCents
  );

  broadcastEvent('job_created', { jobId: result.lastInsertRowid });
  return c.json({ success: true, id: result.lastInsertRowid }, 201);
});

// Delete a print job (protected by ADMIN_PIN if configured)
jobsRouter.delete('/:id', requireAdminPin, (c) => {
  const id = Number(c.req.param('id'));
  db.prepare('DELETE FROM print_jobs WHERE id = ?').run(id);
  broadcastEvent('job_deleted', { jobId: id });
  return c.json({ success: true, id });
});

// Update a print job's material, weight, or cost (protected by ADMIN_PIN if configured)
jobsRouter.patch('/:id', requireAdminPin, async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const job = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(id) as any;
  if (!job) return c.json({ error: 'Job not found' }, 404);

  let meta: Record<string, any> = {};
  try {
    if (job.metadata_json) meta = JSON.parse(job.metadata_json);
  } catch {}

  if (body.total_grams !== undefined && !isNaN(Number(body.total_grams)) && Number(body.total_grams) >= 0) {
    meta.totalGrams = Math.min(50000, Number(body.total_grams));
  }

  const materialType = typeof body.material_type === 'string' && body.material_type.trim()
    ? body.material_type.trim().slice(0, 40)
    : (job.material_type || 'PLA');

  let materialGrams = body.material_used_grams !== undefined
    ? Math.max(0, Math.min(50000, Number(body.material_used_grams) || 0))
    : job.material_used_grams;

  // If user changed total_grams and didn't lock a fixed manual used_grams, update used_grams according to current progress
  if (body.total_grams !== undefined && body.material_used_grams === undefined && job.status === 'running') {
    const pct = Number(meta.progressPercent) || 0;
    materialGrams = pct <= 0 ? 0 : Math.round((meta.totalGrams * (pct / 100)) * 10) / 10;
  }

  const costCents = body.cost_cents !== undefined
    ? Math.max(0, Math.min(1000000, Math.round(Number(body.cost_cents) || 0)))
    : calculateCostCents(materialType, materialGrams);

  if (body.material_used_grams !== undefined || body.cost_cents !== undefined) {
    meta.manualOverride = true;
  }

  db.prepare(`
    UPDATE print_jobs
    SET material_type = ?, material_used_grams = ?, cost_cents = ?, metadata_json = ?
    WHERE id = ?
  `).run(materialType, materialGrams, costCents, JSON.stringify(meta), id);

  broadcastEvent('job_updated', {
    jobId: id,
    materialType,
    materialUsedGrams: materialGrams,
    costCents,
    metadata: meta,
  });

  return c.json({
    success: true,
    id,
    material_type: materialType,
    material_used_grams: materialGrams,
    cost_cents: costCents,
    total_grams: meta.totalGrams,
  });
});
