import { Printer, PrinterTelemetry, DiscoveredPrinter } from '../../src/types/index.ts';
import { PrinterAdapter, JobEvent } from './types.ts';
import { bambuAdapter } from './bambulab/bambuAdapter.ts';
import { snapmakerAdapter } from './snapmaker/snapmakerAdapter.ts';
import { mockAdapter } from './mock/mockAdapter.ts';

export class AdapterManager {
  private adapters: Map<string, PrinterAdapter> = new Map();
  private telemetrySubscribers: ((printerId: string, telemetry: PrinterTelemetry) => void)[] = [];
  private jobEventSubscribers: ((event: JobEvent) => void)[] = [];

  constructor() {
    this.registerAdapter(bambuAdapter);
    this.registerAdapter(snapmakerAdapter);
    this.registerAdapter(mockAdapter);
  }

  registerAdapter(adapter: PrinterAdapter) {
    this.adapters.set(adapter.type, adapter);

    adapter.onTelemetry((printerId, telemetry) => {
      for (const sub of this.telemetrySubscribers) {
        sub(printerId, telemetry);
      }
    });

    adapter.onJobEvent((event) => {
      for (const sub of this.jobEventSubscribers) {
        sub(event);
      }
    });
  }

  getAdapter(type: string): PrinterAdapter | undefined {
    return this.adapters.get(type) || this.adapters.get('mock');
  }

  getAllAdapters(): PrinterAdapter[] {
    return Array.from(this.adapters.values());
  }

  async startAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.start();
      } catch (err: any) {
        console.error(`[AdapterManager] Error starting adapter ${adapter.name}:`, err.message);
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.stop();
      } catch (err: any) {
        console.error(`[AdapterManager] Error stopping adapter ${adapter.name}:`, err.message);
      }
    }
  }

  async discoverAll(): Promise<DiscoveredPrinter[]> {
    const results: DiscoveredPrinter[] = [];
    for (const adapter of this.adapters.values()) {
      if (adapter.supportsDiscovery && adapter.discover) {
        try {
          const discovered = await adapter.discover();
          results.push(...discovered);
        } catch (err: any) {
          console.error(`[AdapterManager] Discovery error in ${adapter.name}:`, err.message);
        }
      }
    }
    return results;
  }

  async connectPrinter(printer: Printer): Promise<void> {
    const adapter = this.getAdapter(printer.adapter_type);
    if (!adapter) {
      throw new Error(`No adapter found for type: ${printer.adapter_type}`);
    }
    await adapter.connect(printer);
  }

  async disconnectPrinter(printerId: string, adapterType: string): Promise<void> {
    const adapter = this.getAdapter(adapterType);
    if (adapter) {
      await adapter.disconnect(printerId);
    }
  }

  onTelemetry(subscriber: (printerId: string, telemetry: PrinterTelemetry) => void) {
    this.telemetrySubscribers.push(subscriber);
  }

  onJobEvent(subscriber: (event: JobEvent) => void) {
    this.jobEventSubscribers.push(subscriber);
  }
}

export const adapterManager = new AdapterManager();
