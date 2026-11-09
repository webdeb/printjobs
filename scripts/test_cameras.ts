import { exec } from 'child_process';
import { DatabaseSync } from 'node:sqlite';
import net from 'node:net';

const db = new DatabaseSync('./printjobs.sqlite');
const printers = db.prepare('SELECT id, name, model, host, port, access_code, adapter_type FROM printers').all() as any[];

console.log(`Testing ${printers.length} printers...`);

async function checkPort(host: string, port: number, timeout = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function testPrinter(p: any) {
  console.log(`\n--- Printer: ${p.name} (${p.model}, ${p.host}) ---`);
  
  // Check ports: 8883 (MQTT), 322 (RTSPS), 6000 (Bambu Stream), 80/8080/7125 (Web/Klipper)
  const ports = [8883, 322, 6000, 80, 8080, 7125];
  const portResults: Record<number, boolean> = {};
  for (const port of ports) {
    portResults[port] = await checkPort(p.host, port);
  }
  console.log('Ports open:', portResults);

  if (portResults[322]) {
    console.log(`Port 322 (RTSPS) is OPEN on ${p.name}! Testing ffmpeg snapshot...`);
    const rtspUrl = `rtsps://bblp:${p.access_code}@${p.host}:322/streaming/live/1`;
    await new Promise<void>((resolve) => {
      exec(
        `/opt/homebrew/bin/ffmpeg -y -rtsp_transport tcp -t 3 -i "${rtspUrl}" -vframes 1 -q:v 3 "/tmp/test_${p.id}.jpg"`,
        {
          env: {
            ...process.env,
            http_proxy: '',
            https_proxy: '',
            all_proxy: '',
            HTTP_PROXY: '',
            HTTPS_PROXY: '',
            ALL_PROXY: '',
          },
          timeout: 4000,
        },
        (err, stdout, stderr) => {
          if (err) {
            console.log(`FFmpeg failed: ${err.message}`);
          } else {
            console.log(`SUCCESS! Snapshot captured for ${p.name}`);
          }
          resolve();
        }
      );
    });
  }

  if (p.adapter_type === 'snapmaker') {
    console.log('Checking snapmaker webcam URLs...');
    for (const ep of [`http://${p.host}:${p.port}/webcam/?action=snapshot`, `http://${p.host}:8080/?action=snapshot`, `http://${p.host}/webcam/?action=snapshot`]) {
      try {
        const res = await fetch(ep, { signal: AbortSignal.timeout(1000) });
        console.log(`Endpoint ${ep}: status ${res.status}`);
      } catch (e: any) {
        console.log(`Endpoint ${ep}: failed (${e.message})`);
      }
    }
  }
}

async function run() {
  for (const p of printers) {
    await testPrinter(p);
  }
}

run();
