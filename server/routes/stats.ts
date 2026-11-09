import { Hono } from 'hono';
import { db } from '../db/database.ts';
import { MakerspaceStats } from '../../src/types/index.ts';

export const statsRouter = new Hono();

statsRouter.get('/', (c) => {
  // Aggregate stats
  const totals = db.prepare(`
    SELECT 
      COUNT(id) as total_jobs,
      COALESCE(SUM(material_used_grams), 0) as total_grams,
      COALESCE(SUM(duration_seconds), 0) as total_seconds,
      COALESCE(SUM(CASE WHEN is_paid = 0 THEN cost_cents ELSE 0 END), 0) as unpaid_cents
    FROM print_jobs
  `).get() as any;

  const activePrinters = db.prepare(`
    SELECT COUNT(id) as count FROM printers WHERE status != 'offline'
  `).get() as any;

  // Material breakdown (PLA, PETG, etc.)
  const materialsRows = db.prepare(`
    SELECT 
      material_type,
      SUM(material_used_grams) as grams
    FROM print_jobs
    GROUP BY material_type
    ORDER BY grams DESC
  `).all() as any[];

  const totalGrams = totals.total_grams || 1;
  const materials_breakdown = materialsRows.map((m) => ({
    material: m.material_type || 'Unbekannt',
    grams: Math.round(m.grams * 10) / 10,
    percentage: Math.round((m.grams / totalGrams) * 100),
  }));

  // Monthly breakdown (last 6 months)
  const monthlyRows = db.prepare(`
    SELECT 
      substr(start_time, 1, 7) as month,
      COUNT(id) as jobs,
      SUM(material_used_grams) as grams,
      SUM(cost_cents) as cost_cents
    FROM print_jobs
    GROUP BY substr(start_time, 1, 7)
    ORDER BY month ASC
    LIMIT 6
  `).all() as any[];

  const monthly_breakdown = monthlyRows.map((m) => ({
    month: m.month,
    jobs: m.jobs,
    grams: Math.round((m.grams || 0) * 10) / 10,
    cost_cents: m.cost_cents || 0,
  }));

  // Top users
  const topUsersRows = db.prepare(`
    SELECT 
      u.id as user_id,
      u.name as user_name,
      SUM(j.material_used_grams) as grams,
      COUNT(j.id) as jobs,
      SUM(j.cost_cents) as cost_cents
    FROM print_jobs j
    JOIN users u ON j.assigned_user_id = u.id
    GROUP BY u.id
    ORDER BY grams DESC
    LIMIT 5
  `).all() as any[];

  const top_users = topUsersRows.map((u) => ({
    user_id: u.user_id,
    user_name: u.user_name,
    grams: Math.round(u.grams * 10) / 10,
    jobs: u.jobs,
    cost_cents: u.cost_cents,
  }));

  const stats: MakerspaceStats = {
    total_jobs: totals.total_jobs || 0,
    total_grams: Math.round((totals.total_grams || 0) * 10) / 10,
    total_print_hours: Math.round(((totals.total_seconds || 0) / 3600) * 10) / 10,
    active_printers: activePrinters.count || 0,
    unpaid_balance_cents: totals.unpaid_cents || 0,
    materials_breakdown,
    monthly_breakdown,
    top_users,
  };

  return c.json(stats);
});
