const crypto = require('crypto');
const { parseCookies, serializeCookie } = require('./http');

const SESSION_COOKIE = 'cocotama_session';
const OAUTH_COOKIE = 'cocotama_x_oauth';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const OAUTH_TTL_SECONDS = 60 * 10;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function requireSessionSecret() {
  if (!process.env.SESSION_SECRET) {
    throw new Error('Missing SESSION_SECRET');
  }
  return process.env.SESSION_SECRET;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = normalized + (pad ? '='.repeat(4 - pad) : '');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function encodeSignedPayload(payload, secret) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

function decodeSignedPayload(raw, secret) {
  if (!raw || typeof raw !== 'string' || !raw.includes('.')) {
    return null;
  }
  const [body, sig] = raw.split('.', 2);
  if (!body || !sig) {
    return null;
  }
  const expected = sign(body, secret);
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }
  try {
    return JSON.parse(base64UrlDecode(body));
  } catch {
    return null;
  }
}

function parseSession(req) {
  const secret = requireSessionSecret();
  const cookies = parseCookies(req);
  const payload = decodeSignedPayload(cookies[SESSION_COOKIE], secret);
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  if (!payload.expiresAt || Number(payload.expiresAt) < Date.now()) {
    return null;
  }
  return payload;
}

function createSessionCookie(sessionData, maxAge = SESSION_TTL_SECONDS) {
  const secret = requireSessionSecret();
  const payload = {
    ...sessionData,
    expiresAt: sessionData.expiresAt || Date.now() + maxAge * 1000,
  };
  const encoded = encodeSignedPayload(payload, secret);
  return serializeCookie(SESSION_COOKIE, encoded, {
    maxAge,
    secure: isProduction(),
  });
}

function createClearedSessionCookie() {
  return serializeCookie(SESSION_COOKIE, '', {
    maxAge: 0,
    secure: isProduction(),
  });
}

function createOAuthCookie(state, codeVerifier, maxAge = OAUTH_TTL_SECONDS) {
  const secret = requireSessionSecret();
  const payload = {
    state,
    codeVerifier,
    expiresAt: Date.now() + maxAge * 1000,
  };
  const encoded = encodeSignedPayload(payload, secret);
  return serializeCookie(OAUTH_COOKIE, encoded, {
    maxAge,
    secure: isProduction(),
  });
}

function parseOAuthCookie(req) {
  const secret = requireSessionSecret();
  const cookies = parseCookies(req);
  const payload = decodeSignedPayload(cookies[OAUTH_COOKIE], secret);
  if (!payload || Number(payload.expiresAt) < Date.now()) {
    return null;
  }
  return payload;
}

function createClearedOAuthCookie() {
  return serializeCookie(OAUTH_COOKIE, '', {
    maxAge: 0,
    secure: isProduction(),
  });
}

module.exports = {
  createClearedOAuthCookie,
  createClearedSessionCookie,
  createOAuthCookie,
  createSessionCookie,
  parseOAuthCookie,
  parseSession,
};
