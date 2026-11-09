import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { subscribeToEvents } from '../services/jobTracker.ts';

export const eventsRouter = new Hono();

eventsRouter.get('/', (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial connected event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ timestamp: new Date().toISOString() }),
    });

    const unsubscribe = subscribeToEvents(async (event) => {
      try {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event.data),
        });
      } catch {
        // Stream may have closed
      }
    });

    // Heartbeat ping every 20 seconds
    const pingInterval = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: 'ping',
          data: JSON.stringify({ time: Date.now() }),
        });
      } catch {
        clearInterval(pingInterval);
      }
    }, 20000);

    // Clean up when client disconnects
    stream.onAbort(() => {
      clearInterval(pingInterval);
      unsubscribe();
    });

    // Keep stream open
    await new Promise<void>((resolve) => {
      stream.onAbort(resolve);
    });
  });
});
