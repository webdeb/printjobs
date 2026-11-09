import { Printer, PrinterTelemetry, DiscoveredPrinter } from '../../../src/types/index.ts';
import { PrinterAdapter, JobEvent } from '../types.ts';

interface SimPrinterState {
  printer: Printer;
  telemetry: PrinterTelemetry;
  tickCounter: number;
}

export class MockAdapter implements PrinterAdapter {
  readonly type = 'mock';
  readonly name = 'Simulator & Demo Adapter';
  readonly supportsDiscovery = true;

  private printers: Map<string, SimPrinterState> = new Map();
  private interval?: NodeJS.Timeout;
  private telemetryListeners: ((printerId: string, telemetry: PrinterTelemetry) => void)[] = [];
  private jobEventListeners: ((event: JobEvent) => void)[] = [];

  async start(): Promise<void> {
    if (this.interval) return;

    this.interval = setInterval(() => {
      this.tick();
    }, 2000);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  async discover(): Promise<DiscoveredPrinter[]> {
    return [];
  }

  async connect(printer: Printer): Promise<void> {
    const isPrinting = printer.status === 'printing' || printer.id.includes('x1c') || printer.id.includes('a1m');

    const defaultTelemetry: PrinterTelemetry = {
      nozzle_temp: isPrinting ? 220 : 26,
      nozzle_target: isPrinting ? 220 : 0,
      bed_temp: isPrinting ? 60 : 24,
      bed_target: isPrinting ? 60 : 0,
      chamber_temp: isPrinting ? 38 : 22,
      progress_percent: isPrinting ? (printer.id.includes('a1m') ? 78 : 34) : 0,
      remaining_minutes: isPrinting ? (printer.id.includes('a1m') ? 22 : 85) : 0,
      current_layer: isPrinting ? 142 : 0,
      total_layers: isPrinting ? 320 : 0,
      subtask_name: isPrinting ? (printer.id.includes('a1m') ? 'Sensor_Mount_v2.3mf' : 'Wabengold_Rahmen_4x.3mf') : 'Bereit für Auftrag',
      speed_level: 1,
      spools: [
        { id: 'tray-1', type: 'PLA Matte', color_hex: '#10B981', brand: 'Bambu Lab', name: 'Matte Forest Green', remaining_percent: 64 },
        { id: 'tray-2', type: 'PLA Basic', color_hex: '#3B82F6', brand: 'Bambu Lab', name: 'Basic Cyan', remaining_percent: 88 },
        { id: 'tray-3', type: 'PETG', color_hex: '#F59E0B', brand: 'Extrudr', name: 'Amber Orange', remaining_percent: 42 },
        { id: 'tray-4', type: 'PLA-CF', color_hex: '#1E293B', brand: 'Bambu Lab', name: 'Carbon Black', remaining_percent: 91 },
      ],
      active_tray_id: 'tray-1',
    };

    this.printers.set(printer.id, {
      printer,
      telemetry: printer.telemetry || defaultTelemetry,
      tickCounter: Math.floor(Math.random() * 50),
    });
  }

  async disconnect(printerId: string): Promise<void> {
    this.printers.delete(printerId);
  }

  onTelemetry(listener: (printerId: string, telemetry: PrinterTelemetry) => void): void {
    this.telemetryListeners.push(listener);
  }

  onJobEvent(listener: (event: JobEvent) => void): void {
    this.jobEventListeners.push(listener);
  }

  private tick(): void {
    for (const [id, state] of this.printers.entries()) {
      state.tickCounter++;
      const tel = state.telemetry;

      if (tel.nozzle_target > 0) {
        // Subtle realistic temperature jitter (±1.5°C)
        const jitter = (Math.random() - 0.5) * 1.6;
        tel.nozzle_temp = Math.round((tel.nozzle_target + jitter) * 10) / 10;
        tel.bed_temp = Math.round((tel.bed_target + (Math.random() - 0.5) * 0.8) * 10) / 10;

        // Advance progress every few ticks
        if (state.tickCounter % 3 === 0 && tel.progress_percent < 100) {
          tel.progress_percent = Math.min(100, tel.progress_percent + 1);
          if (tel.remaining_minutes > 0) {
            tel.remaining_minutes = Math.max(0, tel.remaining_minutes - 1);
          }
          if (tel.current_layer < tel.total_layers) {
            tel.current_layer += 1;
          }

          // Complete job if reached 100%
          if (tel.progress_percent >= 100) {
            for (const listener of this.jobEventListeners) {
              listener({
                type: 'completed',
                printerId: id,
                jobName: tel.subtask_name,
                materialType: tel.spools[0]?.type || 'PLA',
                materialColorHex: tel.spools[0]?.color_hex || '#10B981',
                materialUsedGrams: Math.round((45 + Math.random() * 80) * 10) / 10,
                durationSeconds: 7200,
              });
            }
            // Reset to idle
            tel.nozzle_target = 0;
            tel.bed_target = 0;
            tel.progress_percent = 0;
            tel.subtask_name = 'Druck abgeschlossen';
          }
        }
      }

      // Notify telemetry listeners
      for (const listener of this.telemetryListeners) {
        listener(id, { ...tel });
      }
    }
  }
}

export const mockAdapter = new MockAdapter();
