import { URL } from 'node:url';
import { impexiumClient, ImpexiumAuthError } from './impexium.js';
import {
  SESSION_COOKIE_NAME,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  publicUser,
} from './session.js';

const SAFE_REDIRECT_DEFAULT = '/';

function baseUrlFromRequest(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'http').toString().split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost').toString();
  return `${proto}://${host}`;
}

function sendRedirect(res, location, status = 302) {
  res.writeHead(status, { Location: location });
  res.end();
}

function sanitizeRedirect(target, base) {
  if (!target) return SAFE_REDIRECT_DEFAULT;
  try {
    const u = new URL(target, base);
    if (u.origin !== new URL(base).origin) return SAFE_REDIRECT_DEFAULT;
    return u.pathname + u.search + u.hash;
  } catch {
    return SAFE_REDIRECT_DEFAULT;
  }
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

/** GET /api/auth/login?redirect=/some/path → bounce to Impexium hosted login */
async function handleLogin(req, res, url) {
  try {
    const base = baseUrlFromRequest(req);
    const redirect = sanitizeRedirect(url.searchParams.get('redirect'), base);
    const callback = new URL('/api/auth/callback', base);
    callback.searchParams.set('redirect', redirect);
    const loginUrl = impexiumClient.getRedirectLoginUrl(callback.toString());
    sendRedirect(res, loginUrl);
  } catch (err) {
    console.error('login redirect failed:', err);
    sendRedirect(res, '/login?error=config');
  }
}

/** GET /api/auth/callback?UserId=...&sso=...&redirect=... */
async function handleCallback(req, res, url) {
  const base = baseUrlFromRequest(req);
  const userId = url.searchParams.get('UserId');
  const ssoToken = url.searchParams.get('sso') || url.searchParams.get('ssoToken') || url.searchParams.get('SSOToken');
  const redirect = sanitizeRedirect(url.searchParams.get('redirect'), base);

  if (!userId || !ssoToken) {
    return sendRedirect(res, '/login?error=missing_token');
  }

  try {
    const user = await impexiumClient.validateSsoCallback(userId, ssoToken);
    const token = await createSession(user);
    setSessionCookie(req, res, token);
    sendRedirect(res, redirect);
  } catch (err) {
    console.error('callback failed:', err);
    if (err instanceof ImpexiumAuthError) {
      const msg = err.message.toLowerCase();
      if (msg.includes('not approved')) return sendRedirect(res, '/login?error=not_approved');
      if (msg.includes('no active membership')) return sendRedirect(res, '/login?error=no_membership');
      if (msg.includes('mismatch')) return sendRedirect(res, '/login?error=user_mismatch');
      return sendRedirect(res, '/login?error=invalid_token');
    }
    sendRedirect(res, '/login?error=sso_failed');
  }
}

/** GET /api/auth/me */
async function handleMe(req, res) {
  const session = await getSession(req);
  if (!session) return sendJson(res, 200, { authenticated: false, user: null });
  sendJson(res, 200, { authenticated: true, user: publicUser(session) });
}

/** POST or GET /api/auth/logout */
async function handleLogout(req, res) {
  clearSessionCookie(req, res);
  sendRedirect(res, '/login');
}

/** GET /api/auth/dev-login — only available outside production. Fakes a session. */
async function handleDevLogin(req, res, url) {
  if (process.env.NODE_ENV === 'production') {
    return sendJson(res, 403, { error: 'dev-login disabled in production' });
  }
  const customerId = url.searchParams.get('id') || 'dev-user-1';
  const user = {
    customerId,
    recordNumber: 'DEV-' + customerId,
    email: `${customerId}@dev.local`,
    firstName: 'Dev',
    lastName: 'User',
    accessLevel: 'member',
    membershipType: 'DEV',
    impexiumSsoToken: 'dev-token',
  };
  const token = await createSession(user);
  setSessionCookie(req, res, token);
  sendRedirect(res, '/');
}

const ROUTES = {
  '/api/auth/login': handleLogin,
  '/api/auth/callback': handleCallback,
  '/api/auth/me': handleMe,
  '/api/auth/logout': handleLogout,
  '/api/auth/dev-login': handleDevLogin,
};

/**
 * Try to handle an auth route. Returns true if handled, false otherwise so
 * the main server can fall through to its next router.
 */
export async function tryHandleAuth(req, res) {
  const url = new URL(req.url, 'http://_');
  const handler = ROUTES[url.pathname];
  if (!handler) return false;
  await handler(req, res, url);
  return true;
}
