import { db } from '../db/database.ts';
import { adapterManager } from '../adapters/adapterManager.ts';
import { PrinterTelemetry } from '../../src/types/index.ts';
import { JobEvent } from '../adapters/types.ts';

import { calculateCostCents, estimateJobGrams } from './pricing.ts';

// In-memory cache of latest telemetry for instant reads
export const liveTelemetryCache = new Map<string, PrinterTelemetry>();

export type EventBroadcaster = (event: { type: string; data: any }) => void;
const eventSubscribers: EventBroadcaster[] = [];

export function subscribeToEvents(broadcaster: EventBroadcaster): () => void {
  eventSubscribers.push(broadcaster);
  return () => {
    const idx = eventSubscribers.indexOf(broadcaster);
    if (idx !== -1) eventSubscribers.splice(idx, 1);
  };
}

export function broadcastEvent(type: string, data: any): void {
  for (const sub of eventSubscribers) {
    try {
      sub({ type, data });
    } catch {}
  }
}

export class JobTracker {
  start(): void {
    // Listen to telemetry updates
    adapterManager.onTelemetry((printerId, telemetry) => {
      liveTelemetryCache.set(printerId, telemetry);

      // Update printer status in database
      let isPrinting = telemetry.progress_percent > 0 && telemetry.progress_percent < 100;
      try {
        const hasRunningJob = db.prepare(`SELECT id FROM print_jobs WHERE printer_id = ? AND status = 'running' LIMIT 1`).get(printerId);
        if (hasRunningJob) isPrinting = true;
      } catch {}
      const status = isPrinting ? 'printing' : 'idle';

      try {
        db.prepare('UPDATE printers SET status = ?, last_seen_at = ? WHERE id = ?').run(
          status,
          new Date().toISOString(),
          printerId
        );
      } catch (err: any) {
        // Table might be initializing or printer not in DB yet
      }

      // Broadcast telemetry to frontend clients
      broadcastEvent('telemetry', { printerId, telemetry, status });
    });

    // Listen to print job state events
    adapterManager.onJobEvent((event: JobEvent) => {
      this.handleJobEvent(event);
    });
  }

