import { db } from '../db/database.ts';
import { broadcastEvent } from './jobTracker.ts';

const METE_URL = process.env.METE_URL || '';

export interface MeteUser {
  id: string;
  name: string;
  avatar_url?: string;
  email?: string;
}

export async function fetchMeteUsers(): Promise<MeteUser[]> {
  if (!METE_URL) {
    throw new Error('METE_URL is not configured.');
  }
  const url = `${METE_URL}/users`;
  console.log(`[MeTeSync] Fetching users from ${url}...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'PrintJobs-Makerspace-Sync/1.0',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`MeTe responded with status ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  const cardRegex = /<a\s+title="([^"]+)"\s+href="\/users\/(\d+)"[^>]*>[\s\S]*?<div class="card user-card[^>]*>([\s\S]*?)<\/div>\s*<\/a>/g;
  const users: MeteUser[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = cardRegex.exec(html)) !== null) {
    const name = match[1].trim();
    const id = match[2].trim();
    const innerHtml = match[3];

    let avatar_url: string | undefined = undefined;
    const imgMatch = innerHtml.match(/src="([^"]+)"/);
    if (imgMatch) {
      avatar_url = imgMatch[1].startsWith('/')
        ? `${METE_URL}${imgMatch[1]}`
        : imgMatch[1];
    }

    if (!seen.has(id)) {
      seen.add(id);
      users.push({
        id,
        name,
        avatar_url,
      });
    }
  }

  console.log(`[MeTeSync] Found ${users.length} unique users in MeTe.`);
  return users;
}

export async function syncMeteUsers(): Promise<{ success: boolean; total: number; added: number; updated: number }> {
  try {
    const meteUsers = await fetchMeteUsers();
    let added = 0;
    let updated = 0;
    const now = new Date().toISOString();

    const findByExternal = db.prepare('SELECT id, name, email FROM users WHERE external_id = ?');
    const findByName = db.prepare('SELECT id, external_id FROM users WHERE name = ?');
    const updateStmt = db.prepare(`
      UPDATE users 
      SET name = ?, avatar_url = ?, member_number = ?
      WHERE id = ?
    `);
    const linkStmt = db.prepare(`
      UPDATE users 
      SET external_id = ?, avatar_url = ?, member_number = ?
      WHERE id = ?
    `);
    const insertStmt = db.prepare(`
      INSERT INTO users (name, email, member_number, external_id, avatar_url, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);

    for (const mu of meteUsers) {
      const existingExt = findByExternal.get(mu.id) as any;
      const memberNumber = `MeTe #${mu.id}`;

      if (existingExt) {
        updateStmt.run(mu.name, mu.avatar_url || null, memberNumber, existingExt.id);
        updated++;
      } else {
        // Check if matching by name exists
        const existingName = findByName.get(mu.name) as any;
        if (existingName) {
          linkStmt.run(mu.id, mu.avatar_url || null, memberNumber, existingName.id);
          updated++;
        } else {
          // New member from MeTe
          const fallbackEmail = `mete-${mu.id}@makerspace.local`;
          insertStmt.run(
            mu.name,
            fallbackEmail,
            memberNumber,
            mu.id,
            mu.avatar_url || null,
            now
          );
          added++;
        }
      }
    }

    console.log(`[MeTeSync] Sync complete. Added: ${added}, Updated: ${updated}, Total: ${meteUsers.length}`);

    broadcastEvent('users_synced', {
      total: meteUsers.length,
      added,
      updated,
    });

    return {
      success: true,
      total: meteUsers.length,
      added,
      updated,
    };
  } catch (err: any) {
    console.error('[MeTeSync] Error during synchronization:', err.message);
    throw err;
  }
}

// Scheduled auto-sync
let syncInterval: NodeJS.Timeout | undefined;

export function startMeteAutoSync(intervalMinutes = 15): void {
  // Initial sync immediately in background
  syncMeteUsers().catch((err) => {
    console.warn('[MeTeSync] Initial auto-sync failed (is MeTe reachable?):', err.message);
  });

  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    syncMeteUsers().catch((err) => {
      console.warn('[MeTeSync] Periodic sync failed:', err.message);
    });
  }, intervalMinutes * 60 * 1000);
}
