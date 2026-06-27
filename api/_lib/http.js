function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : (forwardedProto || 'http');
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

function getAppBaseUrl(req) {
  const configured = process.env.APP_BASE_URL;
  return configured ? configured.replace(/\/$/, '') : getBaseUrl(req);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function redirect(res, location, statusCode = 302) {
  res.statusCode = statusCode;
  res.setHeader('Location', location);
  res.end();
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return {};
  }
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rawVal] = part.trim().split('=');
    if (!rawKey) {
      return acc;
    }
    acc[rawKey] = decodeURIComponent(rawVal.join('='));
    return acc;
  }, {});
}

function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }
  const values = Array.isArray(prev) ? prev.concat(cookie) : [prev, cookie];
  res.setHeader('Set-Cookie', values);
}

function serializeCookie(name, value, options = {}) {
  const attrs = [`${name}=${encodeURIComponent(value)}`];
  attrs.push(`Path=${options.path || '/'}`);
  if (typeof options.maxAge === 'number') {
    attrs.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  if (options.httpOnly !== false) {
    attrs.push('HttpOnly');
  }
  attrs.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.secure) {
    attrs.push('Secure');
  }
  return attrs.join('; ');
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

module.exports = {
  appendSetCookie,
  getAppBaseUrl,
  parseCookies,
  readJsonBody,
  redirect,
  sendJson,
  serializeCookie,
};