  private handleJobEvent(event: JobEvent): void {
    const now = new Date().toISOString();

    if (event.type === 'started') {
      // 1. A printer can physically only execute ONE print job at a time.
      // If there is any active running job on this printer for a different job name, terminate it as 'cancelled'!
      const previousRunningJobs = db.prepare(`
        SELECT id, job_name, start_time, material_type, metadata_json, material_used_grams, cost_cents FROM print_jobs
        WHERE printer_id = ? AND status = 'running' AND job_name != ?
      `).all(event.printerId, event.jobName) as Array<{
        id: number;
        job_name: string;
        start_time: string;
        material_type: string;
        metadata_json?: string;
        material_used_grams: number;
        cost_cents: number;
      }>;

      for (const oldJob of previousRunningJobs) {
        let oldMeta: Record<string, any> = {};
        try {
          if (oldJob.metadata_json) oldMeta = JSON.parse(oldJob.metadata_json);
        } catch {}
        const durationSec = Math.round((Date.now() - new Date(oldJob.start_time).getTime()) / 1000);
        const finalGrams = oldJob.material_used_grams || 1;
        const costCents = oldJob.cost_cents || calculateCostCents(oldJob.material_type, finalGrams);
        oldMeta.finalStatus = 'cancelled';

        db.prepare(`
          UPDATE print_jobs
          SET status = 'cancelled', end_time = ?, duration_seconds = ?, material_used_grams = ?, cost_cents = ?, metadata_json = ?
          WHERE id = ?
        `).run(now, durationSec, finalGrams, costCents, JSON.stringify(oldMeta), oldJob.id);

        console.log(`[JobTracker] Closed previous running job #${oldJob.id} ("${oldJob.job_name}") as 'cancelled' because new job "${event.jobName}" started on printer ${event.printerId}`);
        broadcastEvent('job_finished', {
          jobId: oldJob.id,
          status: 'cancelled',
          durationSeconds: durationSec,
          grams: finalGrams,
          costCents,
        });
      }

      // 2. Check if there is already a running job for this printer and job name
      const existing = db.prepare(`
        SELECT id FROM print_jobs
        WHERE printer_id = ? AND job_name = ? AND status = 'running'
      `).get(event.printerId, event.jobName) as { id: number } | undefined;

      if (!existing) {
        const totalGrams = event.metadata?.totalGrams || event.materialUsedGrams || estimateJobGrams(
          event.jobName,
          event.metadata?.totalLayers,
          event.metadata?.remainingMinutes
        );
        const progressPercent = Number(event.metadata?.progressPercent) || 0;
        const usedGrams = Math.max(0.5, Math.round((totalGrams * Math.max(progressPercent, 5) / 100) * 10) / 10);
        let materialType = event.materialType || 'PLA';
        let materialColorHex = event.materialColorHex || '#10B981';
        const upper = event.jobName.toUpperCase();
        if (upper.includes('PETG')) { materialType = 'PETG'; materialColorHex = '#3B82F6'; }
        else if (upper.includes('TPU') || upper.includes('FLEX')) { materialType = 'TPU'; materialColorHex = '#F59E0B'; }
        else if (upper.includes('ABS') || upper.includes('ASA')) { materialType = 'ABS'; materialColorHex = '#8B5CF6'; }
        else if (upper.includes('PLA-CF') || upper.includes('CF')) { materialType = 'PLA-CF'; materialColorHex = '#475569'; }

        const costCents = calculateCostCents(materialType, usedGrams);
        const metaObj = {
          totalGrams,
          progressPercent,
          ...(event.metadata || {}),
        };

        const insertStmt = db.prepare(`
          INSERT INTO print_jobs (
            printer_id, job_name, status, start_time,
            material_type, material_color_hex, material_used_grams, cost_cents, metadata_json
          ) VALUES (?, ?, 'running', ?, ?, ?, ?, ?, ?)
        `);
        const result = insertStmt.run(
          event.printerId,
          event.jobName,
          now,
          materialType,
          event.materialColorHex || '#10B981',
          usedGrams,
          costCents,
          JSON.stringify(metaObj)
        );

        const newJobId = Number(result.lastInsertRowid);
        console.log(`[JobTracker] New print job #${newJobId} started: "${event.jobName}" on printer ${event.printerId} (${usedGrams}g of ~${totalGrams}g, ${(costCents/100).toFixed(2)}€)`);

        broadcastEvent('job_started', {
          jobId: newJobId,
          printerId: event.printerId,
          jobName: event.jobName,
          materialType,
          materialColorHex: event.materialColorHex || '#10B981',
          materialUsedGrams: usedGrams,
          costCents,
          startTime: now,
          metadata: metaObj,
        });
      }
    } else if (event.type === 'progress') {
      // In-place update for running job
      const runningJob = db.prepare(`
        SELECT id, start_time, material_type, metadata_json, material_used_grams FROM print_jobs
        WHERE printer_id = ? AND status = 'running'
        ORDER BY id DESC LIMIT 1
      `).get(event.printerId) as { id: number; start_time: string; material_type: string; metadata_json?: string; material_used_grams: number } | undefined;

      if (runningJob) {
        let meta: Record<string, any> = {};
        try {
          if (runningJob.metadata_json) meta = JSON.parse(runningJob.metadata_json);
        } catch {}

        const durationSec = event.durationSeconds || Math.round((Date.now() - new Date(runningJob.start_time).getTime()) / 1000);
        const totalGrams = meta.totalGrams || event.metadata?.totalGrams || estimateJobGrams(
          event.jobName,
          event.metadata?.totalLayers,
          event.metadata?.remainingMinutes
        );
        const incomingPercent = event.metadata?.progressPercent !== undefined && !isNaN(Number(event.metadata.progressPercent))
          ? Number(event.metadata.progressPercent)
          : undefined;

        // Never let progressPercent go backwards during a running job!
        const currentPercent = Number(meta.progressPercent) || 0;
        const progressPercent = (incomingPercent !== undefined && incomingPercent > 0)
          ? Math.max(incomingPercent, currentPercent)
          : currentPercent;

        // If manualOverride is active, preserve user's weight & cost
        let usedGrams = runningJob.material_used_grams || 0;
        let costCents = 0;
        const materialType = event.materialType || runningJob.material_type || 'PLA';

        if (!meta.manualOverride) {
          // Pro-rate material used by current print progress, strictly monotonic
          const calcGrams = Math.max(
            0.5,
            Math.round((totalGrams * Math.max(progressPercent, 1) / 100) * 10) / 10
          );
          usedGrams = event.materialUsedGrams || Math.max(
            runningJob.material_used_grams || 0,
            calcGrams
          );
          costCents = calculateCostCents(materialType, usedGrams);
        } else {
          // Keep existing cost if manual override
          const jobRow = db.prepare('SELECT cost_cents FROM print_jobs WHERE id = ?').get(runningJob.id) as any;
          costCents = jobRow?.cost_cents || calculateCostCents(materialType, usedGrams);
        }

        const updatedMeta = {
          ...meta,
          ...(event.metadata || {}),
          totalGrams,
          progressPercent,
        };

        const updateStmt = db.prepare(`
          UPDATE print_jobs
          SET duration_seconds = ?, material_used_grams = ?, cost_cents = ?, metadata_json = ?
          WHERE id = ?
        `);
        updateStmt.run(durationSec, usedGrams, costCents, JSON.stringify(updatedMeta), runningJob.id);

        broadcastEvent('job_progress', {
          jobId: runningJob.id,
          printerId: event.printerId,
          durationSeconds: durationSec,
          materialUsedGrams: usedGrams,
          costCents,
          metadata: updatedMeta,
        });
      }
    } else if (event.type === 'completed' || event.type === 'failed' || event.type === 'cancelled') {
      // Find currently running job for this printer
      const runningJob = db.prepare(`
        SELECT id, start_time, material_type, metadata_json, material_used_grams FROM print_jobs
        WHERE printer_id = ? AND status = 'running'
        ORDER BY id DESC LIMIT 1
      `).get(event.printerId) as { id: number; start_time: string; material_type: string; metadata_json?: string; material_used_grams: number } | undefined;

      if (runningJob) {
        let meta: Record<string, any> = {};
        try {
          if (runningJob.metadata_json) meta = JSON.parse(runningJob.metadata_json);
        } catch {}

        const durationSec = event.durationSeconds || Math.round((Date.now() - new Date(runningJob.start_time).getTime()) / 1000);
        const materialType = event.materialType || runningJob.material_type || 'PLA';
        const totalGrams = meta.totalGrams || estimateJobGrams(event.jobName);

        let finalGrams: number;
        if (meta.manualOverride) {
          finalGrams = runningJob.material_used_grams;
        } else if (event.type === 'completed') {
          finalGrams = event.materialUsedGrams || totalGrams;
        } else {
          // If aborted/failed, pro-rate by progress reached (e.g. 70%)
          const progressPercent = meta.progressPercent || 50;
          finalGrams = event.materialUsedGrams || Math.max(runningJob.material_used_grams || 1, Math.round((totalGrams * (progressPercent / 100)) * 10) / 10);
        }

        const costCents = meta.manualOverride
          ? (db.prepare('SELECT cost_cents FROM print_jobs WHERE id = ?').get(runningJob.id) as any)?.cost_cents || calculateCostCents(materialType, finalGrams)
          : calculateCostCents(materialType, finalGrams);

        const updatedMeta = {
          ...meta,
          totalGrams,
          finalStatus: event.type,
        };

        const updateStmt = db.prepare(`
          UPDATE print_jobs
          SET status = ?, end_time = ?, duration_seconds = ?, material_type = ?, material_used_grams = ?, cost_cents = ?, metadata_json = ?
          WHERE id = ?
        `);
        updateStmt.run(event.type, now, durationSec, materialType, finalGrams, costCents, JSON.stringify(updatedMeta), runningJob.id);

        console.log(`[JobTracker] Print job #${runningJob.id} finished with status "${event.type}": ${finalGrams}g (${(costCents/100).toFixed(2)}€)`);

        broadcastEvent('job_finished', {
          jobId: runningJob.id,
          status: event.type,
          durationSeconds: durationSec,
          grams: finalGrams,
          costCents,
        });
      } else {
        // Printer was not actively being tracked (e.g. was already in FINISH state before app boot)
        // Do NOT insert a duplicate print job!
        console.log(`[JobTracker] Ignored ${event.type} event for "${event.jobName}" on ${event.printerId} as no active running job was tracked.`);
      }
    }
  }
}

export const jobTracker = new JobTracker();
