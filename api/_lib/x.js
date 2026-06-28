const crypto = require('crypto');

const X_AUTH_ENDPOINT = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN_ENDPOINT = 'https://api.x.com/2/oauth2/token';
const X_ME_ENDPOINT = 'https://api.x.com/2/users/me?user.fields=name,username,description,location';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function createState() {
  return crypto.randomBytes(16).toString('base64url');
}

function createCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function createCodeChallenge(codeVerifier) {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

function getScopes() {
  return process.env.X_SCOPES || 'users.read';
}

function buildAuthorizeUrl({ clientId, redirectUri, state, codeChallenge }) {
  const url = new URL(X_AUTH_ENDPOINT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', getScopes());
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function exchangeCodeForToken({ code, codeVerifier, redirectUri }) {
  const clientId = requireEnv('X_CLIENT_ID');
  const clientSecret = process.env.X_CLIENT_SECRET;
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
  }

  const response = await fetch(X_TOKEN_ENDPOINT, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X token exchange failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function fetchXMe(accessToken) {
  const response = await fetch(X_ME_ENDPOINT, {
    headers: {
      Authorization: 'Bearer ' + accessToken,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X profile fetch failed: ${response.status} ${text}`);
  }

  const json = await response.json();
  return json?.data || null;
}

module.exports = {
  buildAuthorizeUrl,
  createCodeChallenge,
  createCodeVerifier,
  createState,
  exchangeCodeForToken,
  fetchXMe,
  requireEnv,
};
