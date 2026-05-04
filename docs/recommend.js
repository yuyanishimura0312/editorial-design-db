// EDD recommend app — calls server-side proxy /api/analyze
// API key is managed server-side via Vercel env var.

const API_ENDPOINT = "/api/analyze";
const TOP_N = 20;

const els = {
  brief: document.getElementById("brief"),
  mediumHint: document.getElementById("medium-hint"),
  langHint: document.getElementById("lang-hint"),
  regionHint: document.getElementById("region-hint"),
  runBtn: document.getElementById("run-btn"),
  status: document.getElementById("status"),
  analysisSummary: document.getElementById("analysis-summary"),
  analysisText: document.getElementById("analysis-text"),
  analysisTags: document.getElementById("analysis-tags"),
  resultMeta: document.getElementById("result-meta"),
  resultGrid: document.getElementById("result-grid"),
};

let DATA = null;

async function init() {
  els.runBtn.addEventListener("click", run);

  setStatus("データを読み込み中...");
  try {
    const res = await fetch("data.json");
    DATA = await res.json();
    setStatus(`データ読み込み完了 (design_patterns: ${DATA.design_patterns.length}件 / works_corpus: ${DATA.works_corpus.length}件)`);
  } catch (e) {
    setStatus("data.jsonの読み込みに失敗しました: " + e.message, "error");
  }
}

function setStatus(msg, type = "info") {
  els.status.textContent = msg;
  els.status.className = "status show" + (type === "error" ? " error" : "");
}

async function run() {
  const brief = els.brief.value.trim();
  if (!brief) return setStatus("作りたいものの概要を入力してください", "error");
  if (!DATA) return setStatus("データがまだ読み込まれていません", "error");

  els.runBtn.disabled = true;
  setStatus("AIで入力を解析中（数秒かかります）...");

  let analysis;
  try {
    analysis = await analyzeViaProxy(brief);
  } catch (e) {
    setStatus("解析エラー: " + e.message, "error");
    els.runBtn.disabled = false;
    return;
  }

  setStatus("解析完了。DBから候補を選定中...");
  renderAnalysis(analysis);

  const ranked = scorePatterns(DATA.design_patterns, analysis);
  const top = ranked.slice(0, TOP_N);

  renderResults(top);
  setStatus(`完了。${top.length}件の推奨パターンを表示しています。`);
  els.runBtn.disabled = false;
}

async function analyzeViaProxy(brief) {
  const hints = {
    medium: els.mediumHint.value || null,
    lang: els.langHint.value || null,
    region: els.regionHint.value || null,
  };

  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief, hints }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json();
      detail = errBody.error || JSON.stringify(errBody);
    } catch {
      detail = await res.text();
    }
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  return await res.json();
}

function scorePatterns(patterns, analysis) {
  const norm = (s) => (s || "").toString().toLowerCase();
  const tone = (analysis.tone_keywords || []).map(norm);
  const keywords = (analysis.search_keywords || []).map(norm);
  const subMedia = (analysis.sub_medium_candidates || []).map(norm);
  const priorities = (analysis.design_priorities || []).map(norm);

  return patterns.map(p => {
    let score = 0;
    const blob = norm([
      p.name, p.name_ja, p.description, p.description_ja,
      p.example_works, p.inspiration_designer, p.primary_face,
      p.structural_role, p.use_when_ja
    ].filter(Boolean).join(" "));

    if (analysis.medium && p.medium === analysis.medium) score += 5;
    if (analysis.region_target && p.region === analysis.region_target) score += 2;
    if (analysis.era_target && p.era === analysis.era_target) score += 2;
    if (subMedia.includes(norm(p.sub_medium))) score += 3;

    keywords.forEach(k => { if (k && blob.includes(k)) score += 1; });
    tone.forEach(t => { if (t && blob.includes(t)) score += 0.5; });
    priorities.forEach(pr => { if (pr && blob.includes(pr.replace("_", " "))) score += 0.5; });

    const descLen = (p.description_ja || "").length;
    score += Math.min(1, descLen / 200);

    return { pattern: p, score };
  })
  .filter(x => x.score > 0)
  .sort((a, b) => b.score - a.score);
}

function renderAnalysis(a) {
  els.analysisText.innerHTML = `
    <p style="margin-bottom: 8px;"><strong>意図要約:</strong> ${escapeHtml(a.summary_ja || "(なし)")}</p>
    <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.7;"><strong>選定方針:</strong> ${escapeHtml(a.rationale_ja || "")}</p>
  `;

  const tags = [];
  if (a.medium) tags.push(["媒体", a.medium, "accent"]);
  if (a.era_target) tags.push(["時代", a.era_target]);
  if (a.region_target) tags.push(["地域", a.region_target]);
  (a.sub_medium_candidates || []).forEach(s => tags.push(["ジャンル", s]));
  (a.tone_keywords || []).forEach(s => tags.push(["トーン", s]));
  (a.design_priorities || []).forEach(s => tags.push(["優先", s]));

  els.analysisTags.innerHTML = tags.map(([k, v, cls]) =>
    `<span class="tag ${cls || ""}">${escapeHtml(k)}: ${escapeHtml(v)}</span>`
  ).join("");
  els.analysisSummary.classList.add("show");
}

function renderResults(ranked) {
  els.resultMeta.textContent = `${ranked.length}件の推奨（スコア順）`;
  els.resultGrid.innerHTML = ranked.map((item, i) => renderCard(item, i + 1)).join("");
}

