import { SignJWT, jwtVerify } from 'jose';

const JWT_ISSUER = 'asla-lareprep';
const JWT_AUDIENCE = 'asla-lareprep';
const MAX_SESSION_DURATION = '8h';
export const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const MAX_SESSION_MS = 8 * 60 * 60 * 1000;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 chars');
  return new TextEncoder().encode(secret);
}

/**
 * Sign a fresh session token. Sets sessionStart to now — this is the absolute
 * cap that refreshToken preserves so a chronically-active user can't extend
 * past MAX_SESSION_MS by sliding the inactivity window.
 *
 * (The canonical Next.js impl at member_survey_app has a latent bug here:
 *  refreshToken calls signToken which resets exp from now, so the 8h cap
 *  never bites for active users. We diverge from canonical to fix it.)
 */
export async function signToken(user) {
  const payload = {
    ...user,
    sessionStart: user.sessionStart || Date.now(),
    lastActivity: Date.now(),
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(MAX_SESSION_DURATION)
    .sign(getSecret());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload;
  } catch (err) {
    console.error('jwt verify failed:', err.message);
    return null;
  }
}

export function isInactivityTimeout(payload) {
  return Date.now() - (payload.lastActivity || 0) > INACTIVITY_TIMEOUT_MS;
}

export function isAbsoluteTimeout(payload) {
  return Date.now() - (payload.sessionStart || 0) > MAX_SESSION_MS;
}

export async function refreshToken(payload) {
  const { iat, exp, iss, aud, lastActivity, ...user } = payload;
  /* sessionStart preserved via the spread — signToken won't overwrite it. */
  return signToken(user);
}
