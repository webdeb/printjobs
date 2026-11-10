import crypto from 'node:crypto';
import net from 'node:net';
import type { Context, Next } from 'hono';

/**
 * Validates a printer host (IPv4 or RFC-1123 hostname) and blocks loopback,
 * link-local (cloud metadata), unspecified, and multicast/broadcast addresses
 * to prevent SSRF and command/URI injection.
 */
export function validatePrinterHost(rawHost: unknown): { valid: boolean; host: string; reason?: string } {
  if (typeof rawHost !== 'string') {
    return { valid: false, host: '', reason: 'Host muss ein Textwert sein.' };
  }

  const host = rawHost.trim();
  if (!host || host.length > 253) {
    return { valid: false, host: '', reason: 'Ungültige Host-Länge.' };
  }

  const lower = host.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '[::1]' ||
    lower === '::'
  ) {
    return { valid: false, host: '', reason: 'Loopback- und lokale Host-Adressen sind nicht erlaubt.' };
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map(Number);
    const [a, b] = parts;
    // Block 0.0.0.0/8, 127.0.0.0/8 (loopback), 169.254.0.0/16 (link-local / metadata), 224.0.0.0/4+ (multicast/reserved)
    if (a === 0 || a === 127 || (a === 169 && b === 254) || a >= 224) {
      return { valid: false, host: '', reason: 'Reservierte oder interne Loopback-IP-Adresse ist nicht erlaubt.' };
    }
    return { valid: true, host };
  }

  if (ipVersion === 6) {
    if (lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('ff')) {
      return { valid: false, host: '', reason: 'Reservierte IPv6-Adresse ist nicht erlaubt.' };
    }
    return { valid: true, host };
  }

  // Strictly validate RFC-1123 hostname (alphanumeric, hyphens, dots only - no URI/shell chars)
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!hostnameRegex.test(host)) {
    return { valid: false, host: '', reason: 'Ungültiges Hostname- oder IP-Format.' };
  }

  return { valid: true, host };
}

export function validatePort(rawPort: unknown, defaultPort = 8883): number | null {
  if (rawPort === undefined || rawPort === null || rawPort === '') {
    return defaultPort;
  }
  const num = Number(rawPort);
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    return null;
  }
  return num;
}

/**
 * Validates printer LAN access codes / API keys.
 * Allows only safe alphanumeric characters, dashes, underscores, and dots.
 */
export function validateAccessCode(rawCode: unknown): { valid: boolean; code: string; reason?: string } {
  if (rawCode === undefined || rawCode === null || rawCode === '') {
    return { valid: true, code: '' };
  }
  if (typeof rawCode !== 'string') {
    return { valid: false, code: '', reason: 'Access Code muss ein Textwert sein.' };
  }
  const code = rawCode.trim();
  if (code.length > 64) {
    return { valid: false, code: '', reason: 'Access Code ist zu lang (max. 64 Zeichen).' };
  }
  if (!/^[a-zA-Z0-9._-]*$/.test(code)) {
    return { valid: false, code: '', reason: 'Access Code enthält unerlaubte Sonderzeichen.' };
  }
  return { valid: true, code };
}

/**
 * Masks email addresses in public API responses to protect Makerspace member PII.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  if (email.endsWith('@makerspace.local')) {
    return 'MeTe Mitglied';
  }
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return '***';
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const visibleLocal = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visibleLocal}***@${domain}`;
}

export function isAdminPinConfigured(): boolean {
  return Boolean(process.env.ADMIN_PIN && process.env.ADMIN_PIN.trim().length > 0);
}

export function verifyAdminPin(candidate: string | undefined | null): boolean {
  const expected = process.env.ADMIN_PIN?.trim();
  if (!expected) return true; // Open mode if ADMIN_PIN is not configured
  if (!candidate) return false;

  const a = Buffer.from(candidate.trim(), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Middleware to protect administrative / destructive routes when ADMIN_PIN is set.
 */
export async function requireAdminPin(c: Context, next: Next) {
  if (!isAdminPinConfigured()) {
    return next();
  }
  const headerPin = c.req.header('x-admin-pin');
  if (!verifyAdminPin(headerPin)) {
    return c.json({ error: 'Admin-PIN erforderlich oder ungültig.', adminPinRequired: true }, 401);
  }
  return next();
}

/**
 * Protects internal LAN API against drive-by cross-site browser attacks (CSRF / Private Network Access).
 */
export async function lanBrowserGuard(c: Context, next: Next) {
  const isDev = process.env.NODE_ENV !== 'production';

  // 1. Block cross-site requests flagged by modern browsers via Fetch Metadata
  const secFetchSite = c.req.header('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return c.json({ error: 'Cross-site requests are forbidden' }, 403);
  }

  // 2. For mutating requests, validate Origin header if present
  const method = c.req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const origin = c.req.header('origin');
    const host = c.req.header('host');
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        const isDevOrigin = isDev && (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1');
        if (originUrl.host !== host && !isDevOrigin) {
          return c.json({ error: 'Cross-origin write request rejected' }, 403);
        }
      } catch {
        return c.json({ error: 'Invalid Origin header' }, 403);
      }
    }
  }

  return next();
}
