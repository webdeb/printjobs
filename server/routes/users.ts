import { Hono } from 'hono';
import { db } from '../db/database.ts';
import { broadcastEvent } from '../services/jobTracker.ts';
import { User } from '../../src/types/index.ts';

export const usersRouter = new Hono();

// List all users with aggregated print & Materialkasse stats
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
    email: u.email,
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
    return c.json({ error: 'Failed to sync with MeTe', details: err.message }, 500);
  }
});

// Create user
usersRouter.post('/', async (c) => {
  const body = await c.req.json();
  const { name, email, member_number } = body;

  if (!name || !email) {
    return c.json({ error: 'Name and email are required' }, 400);
  }

  const now = new Date().toISOString();
  try {
    const insert = db.prepare(`
      INSERT INTO users (name, email, member_number, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const res = insert.run(name, email, member_number || null, now);
    const user: User = {
      id: Number(res.lastInsertRowid),
      name,
      email,
      member_number,
      total_jobs: 0,
      total_grams: 0,
      unpaid_cents: 0,
      is_active: true,
      created_at: now,
    };

    broadcastEvent('user_created', user);
    return c.json(user, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Settle all unpaid jobs for this user (e.g., when they put money in the Materialkasse)
usersRouter.post('/:id/settle', (c) => {
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

// Bulk sync endpoint for external member databases
usersRouter.post('/sync', async (c) => {
  const body = await c.req.json();
  const members = Array.isArray(body) ? body : body.members;

  if (!Array.isArray(members)) {
    return c.json({ error: 'Expected array of members' }, 400);
  }

  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;

  for (const m of members) {
    if (!m.email || !m.name) continue;
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(m.email) as any;
    if (existing) {
      db.prepare('UPDATE users SET name = ?, member_number = ? WHERE id = ?')
        .run(m.name, m.member_number || null, existing.id);
      updated++;
    } else {
      db.prepare('INSERT INTO users (name, email, member_number, created_at) VALUES (?, ?, ?, ?)')
        .run(m.name, m.email, m.member_number || null, now);
      added++;
    }
  }

  return c.json({ success: true, added, updated });
});