function renderCard({ pattern: p, score }, rank) {
  const coord = parseCoord(p.coordinate_json);
  const sample = renderSample(coord);
  const meta = [p.medium, p.sub_medium, p.era, p.region]
    .filter(Boolean)
    .map(v => `<span class="tag">${escapeHtml(v)}</span>`)
    .join("");
  const extras = [
    p.example_works && `参考: ${p.example_works}`,
    p.inspiration_designer && `デザイナー: ${p.inspiration_designer}`,
    coord?.typography?.primary_face && `書体: ${coord.typography.primary_face}`,
  ].filter(Boolean).join(" / ");

  const specs = coord ? renderSpecs(coord) : "";

  return `
    <div class="result-card">
      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <div class="rank">#${String(rank).padStart(2, "0")}</div>
        <div class="score">score ${score.toFixed(1)}</div>
      </div>
      <h3>${escapeHtml(p.name_ja || p.name || "")}</h3>
      <div class="meta">${meta}</div>
      <div class="sample-frame">${sample}</div>
      ${specs}
      <div class="desc">${escapeHtml(p.description_ja || p.description || "")}</div>
      ${extras ? `<div class="extra">${escapeHtml(extras)}</div>` : ""}
    </div>
  `;
}

function parseCoord(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Render mini SVG of the page layout from coordinate_json
function renderSample(coord) {
  if (!coord) return `<div style="color: var(--text-muted); font-size: 0.74rem;">座標データなし</div>`;
  const trim = coord.trim_size_mm || coord.trim_size || [148, 210];
  const [w, h] = trim;
  const margin = coord.margin_mm || coord.margin || { inner: 15, outer: 15, top: 18, bottom: 20 };
  const inner = margin.inner || 15;
  const top = margin.top || 18;
  const outer = margin.outer || 15;
  const bottom = margin.bottom || 20;
  const cols = coord.columns || 1;
  const gutter = coord.gutter_mm || coord.gutter || 5;
  const baseline = coord.baseline_grid_pt || coord.baseline_grid || 14;

  const maxW = 200;
  const maxH = 260;
  let scale = maxW / w;
  if (h * scale > maxH) scale = maxH / h;
  const sw = w * scale;
  const sh = h * scale;
  const padding = 8;
  const totalW = sw + padding * 2;
  const totalH = sh + padding * 2;

  const pageRect = `<rect x="${padding}" y="${padding}" width="${sw}" height="${sh}" fill="var(--card)" stroke="var(--text-secondary)" stroke-width="0.5"/>`;

  const tx = padding + inner * scale;
  const ty = padding + top * scale;
  const tw = (w - inner - outer) * scale;
  const th = (h - top - bottom) * scale;

  let colLines = "";
  if (cols > 1 && tw > 0) {
    const colW = (tw - gutter * scale * (cols - 1)) / cols;
    for (let i = 1; i < cols; i++) {
      const x = tx + i * colW + (i - 1) * gutter * scale + (gutter * scale) / 2;
      colLines += `<line x1="${x}" y1="${ty}" x2="${x}" y2="${ty + th}" stroke="var(--accent-warm)" stroke-width="0.3" stroke-dasharray="2,2" opacity="0.5"/>`;
    }
  }

  const typeAreaRect = `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="none" stroke="var(--accent-warm)" stroke-width="0.5" opacity="0.6"/>`;

  let bodyLines = "";
  const lineSpacing = (baseline / 2.83) * scale;
  if (lineSpacing > 0.5) {
    const lineCount = Math.floor(th / lineSpacing);
    const colW = cols > 1 ? (tw - gutter * scale * (cols - 1)) / cols : tw;
    const showLines = Math.min(lineCount, 25);
    for (let c = 0; c < cols; c++) {
      const cx = tx + c * (colW + gutter * scale);
      for (let l = 1; l < showLines; l++) {
        const ly = ty + l * lineSpacing;
        if (ly > ty + th - 1) break;
        const lineW = Math.min(colW, colW * (0.85 + (l % 7) * 0.02));
        bodyLines += `<line x1="${cx}" y1="${ly}" x2="${cx + lineW}" y2="${ly}" stroke="var(--text-secondary)" stroke-width="0.4" opacity="0.35"/>`;
      }
    }
  }

  return `<svg viewBox="0 0 ${totalW} ${totalH}" width="${Math.min(totalW, 240)}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    ${pageRect}
    ${typeAreaRect}
    ${colLines}
    ${bodyLines}
  </svg>`;
}

function renderSpecs(c) {
  const trim = c.trim_size_mm || c.trim_size || [];
  const trimStr = trim.length === 2 ? `${trim[0]}×${trim[1]}mm` : "";
  const cols = c.columns ? `${c.columns}段組` : "";
  const gutter = c.gutter_mm ? `gutter ${c.gutter_mm}mm` : "";
  const baseline = c.baseline_grid_pt ? `行送り ${c.baseline_grid_pt}pt` : "";
  const typo = c.typography || {};
  const face = typo.primary_face || "";
  const size = typo.size_pt ? `${typo.size_pt}pt` : "";
  const measure = typo.measure_chars ? `${typo.measure_chars}字詰め` : "";
  const items = [trimStr, cols, gutter, baseline, face, size, measure].filter(Boolean);
  if (!items.length) return "";
  return `<div class="spec-row">${items.map(s => `<span><strong>${escapeHtml(s)}</strong></span>`).join("")}</div>`;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

init();
