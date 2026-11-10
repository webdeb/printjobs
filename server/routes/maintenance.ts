import { Hono } from 'hono';
import { db } from '../db/database.ts';
import { broadcastEvent } from '../services/jobTracker.ts';
import { MaintenanceLog } from '../../src/types/index.ts';

export const maintenanceRouter = new Hono();

// List maintenance logs (optionally filtered by printer_id)
maintenanceRouter.get('/', (c) => {
  const printerId = c.req.query('printer_id');

  let query = `
    SELECT m.*, p.name as printer_name
    FROM maintenance_logs m
    LEFT JOIN printers p ON m.printer_id = p.id
  `;
  const params: any[] = [];

  if (printerId) {
    query += ' WHERE m.printer_id = ?';
    params.push(printerId);
  }

  query += ' ORDER BY m.performed_at DESC LIMIT 100';

  const rows = db.prepare(query).all(...params) as any[];
  const logs: MaintenanceLog[] = rows.map((r) => ({
    id: r.id,
    printer_id: r.printer_id,
    printer_name: r.printer_name,
    service_type: r.service_type,
    notes: r.notes,
    performed_by: r.performed_by,
    performed_at: r.performed_at,
  }));

  return c.json(logs);
});

// Add maintenance entry
maintenanceRouter.post('/', async (c) => {
  const body = await c.req.json();
  const { printer_id, service_type, notes, performed_by } = body;

  const cleanPrinterId = typeof printer_id === 'string' ? printer_id.trim().slice(0, 64) : '';
  const cleanServiceType = typeof service_type === 'string' ? service_type.trim().slice(0, 80) : '';
  const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 2000) : '';
  const cleanPerformedBy = typeof performed_by === 'string' && performed_by.trim()
    ? performed_by.trim().slice(0, 80)
    : 'Makerspace Mitglied';

  if (!cleanPrinterId || !cleanServiceType || !cleanNotes) {
    return c.json({ error: 'printer_id, service_type, and notes are required' }, 400);
  }

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO maintenance_logs (printer_id, service_type, notes, performed_by, performed_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = insert.run(
    cleanPrinterId,
    cleanServiceType,
    cleanNotes,
    cleanPerformedBy,
    now
  );

  const entry: MaintenanceLog = {
    id: Number(result.lastInsertRowid),
    printer_id: cleanPrinterId,
    service_type: cleanServiceType,
    notes: cleanNotes,
    performed_by: cleanPerformedBy,
    performed_at: now,
  };

  broadcastEvent('maintenance_added', entry);
  return c.json(entry, 201);
});
