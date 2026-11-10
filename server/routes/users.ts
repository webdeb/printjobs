import { Hono } from 'hono';
import { db } from '../db/database.ts';
import { broadcastEvent } from '../services/jobTracker.ts';
import { User } from '../../src/types/index.ts';
import { maskEmail, requireAdminPin } from '../utils/security.ts';

export const usersRouter = new Hono();

// List all users with aggregated print & Materialkasse stats (PII emails masked)
usersRouter.get('/', (c) => {
  const users = db.prepare(`
    SELECT 
      u.*,
      COUNT(j.id) as total_jobs,
      COALESCE(SUM(j.material_used_grams), 0) as total_grams,
      COALESCE(SUM(CASE WHEN j.is_paid = 0 THEN j.cost_cents ELSE 0 END), 0) as unpaid_cents
    FROM users u
    LEFT JOIN print_jobs j ON u.id = j.assigned_user_id
    GROUP BY u.id
    ORDER BY u.name ASC
  `).all() as any[];

  const result: User[] = users.map((u) => ({
    id: u.id,
    external_id: u.external_id,
    avatar_url: u.avatar_url,
    name: u.name,
    email: maskEmail(u.email),
    member_number: u.member_number,
    total_jobs: u.total_jobs,
    total_grams: Math.round(u.total_grams * 10) / 10,
    unpaid_cents: u.unpaid_cents,
    is_active: Boolean(u.is_active),
    created_at: u.created_at,
  }));

  return c.json(result);
});

// Trigger synchronization with MeTe
usersRouter.post('/sync-mete', async (c) => {
  try {
    const { syncMeteUsers } = await import('../services/meteSync.ts');
    const result = await syncMeteUsers();
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: 'Failed to sync with MeTe' }, 500);
  }
});

// Create user
usersRouter.post('/', async (c) => {
  const body = await c.req.json();
  const rawName = typeof body.name === 'string' ? body.name.trim() : '';
  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const rawMemberNum = typeof body.member_number === 'string' ? body.member_number.trim().slice(0, 40) : null;

  if (!rawName || rawName.length > 100 || !rawEmail || rawEmail.length > 160 || !rawEmail.includes('@')) {
    return c.json({ error: 'Gültiger Name und E-Mail sind erforderlich.' }, 400);
  }

  const now = new Date().toISOString();
  try {
    const insert = db.prepare(`
      INSERT INTO users (name, email, member_number, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const res = insert.run(rawName, rawEmail, rawMemberNum || null, now);
    const user: User = {
      id: Number(res.lastInsertRowid),
      name: rawName,
      email: maskEmail(rawEmail),
      member_number: rawMemberNum || undefined,
      total_jobs: 0,
      total_grams: 0,
      unpaid_cents: 0,
      is_active: true,
      created_at: now,
    };

    broadcastEvent('user_created', user);
    return c.json(user, 201);
  } catch {
    return c.json({ error: 'Mitglied konnte nicht angelegt werden (E-Mail evtl. bereits vergeben).' }, 400);
  }
});

// Settle all unpaid jobs for this user (protected by ADMIN_PIN if configured)
usersRouter.post('/:id/settle', requireAdminPin, (c) => {
  const userId = Number(c.req.param('id'));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const result = db.prepare(`
    UPDATE print_jobs
    SET is_paid = 1
    WHERE assigned_user_id = ? AND is_paid = 0
  `).run(userId);

  broadcastEvent('user_settled', { userId, settledJobs: result.changes });
  return c.json({ success: true, userId, settledJobs: result.changes });
});

// Bulk sync endpoint for external member databases (protected by ADMIN_PIN if configured)
usersRouter.post('/sync', requireAdminPin, async (c) => {
  const body = await c.req.json();
  const members = Array.isArray(body) ? body : body.members;

  if (!Array.isArray(members) || members.length > 5000) {
    return c.json({ error: 'Expected array of members (max 5000)' }, 400);
  }

  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;

  for (const m of members) {
    if (!m || typeof m.email !== 'string' || typeof m.name !== 'string') continue;
    const cleanEmail = m.email.trim().toLowerCase().slice(0, 160);
    const cleanName = m.name.trim().slice(0, 100);
    const cleanMemberNum = typeof m.member_number === 'string' ? m.member_number.trim().slice(0, 40) : null;
    if (!cleanEmail || !cleanName) continue;

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail) as any;
    if (existing) {
      db.prepare('UPDATE users SET name = ?, member_number = ? WHERE id = ?')
        .run(cleanName, cleanMemberNum, existing.id);
      updated++;
    } else {
      db.prepare('INSERT INTO users (name, email, member_number, created_at) VALUES (?, ?, ?, ?)')
        .run(cleanName, cleanEmail, cleanMemberNum, now);
      added++;
    }
  }

  return c.json({ success: true, added, updated });
});
