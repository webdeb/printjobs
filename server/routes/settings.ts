import { Hono } from 'hono';
import { getMaterialPrices, saveMaterialPrices, MaterialPrices } from '../services/pricing.ts';
import { broadcastEvent } from '../services/jobTracker.ts';
import { requireAdminPin } from '../utils/security.ts';

export const settingsRouter = new Hono();

// Get material prices per 100g in EUR
settingsRouter.get('/prices', (c) => {
  const prices = getMaterialPrices();
  return c.json(prices);
});

// Update material prices per 100g in EUR (protected by ADMIN_PIN if configured)
settingsRouter.post('/prices', requireAdminPin, async (c) => {
  const body = await c.req.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Invalid prices format' }, 400);
  }

  const entries = Object.entries(body);
  if (entries.length > 50) {
    return c.json({ error: 'Too many material entries (max 50)' }, 400);
  }

  const updated: MaterialPrices = {};
  for (const [key, val] of entries) {
    const cleanKey = key.trim().slice(0, 40);
    const num = Number(val);
    if (cleanKey && !isNaN(num) && num >= 0 && num <= 1000) {
      updated[cleanKey] = Math.round(num * 100) / 100;
    }
  }

  saveMaterialPrices(updated);
  broadcastEvent('prices_updated', updated);

  return c.json({ success: true, prices: updated });
});
