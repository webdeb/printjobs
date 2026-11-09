import { Hono } from 'hono';
import { getMaterialPrices, saveMaterialPrices, MaterialPrices } from '../services/pricing.ts';
import { broadcastEvent } from '../services/jobTracker.ts';

export const settingsRouter = new Hono();

// Get material prices per 100g in EUR
settingsRouter.get('/prices', (c) => {
  const prices = getMaterialPrices();
  return c.json(prices);
});

// Update material prices per 100g in EUR
settingsRouter.post('/prices', async (c) => {
  const body = await c.req.json();
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid prices format' }, 400);
  }

  const updated: MaterialPrices = {};
  for (const [key, val] of Object.entries(body)) {
    const num = Number(val);
    if (!isNaN(num) && num >= 0) {
      updated[key] = Math.round(num * 100) / 100;
    }
  }

  saveMaterialPrices(updated);
  broadcastEvent('prices_updated', updated);

  return c.json({ success: true, prices: updated });
});
