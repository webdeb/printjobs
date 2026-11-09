import { db } from '../db/database.ts';

export interface MaterialPrices {
  [material: string]: number; // price in EUR per 100g
}

export const DEFAULT_PRICES: MaterialPrices = {
  'PLA': 2.50,
  'PLA Matte': 2.50,
  'PLA-CF': 4.00,
  'PETG': 2.80,
  'ABS': 3.00,
  'TPU': 3.50,
  'Standard': 2.50,
};

export function getMaterialPrices(): MaterialPrices {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'material_prices_json'").get() as any;
    if (row && row.value) {
      return { ...DEFAULT_PRICES, ...JSON.parse(row.value) };
    }
  } catch {}
  return { ...DEFAULT_PRICES };
}

export function saveMaterialPrices(prices: MaterialPrices): void {
  const json = JSON.stringify(prices);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('material_prices_json', ?)").run(json);
}

export function calculateCostCents(materialType: string, grams: number): number {
  const prices = getMaterialPrices();
  const cleanType = (materialType || '').trim().toUpperCase();

  let pricePer100g = prices['Standard'] || 2.50;

  // Check specific keys
  if (cleanType.includes('CF') || cleanType.includes('CARBON')) {
    pricePer100g = prices['PLA-CF'] || 4.00;
  } else if (cleanType.includes('PETG')) {
    pricePer100g = prices['PETG'] || 2.80;
  } else if (cleanType.includes('TPU') || cleanType.includes('FLEX')) {
    pricePer100g = prices['TPU'] || 3.50;
  } else if (cleanType.includes('ABS') || cleanType.includes('ASA')) {
    pricePer100g = prices['ABS'] || 3.00;
  } else if (cleanType.includes('MATTE')) {
    pricePer100g = prices['PLA Matte'] || prices['PLA'] || 2.50;
  } else if (cleanType.includes('PLA')) {
    pricePer100g = prices['PLA'] || 2.50;
  }

  // Cost in cents: (grams / 100) * pricePer100g * 100 = grams * pricePer100g
  return Math.max(0, Math.round(grams * pricePer100g));
}

export function estimateJobGrams(jobName: string, totalLayers?: number, remainingMinutes?: number): number {
  if (!jobName) return 40.0;

  // 1. Check if filename contains grams (e.g. "Bracket_45g.3mf", "part_28.5g.gcode")
  const gramMatch = jobName.match(/(\d+(?:\.\d+)?)\s*(?:g|gramm?|gr)\b/i);
  if (gramMatch && Number(gramMatch[1]) > 0 && Number(gramMatch[1]) < 2000) {
    return Math.round(Number(gramMatch[1]) * 10) / 10;
  }

  // 2. Layer count: average ~0.22g per layer (e.g. 200 layers = 44g)
  if (totalLayers && totalLayers > 0 && totalLayers < 5000) {
    return Math.round(totalLayers * 0.22 * 10) / 10;
  }

  // 3. Print duration estimate: average ~22g per print hour
  if (remainingMinutes && remainingMinutes > 0 && remainingMinutes < 10000) {
    const hours = remainingMinutes / 60;
    return Math.round(Math.max(12, hours * 22) * 10) / 10;
  }

  // 4. Stable deterministic hash from filename so the same model always gets the exact same consistent weight (between 30g and 85g)
  let hash = 0;
  for (let i = 0; i < jobName.length; i++) {
    hash = (hash << 5) - hash + jobName.charCodeAt(i);
    hash |= 0;
  }
  const variance = Math.abs(hash % 550) / 10; // 0.0 to 55.0
  return Math.round((30 + variance) * 10) / 10; // 30g to 85g
}
