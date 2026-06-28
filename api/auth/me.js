const { appendSetCookie, sendJson } = require('../_lib/http');
const { createClearedSessionCookie, parseSession } = require('../_lib/session');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const session = parseSession(req);
    if (!session) {
      appendSetCookie(res, createClearedSessionCookie());
      return sendJson(res, 200, { authenticated: false });
    }

    return sendJson(res, 200, {
      authenticated: true,
      user: session.user || null,
    });
  } catch {
    return sendJson(res, 200, { authenticated: false });
  }
};
