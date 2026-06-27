const { readJsonBody, sendJson } = require('../_lib/http');
const { parseSession } = require('../_lib/session');
const { fetchXMe } = require('../_lib/x');
const {
  buildDeterministicFortune,
  generateFortuneWithAI,
  loadFortuneRules,
  normalizeFortuneOutput,
  scoreFortune,
} = require('../_lib/fortune');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    await readJsonBody(req).catch(() => ({}));

    const session = parseSession(req);
    if (!session?.accessToken) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }

    let profile = session.user || null;
    try {
      const fetched = await fetchXMe(session.accessToken);
      if (fetched) {
        profile = {
          id: fetched.id,
          name: fetched.name,
          username: fetched.username,
          description: fetched.description || '',
          location: fetched.location || '',
        };
      }
    } catch {
      // fallback to session user below
    }

    if (!profile) {
      return sendJson(res, 502, { error: 'Failed to retrieve X profile' });
    }

    const rules = await loadFortuneRules();
    const scored = scoreFortune({
      profile,
      rules,
    });

    const fallbackTemplate = buildDeterministicFortune({ profile, scored });
    let finalFortune = fallbackTemplate;

    try {
      const aiOutput = await generateFortuneWithAI({ profile, scored });
      finalFortune = normalizeFortuneOutput(aiOutput, fallbackTemplate);
    } catch {
      finalFortune = fallbackTemplate;
    }

    return sendJson(res, 200, {
      ok: true,
      fortune: {
        overall: finalFortune.overall,
        love: finalFortune.love,
        work: finalFortune.work,
        lucky_action: finalFortune.lucky_action,
        lucky_color: finalFortune.lucky_color,
      },
      meta: {
        fallbackUsed: Boolean(finalFortune.fallback),
        source: finalFortune.source,
        matchedKeywords: scored.matched.map((rule) => rule.keyword),
      },
      user: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Failed to generate fortune' });
  }
};
