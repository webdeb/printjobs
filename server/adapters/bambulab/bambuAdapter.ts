import mqtt from 'mqtt';
import { Printer, PrinterTelemetry, SpoolInfo, DiscoveredPrinter } from '../../../src/types/index.ts';
import { PrinterAdapter, JobEvent } from '../types.ts';
import { bambuDiscovery } from './discovery.ts';

interface ConnectedClient {
  client: mqtt.MqttClient;
  printer: Printer;
  pollInterval?: NodeJS.Timeout;
  lastState?: string;
  lastSubtask?: string;
  lastPercent?: number;
  lastRemainingMins?: number;
  lastLayer?: number;
  lastTotalLayers?: number;
  jobStartTime?: number;
  isCurrentlyTrackingJob?: boolean;
  lastFinishedSubtask?: string;
  lastTelemetry?: PrinterTelemetry;
}

export class BambuLabAdapter implements PrinterAdapter {
  readonly type = 'bambulab';
  readonly name = 'Bambu Lab';
  readonly supportsDiscovery = true;

  private connections: Map<string, ConnectedClient> = new Map();
  private telemetryListeners: ((printerId: string, telemetry: PrinterTelemetry) => void)[] = [];
  private jobEventListeners: ((event: JobEvent) => void)[] = [];

  async start(): Promise<void> {
    bambuDiscovery.start();
  }

  async stop(): Promise<void> {
    bambuDiscovery.stop();
    for (const [id] of this.connections) {
      await this.disconnect(id);
    }
  }

  async discover(): Promise<DiscoveredPrinter[]> {
    return bambuDiscovery.getDiscovered();
  }

