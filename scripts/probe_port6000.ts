import net from 'node:net';

const host = '192.168.10.121'; // P1S_3
const port = 6000;
const accessCode = '17118419';

console.log(`Connecting to ${host}:${port}...`);
const client = new net.Socket();

client.setTimeout(4000);

client.connect(port, host, () => {
  console.log('Connected! Waiting for data or sending handshake...');
});

client.on('data', (data) => {
  console.log(`Received ${data.length} bytes:`, data.subarray(0, 64).toString('hex'));
});

client.on('timeout', () => {
  console.log('Timeout. No data received.');
  client.destroy();
});

client.on('error', (err) => {
  console.log('Error:', err.message);
});

client.on('close', () => {
  console.log('Connection closed.');
});
