import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { subscribeToEvents } from '../services/jobTracker.ts';

export const eventsRouter = new Hono();

const MAX_SSE_CLIENTS = 60;
let activeSseClients = 0;

eventsRouter.get('/', (c) => {
  if (activeSseClients >= MAX_SSE_CLIENTS) {
    return c.json({ error: 'Too many concurrent event streams' }, 429);
  }

  activeSseClients++;
  return streamSSE(c, async (stream) => {
    let cleanedUp = false;
    let pingInterval: NodeJS.Timeout | undefined;
    let unsubscribe: (() => void) | undefined;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      activeSseClients = Math.max(0, activeSseClients - 1);
      if (pingInterval) clearInterval(pingInterval);
      if (unsubscribe) unsubscribe();
    };

    try {
      await stream.writeSSE({
        event: 'connected',
        data: JSON.stringify({ timestamp: new Date().toISOString() }),
      });

      unsubscribe = subscribeToEvents(async (event) => {
        try {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.data),
          });
        } catch {
          cleanup();
        }
      });

      // Heartbeat ping every 20 seconds
      pingInterval = setInterval(async () => {
        try {
          await stream.writeSSE({
            event: 'ping',
            data: JSON.stringify({ time: Date.now() }),
          });
        } catch {
          cleanup();
        }
      }, 20000);

      stream.onAbort(cleanup);

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          cleanup();
          resolve();
        });
      });
    } finally {
      cleanup();
    }
  });
});
