import { SignJWT, jwtVerify } from 'jose';

const JWT_ISSUER = 'asla-lareprep';
const JWT_AUDIENCE = 'asla-lareprep';
const MAX_SESSION_DURATION = '8h';
export const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 chars');
  return new TextEncoder().encode(secret);
}

export async function signToken(user) {
  const payload = { ...user, lastActivity: Date.now() };
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

export async function refreshToken(payload) {
  const { iat, exp, iss, aud, ...user } = payload;
  return signToken(user);
}
