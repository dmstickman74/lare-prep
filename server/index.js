import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { tryHandleAuth } from './auth/routes.js';
import { getSession, slideSession } from './auth/session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '4001', 10);
const HOST = process.env.HOST || '127.0.0.1';
const STATIC_ROOT = process.env.STATIC_ROOT
  ? path.resolve(process.env.STATIC_ROOT)
  : null;
const MAX_BODY_BYTES = 256 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
};

/* Paths reachable without a session. Everything else gates on auth. */
const PUBLIC_PATH_PREFIXES = ['/api/auth/', '/assets/', '/css/', '/fonts/', '/js/'];
const PUBLIC_PATHS_EXACT = new Set(['/login', '/login.html', '/robots.txt', '/healthz']);

function isPublicPath(p) {
  if (PUBLIC_PATHS_EXACT.has(p)) return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => p.startsWith(prefix));
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

pool.on('error', (err) => {
  console.error('pg pool error:', err);
});

function send(res, status, body, headers = {}) {
  const json = body == null ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(json);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

async function getProgress(req, res, userId) {
  const { rows } = await pool.query(
    'SELECT data FROM progress WHERE user_id = $1',
    [userId],
  );
  send(res, 200, rows[0]?.data ?? {});
}

async function putProgress(req, res, userId) {
  const body = await readJsonBody(req);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return send(res, 400, { error: 'body must be a JSON object' });
  }
  const { rows } = await pool.query(
    `INSERT INTO progress (user_id, data)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET data = EXCLUDED.data, updated_at = now()
     RETURNING data`,
    [userId, JSON.stringify(body)],
  );
  send(res, 200, rows[0].data);
}

async function deleteProgress(req, res, userId) {
  await pool.query('DELETE FROM progress WHERE user_id = $1', [userId]);
  send(res, 204, null);
}

async function serveStatic(req, res) {
  if (!STATIC_ROOT) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  /* Strip query string, normalize, and resolve under STATIC_ROOT to defeat traversal */
  const urlPath = decodeURIComponent((req.url.split('?')[0] || '/'));
  /* /login → login.html; / → index.html */
  let rel;
  if (urlPath === '/') rel = 'index.html';
  else if (urlPath === '/login') rel = 'login.html';
  else rel = urlPath.replace(/^\/+/, '');
  const resolved = path.resolve(STATIC_ROOT, rel);
  if (!resolved.startsWith(STATIC_ROOT + path.sep) && resolved !== STATIC_ROOT) {
    return false;
  }

  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    return false;
  }
  if (stat.isDirectory()) return false;

  const ext = path.extname(resolved).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const body = await fs.readFile(resolved);
  const isHashed = /\/(assets|fonts|css|js)\//.test(urlPath) && ext !== '.html';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': body.length,
    'Cache-Control': isHashed ? 'public, max-age=604800' : 'no-cache',
  });
  res.end(req.method === 'HEAD' ? '' : body);
  return true;
}

function redirectToLogin(req, res, pathOnly, search) {
  const loginUrl = '/login?redirect=' + encodeURIComponent(pathOnly + (search || ''));
  res.writeHead(302, { Location: loginUrl });
  res.end();
}

const server = http.createServer(async (req, res) => {
  try {
    const [pathOnly, query = ''] = (req.url || '/').split('?');
    const search = query ? '?' + query : '';

    if (pathOnly === '/healthz') {
      await pool.query('SELECT 1');
      return send(res, 200, { ok: true });
    }

    /* Auth routes are public — they handle their own logic */
    if (pathOnly.startsWith('/api/auth/')) {
      if (await tryHandleAuth(req, res)) return;
      return send(res, 404, { error: 'not found' });
    }

    /* /api/progress requires a session */
    if (pathOnly === '/api/progress') {
      const session = await getSession(req);
      if (!session) return send(res, 401, { error: 'not authenticated' });

      if (req.method === 'GET') {
        await getProgress(req, res, session.customerId);
      } else if (req.method === 'PUT') {
        await putProgress(req, res, session.customerId);
      } else if (req.method === 'DELETE') {
        await deleteProgress(req, res, session.customerId);
      } else {
        res.setHeader('Allow', 'GET, PUT, DELETE');
        return send(res, 405, { error: 'method not allowed' });
      }

      /* Slide the inactivity window — fire-and-forget, header is set before res.end */
      /* (handlers above call res.end synchronously after writeHead, so this is too late
         to attach Set-Cookie. Skipping refresh on /api/progress is fine — it'll slide
         on the next /api/auth/me poll.) */
      return;
    }

    /* Other API paths are 404 (or you can add more here later) */
    if (pathOnly.startsWith('/api/')) {
      return send(res, 404, { error: 'not found' });
    }

    /* Static / page paths: gate everything except the public allow-list */
    if (!isPublicPath(pathOnly)) {
      const session = await getSession(req);
      if (!session) return redirectToLogin(req, res, pathOnly, search);
    }

    if (await serveStatic(req, res)) return;
    return send(res, 404, { error: 'not found' });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('request error:', err);
    send(res, status, { error: err.message || 'server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`lareprep-api listening on http://${HOST}:${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
