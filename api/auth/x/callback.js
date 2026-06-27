const { appendSetCookie, getAppBaseUrl, redirect, sendJson } = require('../../_lib/http');
const { createClearedOAuthCookie, createSessionCookie, parseOAuthCookie } = require('../../_lib/session');
const { exchangeCodeForToken, fetchXMe } = require('../../_lib/x');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const appBaseUrl = getAppBaseUrl(req);
  const callbackUrl = new URL(req.url, appBaseUrl);
  const code = callbackUrl.searchParams.get('code');
  const state = callbackUrl.searchParams.get('state');
  const oauthError = callbackUrl.searchParams.get('error');

  if (oauthError) {
    return redirect(res, `${appBaseUrl}/?fortune_error=${encodeURIComponent(oauthError)}`);
  }

  try {
    const oauthSession = parseOAuthCookie(req);
    appendSetCookie(res, createClearedOAuthCookie());

    if (!oauthSession || oauthSession.state !== state || !code) {
      return redirect(res, `${appBaseUrl}/?fortune_error=invalid_auth_state`);
    }

    const redirectUri = process.env.X_REDIRECT_URI || `${appBaseUrl}/api/auth/x/callback`;
    const token = await exchangeCodeForToken({
      code,
      codeVerifier: oauthSession.codeVerifier,
      redirectUri,
    });

    const xUser = await fetchXMe(token.access_token);
    const expiresIn = Number(token.expires_in) || 3600;
    const sessionPayload = {
      accessToken: token.access_token,
      tokenType: token.token_type || 'bearer',
      expiresAt: Date.now() + expiresIn * 1000,
      user: xUser
        ? {
            id: xUser.id,
            name: xUser.name,
            username: xUser.username,
            description: xUser.description || '',
            location: xUser.location || '',
          }
        : null,
    };

    appendSetCookie(res, createSessionCookie(sessionPayload, Math.min(expiresIn, 60 * 60 * 12)));
    return redirect(res, `${appBaseUrl}/?fortune_auth=success`);
  } catch (error) {
    return redirect(res, `${appBaseUrl}/?fortune_error=${encodeURIComponent('auth_failed')}`);
  }
};
