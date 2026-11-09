import { Printer, PrinterTelemetry, DiscoveredPrinter } from '../../../src/types/index.ts';
import { PrinterAdapter, JobEvent } from '../types.ts';

interface SnapmakerConnection {
  printer: Printer;
  pollInterval?: NodeJS.Timeout;
  lastState?: string;
  lastFilename?: string;
  isTrackingJob?: boolean;
}

export class SnapmakerAdapter implements PrinterAdapter {
  readonly type = 'snapmaker';
  readonly name = 'Snapmaker U1 (Klipper/Moonraker)';
  readonly supportsDiscovery = true;

  private connections: Map<string, SnapmakerConnection> = new Map();
  private telemetryListeners: ((printerId: string, telemetry: PrinterTelemetry) => void)[] = [];
  private jobEventListeners: ((event: JobEvent) => void)[] = [];

  async start(): Promise<void> {
    console.log('[SnapmakerAdapter] Initialized Snapmaker U1 adapter.');
  }

  async stop(): Promise<void> {
    for (const [id] of this.connections) {
      await this.disconnect(id);
    }
  }

  async discover(): Promise<DiscoveredPrinter[]> {
    // In local network, can return any detected Snapmaker via mDNS or empty
    return [];
  }

  async connect(printer: Printer): Promise<void> {
    if (this.connections.has(printer.id)) return;

    const host = printer.host;
    const port = printer.port || 7125;

    console.log(`[SnapmakerAdapter] Connecting to Snapmaker U1 at ${host}:${port}...`);

    const conn: SnapmakerConnection = {
      printer,
    };
    this.connections.set(printer.id, conn);

    // Test connection & start polling
    this.pollPrinter(printer.id);
    conn.pollInterval = setInterval(() => {
      this.pollPrinter(printer.id);
    }, 3000);
  }

  async disconnect(printerId: string): Promise<void> {
    const conn = this.connections.get(printerId);
    if (!conn) return;

    if (conn.pollInterval) clearInterval(conn.pollInterval);
    this.connections.delete(printerId);
  }

  onTelemetry(listener: (printerId: string, telemetry: PrinterTelemetry) => void): void {
    this.telemetryListeners.push(listener);
  }

  onJobEvent(listener: (event: JobEvent) => void): void {
    this.jobEventListeners.push(listener);
  }

  private async pollPrinter(printerId: string): Promise<void> {
    const conn = this.connections.get(printerId);
    if (!conn) return;

    const host = conn.printer.host;
    const port = conn.printer.port || 7125;

    try {
      const url = `http://${host}:${port}/printer/objects/query?print_stats&extruder&heater_bed`;
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) return;

      const data = await res.json();
      const status = data.result?.status;
      if (!status) return;

      const printStats = status.print_stats || {};
      const extruder = status.extruder || {};
      const bed = status.heater_bed || {};

      const stateStr = (printStats.state || 'standby').toLowerCase();
      const filename = printStats.filename || 'Print Job';
      const progress = Math.round((printStats.progress || 0) * 100);
      const printDuration = Math.round(printStats.print_duration || 0);

      const isPrinting = ['printing', 'busy'].includes(stateStr);

      const telemetry: PrinterTelemetry = {
        nozzle_temp: Math.round((extruder.temperature || 0) * 10) / 10,
        nozzle_target: Math.round((extruder.target || 0) * 10) / 10,
        bed_temp: Math.round((bed.temperature || 0) * 10) / 10,
        bed_target: Math.round((bed.target || 0) * 10) / 10,
        progress_percent: progress,
        remaining_minutes: isPrinting && progress > 0 ? Math.round(((printDuration / (progress / 100)) - printDuration) / 60) : 0,
        current_layer: printStats.info?.current_layer || 0,
        total_layers: printStats.info?.total_layer || 0,
        subtask_name: filename,
        spools: [
          {
            id: 'u1-tool-1',
            type: 'PLA',
            color_hex: '#10B981',
            brand: 'Snapmaker',
            name: 'Extruder 1',
          },
        ],
      };

      for (const listener of this.telemetryListeners) {
        listener(printerId, telemetry);
      }

      // Track job events
      if (isPrinting) {
        if (!conn.isTrackingJob || conn.lastFilename !== filename) {
          // If a previous job was running on this printer and a new one started, mark old job as cancelled
          if (conn.isTrackingJob && conn.lastFilename && conn.lastFilename !== filename) {
            for (const listener of this.jobEventListeners) {
              listener({
                type: 'cancelled',
                printerId,
                jobName: conn.lastFilename,
                durationSeconds: printDuration,
              });
            }
          }

          conn.isTrackingJob = true;
          conn.lastFilename = filename;

          const upperName = filename.toUpperCase();
          let matType = 'PLA';
          let matColor = '#10B981';
          if (upperName.includes('PETG')) { matType = 'PETG'; matColor = '#3B82F6'; }
          else if (upperName.includes('TPU') || upperName.includes('FLEX')) { matType = 'TPU'; matColor = '#F59E0B'; }
          else if (upperName.includes('ABS') || upperName.includes('ASA')) { matType = 'ABS'; matColor = '#8B5CF6'; }
          else if (upperName.includes('PLA-CF') || upperName.includes('CF')) { matType = 'PLA-CF'; matColor = '#475569'; }
          else if (upperName.includes('MATTE')) { matType = 'PLA Matte'; matColor = '#10B981'; }

          for (const listener of this.jobEventListeners) {
            listener({
              type: 'started',
              printerId,
              jobName: filename,
              materialType: matType,
              materialColorHex: matColor,
              metadata: {
                progressPercent: progress,
                currentLayer: telemetry.current_layer,
                totalLayers: telemetry.total_layers,
                remainingMinutes: telemetry.remaining_minutes,
              },
            });
          }
        } else {
          // Progress update
          for (const listener of this.jobEventListeners) {
            listener({
              type: 'progress',
              printerId,
              jobName: filename,
              durationSeconds: printDuration,
              metadata: {
                progressPercent: progress,
                currentLayer: telemetry.current_layer,
                totalLayers: telemetry.total_layers,
                remainingMinutes: telemetry.remaining_minutes,
              },
            });
          }
        }
      } else if (conn.isTrackingJob) {
        const finishedFilename = conn.lastFilename || filename;
        conn.isTrackingJob = false;

        let eventType: 'completed' | 'cancelled' | 'failed' = 'completed';
        if (stateStr === 'complete') {
          eventType = 'completed';
        } else if (['cancelled', 'canceled', 'standby', 'idle'].includes(stateStr)) {
          eventType = 'cancelled';
        } else if (['error', 'failed'].includes(stateStr)) {
          eventType = 'failed';
        }

        for (const listener of this.jobEventListeners) {
          listener({
            type: eventType,
            printerId,
            jobName: finishedFilename,
            durationSeconds: printDuration,
            metadata: {
              progressPercent: progress,
              currentLayer: telemetry.current_layer,
              totalLayers: telemetry.total_layers,
            },
          });
        }
      }

      conn.lastState = stateStr;
    } catch (err) {
      // Printer offline or unreachable
    }
  }
}

export const snapmakerAdapter = new SnapmakerAdapter();
