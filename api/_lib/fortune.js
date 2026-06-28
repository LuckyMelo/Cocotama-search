const fs = require('fs/promises');
const path = require('path');

const RULES_PATH = path.join(process.cwd(), 'data', 'fortune_rules.csv');

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function cleanCell(cell) {
  const value = (cell || '').trim();
  if (!value || value === '0') {
    return '';
  }
  return value;
}

async function loadFortuneRules() {
  const text = await fs.readFile(RULES_PATH, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = lines.slice(1);
  const rules = [];

  rows.forEach((line, index) => {
    const cols = parseCsvLine(line);
    const row = {};

    headers.forEach((header, i) => {
      row[header] = cleanCell(cols[i] || '');
    });

    if (!row.keyword) {
      return;
    }

    const scoreNum = Number(row.score);
    rules.push({
      keyword: row.keyword.toLowerCase(),
      category: row.category || 'overall',
      score: Number.isFinite(scoreNum) && scoreNum > 0 ? scoreNum : 1,
      hint: row.hint || `${row.keyword}の力が味方してくれる日`,
      _line: index + 2,
    });
  });

  return rules;
}

function scoreFortune({ profile, rules }) {
  const safeProfile = profile || {};
  const haystack = [
    safeProfile.name,
    safeProfile.username,
    safeProfile.description,
    safeProfile.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const categoryScores = {
    overall: 1,
    love: 1,
    work: 1,
  };
  const matched = [];

  rules.forEach((rule) => {
    if (!rule.keyword || !haystack.includes(rule.keyword)) {
      return;
    }

    matched.push(rule);
    categoryScores.overall += rule.score;
    if (rule.category === 'love') {
      categoryScores.love += rule.score;
    }
    if (rule.category === 'work') {
      categoryScores.work += rule.score;
    }
  });

  if (!matched.length && rules.length) {
    const fallbackRule = rules[0];
    matched.push(fallbackRule);
    categoryScores.overall += fallbackRule.score;
  }

  return {
    matched,
    categoryScores,
  };
}

function scoreToPhrase(score, domain) {
  if (score >= 10) return `${domain}は絶好調！やることがスムーズに進みます。`;
  if (score >= 6) return `${domain}は上向き。丁寧に進めるほど運気アップ。`;
  if (score >= 3) return `${domain}は安定。小さな挑戦が吉。`;
  return `${domain}はゆったり運転。焦らず整えると良い流れ。`;
}

const COLORS = ['ピンク', 'レモンイエロー', 'スカイブルー', 'ラベンダー', 'ミントグリーン'];
const ACTIONS = [
  '朝に好きな音楽を1曲聞く',
  '身の回りをひとつ片づける',
  'やさしい言葉を一回多く使う',
  'いつもよりゆっくり深呼吸する',
  '今日の感謝をメモする',
];

function buildDeterministicFortune({ profile, scored }) {
  const name = profile?.name || profile?.username || 'あなた';
  const seedBase = `${name}:${scored.categoryScores.overall}:${scored.matched.map((r) => r.keyword).join('|')}`;
  const seed = [...seedBase].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const luckyColor = COLORS[seed % COLORS.length];
  const luckyAction = ACTIONS[seed % ACTIONS.length];
  const topHints = scored.matched.slice(0, 3).map((rule) => rule.hint).join(' / ');

  return {
    overall: `${name}さんの今日のここたま運は「${scoreToPhrase(scored.categoryScores.overall, '全体運')}」`,
    love: scoreToPhrase(scored.categoryScores.love, '恋愛運'),
    work: scoreToPhrase(scored.categoryScores.work, '仕事・学業運'),
    lucky_action: luckyAction,
    lucky_color: luckyColor,
    source: topHints || '基本運勢',
    fallback: true,
  };
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const maybeJson = raw.match(/\{[\s\S]*\}/);
    if (!maybeJson) {
      return null;
    }
    try {
      return JSON.parse(maybeJson[0]);
    } catch {
      return null;
    }
  }
}

function normalizeFortuneOutput(output, fallbackTemplate) {
  if (!output || typeof output !== 'object') {
    return fallbackTemplate;
  }

  const normalized = {
    overall: output.overall || fallbackTemplate.overall,
    love: output.love || fallbackTemplate.love,
    work: output.work || fallbackTemplate.work,
    lucky_action: output.lucky_action || output.luckyAction || fallbackTemplate.lucky_action,
    lucky_color: output.lucky_color || output.luckyColor || fallbackTemplate.lucky_color,
    source: output.source || fallbackTemplate.source,
    fallback: false,
  };

  return normalized;
}

async function generateFortuneWithAI({ profile, scored }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log("OPENROUTER_API_KEY exists:", !!apiKey);
  console.log("Model:", process.env.OPENROUTER_MODEL);
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const promptText = [
    '以下の入力を使い、ここたま占いをJSONで作成してください。',
    'キーは overall, love, work, lucky_action, lucky_color のみ。',
    '日本語で、短く前向きな文体にしてください。',
    `ユーザー名: ${profile?.name || ''}`,
    `表示ID: ${profile?.username || ''}`,
    `プロフィール: ${profile?.description || ''}`,
    `位置情報: ${profile?.location || ''}`,
    `一致キーワード: ${scored.matched.map((rule) => `${rule.keyword}(${rule.category}:${rule.score})`).join(', ') || 'なし'}`,
    `カテゴリスコア: overall=${scored.categoryScores.overall}, love=${scored.categoryScores.love}, work=${scored.categoryScores.work}`,
  ].join('\n');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || process.env.APP_BASE_URL || 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'Cocotama-search',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'あなたはここたま占い師です。必ずJSON形式だけを返してください。',
        },
        {
          role: 'user',
          content: promptText,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI request failed: ${response.status} ${text}`);
  }

  const json = await response.json();
  const contentRaw = json?.choices?.[0]?.message?.content;
  const content = typeof contentRaw === 'string'
    ? contentRaw
    : Array.isArray(contentRaw)
      ? contentRaw.map((part) => part?.text || '').join('\n')
      : '';
  const parsed = safeJsonParse(content);
  if (!parsed) {
    throw new Error('AI output was not valid JSON');
  }
  return parsed;
}

module.exports = {
  buildDeterministicFortune,
  generateFortuneWithAI,
  loadFortuneRules,
  normalizeFortuneOutput,
  scoreFortune,
};
