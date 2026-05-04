// Vercel serverless function: proxy to Anthropic API
// API key is stored in env var ANTHROPIC_API_KEY (not in code)

export const config = { runtime: "edge" };

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 1024;

const ALLOWED_ORIGINS = [
  "https://yuyanishimura0312.github.io",
  "https://editorial-design-db.vercel.app",
  "http://localhost:8888",
  "http://localhost:8889",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default async function handler(req) {
  const origin = req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResp({ error: "Server missing ANTHROPIC_API_KEY" }, 500, origin);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "Invalid JSON body" }, 400, origin);
  }

  const { brief, hints } = body;
  if (!brief || typeof brief !== "string" || brief.length < 5) {
    return jsonResp({ error: "brief must be a non-empty string" }, 400, origin);
  }
  if (brief.length > 4000) {
    return jsonResp({ error: "brief too long (max 4000 chars)" }, 400, origin);
  }

  const prompt = buildPrompt(brief, hints || {});

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (e) {
    return jsonResp({ error: "Upstream fetch failed: " + e.message }, 502, origin);
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    return jsonResp({ error: `Anthropic API error ${upstream.status}: ${errText.slice(0, 300)}` }, 502, origin);
  }

  const data = await upstream.json();
  const text = data.content?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return jsonResp({ error: "AI response had no JSON", raw: text.slice(0, 500) }, 502, origin);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return jsonResp({ error: "AI response JSON parse failed: " + e.message }, 502, origin);
  }

  return jsonResp(parsed, 200, origin);
}

function buildPrompt(brief, hints) {
  const { medium, lang, region } = hints;
  return `あなたはEditorial Design Knowledge DBの推奨エンジンです。ユーザーの入力を解析し、紙面デザインパターンを選ぶための検索条件をJSONで返してください。

# ユーザー入力
${brief}

# ヒント（指定がある場合のみ尊重）
- 媒体: ${medium || "指定なし"}
- 言語: ${lang || "指定なし"}
- 地域: ${region || "指定なし"}

# 出力フォーマット（厳密にJSONのみ、コードブロック禁止）
{
  "summary_ja": "ユーザーの意図を80字程度で要約",
  "medium": "book|magazine|newspaper|report|catalog|zine|pamphlet|null",
  "sub_medium_candidates": ["literary, fashion, lifestyle, culture, business, academic, practical, picture などから該当を最大3つ"],
  "era_target": "pre-1900|1900-1945|1945-1980|1980-2000|2000-2026|null",
  "region_target": "Japan|USA|Europe|UK|null",
  "tone_keywords": ["記述から推察される雰囲気・トーンのキーワード5-8個（例: ミニマル, 古典的, 情緒的, 高級, 親しみやすい）"],
  "design_priorities": ["white_space, photo_dominance, typography_focused, grid_strict, experimental, modular, narrative, minimal, ornate の中から3-5個"],
  "search_keywords": ["DBで検索すべき具体的なキーワード（人名・誌名・書体名・出版社名など、5-12個）"],
  "rationale_ja": "選定方針を80字程度で説明"
}

各値は文字列または配列。null可能な箇所はnull。コードブロック・説明文不要、JSONのみ返す。`;
}

function jsonResp(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}