  async connect(printer: Printer): Promise<void> {
    if (this.connections.has(printer.id)) {
      return;
    }

    const host = printer.host;
    const port = printer.port || 8883;
    const username = 'bblp';
    const password = printer.access_code || '';

    console.log(`[BambuLabAdapter] Connecting to ${printer.name} (${host}:${port})...`);

    const client = mqtt.connect(`mqtts://${host}:${port}`, {
      username,
      password,
      rejectUnauthorized: false, // Bambu uses self-signed local TLS certificates
      reconnectPeriod: 10000,
      connectTimeout: 10000,
    });

    const conn: ConnectedClient = {
      client,
      printer,
    };
    this.connections.set(printer.id, conn);

    client.on('connect', () => {
      console.log(`[BambuLabAdapter] Connected to ${printer.name}`);
      const reportTopic = `device/${printer.id}/report`;
      client.subscribe(reportTopic, (err) => {
        if (err) console.error(`[BambuLabAdapter] Subscribe error on ${printer.name}:`, err);
      });

      // Request full state dump immediately
      this.sendPushAll(printer.id);

      // Periodically poll with pushall every 30 seconds
      conn.pollInterval = setInterval(() => {
        this.sendPushAll(printer.id);
      }, 30000);
    });

    client.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString('utf-8'));
        this.handleReport(printer.id, payload);
      } catch (err: any) {
        console.warn(`[BambuLabAdapter] Failed to parse message from ${printer.id}:`, err.message);
      }
    });

    client.on('error', (err) => {
      console.warn(`[BambuLabAdapter] Error on ${printer.name}:`, err.message);
    });

    client.on('close', () => {
      console.log(`[BambuLabAdapter] Connection closed for ${printer.name}`);
    });
  }

  async disconnect(printerId: string): Promise<void> {
    const conn = this.connections.get(printerId);
    if (!conn) return;

    if (conn.pollInterval) clearInterval(conn.pollInterval);
    conn.client.end(true);
    this.connections.delete(printerId);
  }

  sendPushAll(printerId: string): void {
    const conn = this.connections.get(printerId);
    if (!conn || !conn.client.connected) return;

    const requestTopic = `device/${printerId}/request`;
    const payload = JSON.stringify({
      pushing: {
        sequence_id: '0',
        command: 'pushall',
      },
    });

    conn.client.publish(requestTopic, payload);
  }

  onTelemetry(listener: (printerId: string, telemetry: PrinterTelemetry) => void): void {
    this.telemetryListeners.push(listener);
  }

  onJobEvent(listener: (event: JobEvent) => void): void {
    this.jobEventListeners.push(listener);
  }

  private handleReport(printerId: string, payload: any): void {
    const print = payload?.print;
    if (!print) return;

    const conn = this.connections.get(printerId);

    // Extract AMS / Tray info
    const spools: SpoolInfo[] = [];
    if (Array.isArray(print.ams?.ams)) {
      for (const amsUnit of print.ams.ams) {
        if (Array.isArray(amsUnit.tray)) {
          for (const tray of amsUnit.tray) {
            if (tray.tray_type || tray.tray_sub_brands) {
              const hex = tray.tray_color ? `#${tray.tray_color.slice(0, 6)}` : '#10B981';
              spools.push({
                id: `ams-${amsUnit.id}-${tray.id}`,
                type: tray.tray_type || 'PLA',
                color_hex: hex,
                brand: tray.tray_sub_brands || 'Bambu Lab',
                name: tray.tray_info_idx || tray.tray_type,
                remaining_percent: tray.remain !== undefined ? tray.remain : 100,
              });
            }
          }
        }
      }
    } else if (print.vt_tray) {
      // External spool holder
      const hex = print.vt_tray.tray_color ? `#${print.vt_tray.tray_color.slice(0, 6)}` : '#10B981';
      spools.push({
        id: 'external-spool',
        type: print.vt_tray.tray_type || 'PLA',
        color_hex: hex,
        brand: print.vt_tray.tray_sub_brands || 'Generic',
        name: 'Spool Holder',
      });
    }

    const rawGcode = print.gcode_state ? print.gcode_state.toUpperCase() : null;
    const gcodeState = rawGcode || (conn?.lastState || 'IDLE');
    const subtaskName = print.subtask_name || (conn?.lastSubtask || 'Print Job');

    if (conn) {
      if (print.subtask_name && conn.lastSubtask && conn.lastSubtask !== print.subtask_name) {
        // New job subtask started
        conn.lastPercent = undefined;
        conn.lastRemainingMins = undefined;
        conn.lastLayer = undefined;
        conn.lastTotalLayers = undefined;
      }

      if (print.mc_percent !== undefined && print.mc_percent !== null && !isNaN(Number(print.mc_percent))) {
        const val = Number(print.mc_percent);
        if (val > 0 || conn.lastPercent === undefined) {
          conn.lastPercent = Math.max(val, conn.lastPercent || 0);
        }
      }
      if (print.mc_remaining_time !== undefined && print.mc_remaining_time !== null && !isNaN(Number(print.mc_remaining_time))) {
        const mins = Number(print.mc_remaining_time);
        if (mins > 0 || conn.lastRemainingMins === undefined) {
          conn.lastRemainingMins = mins;
        }
      }
      if (print.layer_num !== undefined && print.layer_num !== null && !isNaN(Number(print.layer_num))) {
        const lNum = Number(print.layer_num);
        if (lNum > 0 || conn.lastLayer === undefined) {
          conn.lastLayer = Math.max(lNum, conn.lastLayer || 0);
        }
      }
      if (print.total_layer_num !== undefined && print.total_layer_num !== null && !isNaN(Number(print.total_layer_num)) && Number(print.total_layer_num) > 0) {
        conn.lastTotalLayers = Number(print.total_layer_num);
      }
    }

    const percent = conn?.lastPercent !== undefined ? conn.lastPercent : (Number(print.mc_percent) || 0);
    const remainingMins = conn?.lastRemainingMins !== undefined ? conn.lastRemainingMins : (Number(print.mc_remaining_time) || 0);
    const currentLayer = conn?.lastLayer !== undefined ? conn.lastLayer : (Number(print.layer_num) || 0);
    const totalLayers = conn?.lastTotalLayers !== undefined ? conn.lastTotalLayers : (Number(print.total_layer_num) || 0);

    const prev = conn?.lastTelemetry;

    const parseNum = (val: any, fallback: number = 0): number => {
      if (val !== undefined && val !== null && !isNaN(Number(val))) {
        return Math.round(Number(val) * 10) / 10;
      }
      return fallback;
    };

    const nozzleTemp = parseNum(print.nozzle_temper, prev?.nozzle_temp ?? 0);
    const nozzleTarget = parseNum(print.nozzle_target_temper, prev?.nozzle_target ?? 0);
    const bedTemp = parseNum(print.bed_temper, prev?.bed_temp ?? 0);
    const bedTarget = parseNum(print.bed_target_temper, prev?.bed_target ?? 0);
    const chamberTemp = print.chamber_temper !== undefined && print.chamber_temper !== null && !isNaN(Number(print.chamber_temper))
      ? Math.round(Number(print.chamber_temper) * 10) / 10
      : (prev?.chamber_temp ?? 0);

    const activeSpools = spools.length > 0 ? spools : (prev?.spools || []);

    const telemetry: PrinterTelemetry = {
      nozzle_temp: nozzleTemp,
      nozzle_target: nozzleTarget,
      bed_temp: bedTemp,
      bed_target: bedTarget,
      chamber_temp: chamberTemp,
      progress_percent: percent,
      remaining_minutes: remainingMins,
      current_layer: currentLayer,
      total_layers: totalLayers,
      subtask_name: subtaskName,
      speed_level: Number(print.spd_lvl) || prev?.speed_level || 1,
      spools: activeSpools,
      active_tray_id: print.ams?.tray_tar || prev?.active_tray_id,
    };

    if (conn) {
      conn.lastTelemetry = telemetry;
    }

    // Emit telemetry to subscribers
    for (const listener of this.telemetryListeners) {
      listener(printerId, telemetry);
    }

    // State machine for job detection
    if (conn) {
      const isPrintingNow = ['RUNNING', 'PREPARE'].includes(gcodeState);

      // New job started
      if (isPrintingNow) {
        if (!conn.isCurrentlyTrackingJob || (conn.lastSubtask && conn.lastSubtask !== subtaskName)) {
          conn.isCurrentlyTrackingJob = true;
          conn.jobStartTime = Date.now();
          conn.lastSubtask = subtaskName;

          const activeSpool = spools[0];
          for (const listener of this.jobEventListeners) {
            listener({
              type: 'started',
              printerId,
              jobName: subtaskName,
              materialType: activeSpool?.type || 'PLA',
              materialColorHex: activeSpool?.color_hex || '#10B981',
              metadata: {
                progressPercent: percent,
                currentLayer,
                totalLayers,
                remainingMinutes: remainingMins,
              },
            });
          }
        } else {
          // In-place progress update while printing
          const durationSec = conn.jobStartTime ? Math.round((Date.now() - conn.jobStartTime) / 1000) : 0;
          const activeSpool = spools[0];
          for (const listener of this.jobEventListeners) {
            listener({
              type: 'progress',
              printerId,
              jobName: subtaskName,
              materialType: activeSpool?.type || 'PLA',
              materialColorHex: activeSpool?.color_hex || '#10B981',
              durationSeconds: durationSec,
              metadata: {
                progressPercent: percent,
                currentLayer,
                totalLayers,
                remainingMinutes: remainingMins,
              },
            });
          }
        }
      }

      // Job finished — only if we were actively tracking this running job!
      if (gcodeState === 'FINISH') {
        if (conn.isCurrentlyTrackingJob && conn.lastFinishedSubtask !== subtaskName) {
          const durationSec = conn.jobStartTime ? Math.round((Date.now() - conn.jobStartTime) / 1000) : 3600;
          const activeSpool = spools[0];
          conn.isCurrentlyTrackingJob = false;
          conn.lastFinishedSubtask = subtaskName;

          for (const listener of this.jobEventListeners) {
            listener({
              type: 'completed',
              printerId,
              jobName: subtaskName,
              materialType: activeSpool?.type || 'PLA',
              materialColorHex: activeSpool?.color_hex || '#10B981',
              durationSeconds: durationSec,
            });
          }
        }
      }

      // Job failed or cancelled — only if we were actively tracking this running job!
      if (['FAILED', 'CANCELLED'].includes(gcodeState)) {
        if (conn.isCurrentlyTrackingJob) {
          const durationSec = conn.jobStartTime ? Math.round((Date.now() - conn.jobStartTime) / 1000) : 1800;
          conn.isCurrentlyTrackingJob = false;

          for (const listener of this.jobEventListeners) {
            listener({
              type: 'cancelled',
              printerId,
              jobName: subtaskName,
              durationSeconds: durationSec,
            });
          }
        }
      } else if (['IDLE', 'INIT'].includes(gcodeState) && conn.isCurrentlyTrackingJob && conn.lastState && ['RUNNING', 'PREPARE', 'PAUSE'].includes(conn.lastState)) {
        // User cancelled print on printer touchscreen or Bambu Handy
        const durationSec = conn.jobStartTime ? Math.round((Date.now() - conn.jobStartTime) / 1000) : 1800;
        conn.isCurrentlyTrackingJob = false;

        for (const listener of this.jobEventListeners) {
          listener({
            type: 'cancelled',
            printerId,
            jobName: subtaskName,
            durationSeconds: durationSec,
          });
        }
      }

      conn.lastState = gcodeState;
      conn.lastSubtask = subtaskName;
    }
  }
}

export const bambuAdapter = new BambuLabAdapter();
