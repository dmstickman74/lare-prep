import { signToken, verifyToken, refreshToken, isInactivityTimeout, isAbsoluteTimeout } from './jwt.js';

export const SESSION_COOKIE_NAME = 'asla_lareprep_session';

const COOKIE_BASE = {
  path: '/',
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 60 * 60 * 8, // 8h
};

function formatCookie(name, value, opts) {
  const parts = [`${name}=${value}`];
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

function isSecureRequest(req) {
  if (process.env.NODE_ENV !== 'production') return false;
  /* Caddy terminates TLS and proxies over HTTP, so trust the forwarded header. */
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') return proto.split(',')[0].trim() === 'https';
  return false;
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function setSessionCookie(req, res, token) {
  res.setHeader(
    'Set-Cookie',
    formatCookie(SESSION_COOKIE_NAME, encodeURIComponent(token), {
      ...COOKIE_BASE,
      secure: isSecureRequest(req),
    })
  );
}

export function clearSessionCookie(req, res) {
  res.setHeader(
    'Set-Cookie',
    formatCookie(SESSION_COOKIE_NAME, '', {
      ...COOKIE_BASE,
      maxAge: 0,
      secure: isSecureRequest(req),
    })
  );
}

/**
 * Resolve the current session from a request. Returns the JWT payload or null.
 * Caller is responsible for treating null as "not authenticated".
 */
export async function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  if (isInactivityTimeout(payload)) return null;
  if (isAbsoluteTimeout(payload)) return null;
  return payload;
}

/**
 * Re-sign the session JWT with a fresh lastActivity and update the cookie.
 * Call this from authenticated routes so the inactivity window slides forward.
 */
export async function slideSession(req, res, payload) {
  const next = await refreshToken(payload);
  setSessionCookie(req, res, next);
}

export async function createSession(user) {
  return signToken(user);
}

/** Strip sensitive fields when sending to the client */
export function publicUser(payload) {
  const { customerId, recordNumber, email, firstName, lastName, accessLevel, membershipType } = payload;
  return { customerId, recordNumber, email, firstName, lastName, accessLevel, membershipType };
}
