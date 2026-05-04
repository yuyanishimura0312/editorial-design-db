// Vercel serverless function: structure full manuscript into book sections
// Reads ANTHROPIC_API_KEY from env.

export const config = { runtime: "edge" };

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 4096;

const ALLOWED_ORIGINS = [
  "https://yuyanishimura0312.github.io",
  "https://editorial-design-db.vercel.app",
  "http://localhost:8888",
  "http://localhost:8889",
  "http://localhost:8890",
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

  const { manuscript, medium, pattern_name, pattern_description } = body;
  if (!manuscript || typeof manuscript !== "string" || manuscript.length < 30) {
    return jsonResp({ error: "manuscript must be at least 30 chars" }, 400, origin);
  }
  if (manuscript.length > 60000) {
    return jsonResp({ error: "manuscript too long (max 60000 chars)" }, 400, origin);
  }

  const prompt = buildPrompt({ manuscript, medium: medium || "book", pattern_name, pattern_description });

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
    return jsonResp({ error: "AI JSON parse failed: " + e.message, raw: jsonMatch[0].slice(0, 500) }, 502, origin);
  }
  return jsonResp(parsed, 200, origin);
}

function buildPrompt({ manuscript, medium, pattern_name, pattern_description }) {
  return `あなたは編集デザインの組版判定エンジンです。ユーザーから与えられた原稿全文を解析し、選択された紙面デザインパターンに合わせて適切な組版構造を判定してください。

# 媒体
${medium}

# 選択されたデザインパターン
名称: ${pattern_name || "(未指定)"}
特徴: ${pattern_description || "(未指定)"}

# 原稿全文
"""
${manuscript}
"""

# 判定タスク
原稿の内容と量から、選択されたデザインパターンに最適な組版構造を抽出してください。

# 出力フォーマット（厳密にJSONのみ、コードブロック・前後説明禁止）
{
  "title": "本書/本誌のメインタイトル（原稿から抽出または推察）",
  "subtitle": "サブタイトル（あれば、なければnull）",
  "author": "著者・編集者名（推察可。なければnull）",
  "back_cover_copy": "裏表紙コピー80-120字",
  "toc_items": [
    {"label": "第一章", "title": "章タイトル", "page": 11},
    {"label": "第二章", "title": "章タイトル", "page": 47}
  ],
  "foreword": "はじめに/まえがきの文章（200-400字。原稿に該当部分があればそれを抽出、なければ生成）",
  "chapters": [
    {
      "label": "第一章",
      "title": "章タイトル",
      "lead": "章のリード文100-180字",
      "body": "章本文（1000-3000字、原稿から該当部分を整形抽出。段落間は\\nで区切る）"
    }
  ],
  "afterword": "あとがきの文章（200-300字。原稿に該当部分があれば抽出、なければ生成）",
  "colophon": {
    "publisher": "出版社名（推察可）",
    "year": 2026,
    "first_print_date": "2026年5月5日",
    "isbn": "978-4-XXXX-XXXX-X"
  }
}

# 重要事項
- chaptersは原稿の長さに応じて1-8章に分割。短い原稿でも最低2章
- 各章のbodyは原稿のテキストを保持し、段落区切りは適切に整える
- 雑誌の場合、chaptersは特集 + 記事 + コラムの構成として扱う
- レポートの場合、chapters[0]にエグゼクティブサマリーを配置し、後続に各セクション
- カタログの場合、chaptersは作品紹介セクションとして扱う
- toc_items は chapters と整合（章数とラベルを揃える）
- 文字列内の改行は \\n でエスケープ`;
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
