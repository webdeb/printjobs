import dgram from 'node:dgram';
import { DiscoveredPrinter } from '../../../src/types/index.ts';

export class BambuDiscovery {
  private sockets: dgram.Socket[] = [];
  private discovered: Map<string, DiscoveredPrinter> = new Map();
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Listen on standard Bambu UDP ports: 1990 and 2021
    const ports = [1990, 2021];

    for (const port of ports) {
      try {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        socket.on('error', (err) => {
          console.warn(`[BambuDiscovery] Port ${port} error:`, err.message);
        });

        socket.on('message', (msg, rinfo) => {
          this.parsePacket(msg.toString('utf-8'), rinfo.address);
        });

        socket.bind(port, () => {
          try {
            // Join standard SSDP multicast group
            socket.addMembership('239.255.255.250');
          } catch {
            // Multicast might fail in certain virtual/sandboxed environments, fallback to broadcast
          }
          console.log(`[BambuDiscovery] Listening for Bambu SSDP on UDP port ${port}`);
        });

        this.sockets.push(socket);
      } catch (err: any) {
        console.warn(`[BambuDiscovery] Failed to bind port ${port}:`, err.message);
      }
    }
  }

  stop(): void {
    this.isRunning = false;
    for (const socket of this.sockets) {
      try {
        socket.close();
      } catch {}
    }
    this.sockets = [];
  }

  getDiscovered(): DiscoveredPrinter[] {
    return Array.from(this.discovered.values());
  }

  addDiscovered(printer: DiscoveredPrinter): void {
    this.discovered.set(printer.id, printer);
  }

  private parsePacket(raw: string, ip: string): void {
    if (!raw.includes('bambu.com') && !raw.includes('urn:bambulab-com')) {
      return;
    }

    const lines = raw.split('\r\n');
    const headers: Record<string, string> = {};

    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const key = line.slice(0, idx).trim().toLowerCase();
        const val = line.slice(idx + 1).trim();
        headers[key] = val;
      }
    }

    const serial = headers['usn'] || headers['devserial.bambu.com'];
    if (!serial) return;

    let model = headers['devmodel.bambu.com'] || 'Bambu 3D Printer';
    if (model.startsWith('3DPrinter-')) model = model.replace('3DPrinter-', '');
    if (model === 'C12') model = 'P1S';
    if (model === 'C11') model = 'P1P';
    if (model === 'N1') model = 'A1 Mini';
    if (model === 'N2S') model = 'A1';

    const name = headers['devname.bambu.com'] || `${model} (${serial.slice(-4)})`;
    const host = headers['location'] || ip;

    const discoveredPrinter: DiscoveredPrinter = {
      id: serial,
      name,
      model,
      make: 'Bambu Lab',
      adapter_type: 'bambulab',
      host,
      port: 8883,
      already_added: false,
    };

    this.discovered.set(serial, discoveredPrinter);
  }
}

export const bambuDiscovery = new BambuDiscovery();
