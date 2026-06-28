const {
  buildAuthorizeUrl,
  createCodeChallenge,
  createCodeVerifier,
  createState,
  requireEnv,
} = require('../../_lib/x');
const { appendSetCookie, getAppBaseUrl, redirect, sendJson } = require('../../_lib/http');
const { createOAuthCookie } = require('../../_lib/session');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const state = createState();
    const codeVerifier = createCodeVerifier();
    const codeChallenge = createCodeChallenge(codeVerifier);
    const clientId = requireEnv('X_CLIENT_ID');
    const appBaseUrl = getAppBaseUrl(req);
    const redirectUri = process.env.X_REDIRECT_URI || `${appBaseUrl}/api/auth/x/callback`;
    const authorizeUrl = buildAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
    });

    appendSetCookie(res, createOAuthCookie(state, codeVerifier));
    return redirect(res, authorizeUrl);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Failed to start X login' });
  }
};
