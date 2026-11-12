// Authentication helpers: password hashing, JWT sessions, cookies, and
// small request/response utilities shared by every API route.
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './db.js';

const COOKIE_NAME = 'denkerai_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const BCRYPT_COST = 12;

/** The signing key is read lazily so a missing secret fails loudly at request time. */
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long.');
  }
  return new TextEncoder().encode(secret);
}

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_COST);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

/** Creates a signed JWT that carries only the user id. */
export async function signSession(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

/** Writes the session cookie: httpOnly, Secure, SameSite=Lax, 30 days. */
export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

/** Minimal cookie parser so we do not need an extra dependency. */
function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/** Returns the logged-in user (without the password hash) or null. */
export async function getUser(req) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, level: true, levelSource: true },
    });
  } catch {
    return null; // expired, tampered or malformed token
  }
}

// ---------- Request helpers ----------

/** Sends a JSON response. */
export function json(res, status, body) {
  res.status(status).json(body);
}

/** Rejects the request unless it uses one of the allowed HTTP methods. */
export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  json(res, 405, { error: 'Method not allowed.' });
  return false;
}

/**
 * Wraps a handler so it only runs for logged-in users and so unexpected
 * errors become a clean 500 instead of leaking stack traces.
 */
export function withUser(handler) {
  return async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user) return json(res, 401, { error: 'Please log in.' });
      return await handler(req, res, user);
    } catch (err) {
      console.error(err);
      return json(res, 500, { error: 'Something went wrong. Please try again.' });
    }
  };
}

/** Same error wrapper for public routes (signup, login, logout). */
export function safe(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(err);
      return json(res, 500, { error: 'Something went wrong. Please try again.' });
    }
  };
}

/** Trims a value to a plain string of at most maxLen characters. */
export function cleanString(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLen);
}

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
