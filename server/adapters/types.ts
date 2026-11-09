import { Printer, PrinterTelemetry, DiscoveredPrinter } from '../../src/types/index.ts';

export interface JobEvent {
  type: 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  printerId: string;
  jobName: string;
  materialType?: string;
  materialColorHex?: string;
  materialUsedGrams?: number;
  durationSeconds?: number;
  metadata?: Record<string, any>;
}

export interface PrinterAdapter {
  readonly type: string;
  readonly name: string;
  readonly supportsDiscovery: boolean;

  start(): Promise<void>;
  stop(): Promise<void>;

  discover?(): Promise<DiscoveredPrinter[]>;
  connect(printer: Printer): Promise<void>;
  disconnect(printerId: string): Promise<void>;

  onTelemetry(listener: (printerId: string, telemetry: PrinterTelemetry) => void): void;
  onJobEvent(listener: (event: JobEvent) => void): void;
}
