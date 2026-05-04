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
  // compose modal
  composeOverlay: document.getElementById("compose-overlay"),
  composeTitle: document.getElementById("compose-title"),
  composeMeta: document.getElementById("compose-meta"),
  composeClose: document.getElementById("compose-close"),
  composeStage: document.getElementById("compose-stage"),
  ccTitle: document.getElementById("cc-title"),
  ccSubtitle: document.getElementById("cc-subtitle"),
  ccLead: document.getElementById("cc-lead"),
  ccBody: document.getElementById("cc-body"),
  ccOrient: document.getElementById("cc-orient"),
  ccBgmode: document.getElementById("cc-bgmode"),
  ccUpdate: document.getElementById("cc-update"),
  ccPrint: document.getElementById("cc-print"),
  ccDownload: document.getElementById("cc-download"),
  ccSpec: document.getElementById("cc-spec"),
};

let DATA = null;
let CURRENT_PATTERN = null;
let CURRENT_COORD = null;

async function init() {
  els.runBtn.addEventListener("click", run);
  els.composeClose.addEventListener("click", closeCompose);
  els.ccUpdate.addEventListener("click", renderComposePage);
  els.ccOrient.addEventListener("change", renderComposePage);
  els.ccBgmode.addEventListener("change", renderComposePage);
  els.ccPrint.addEventListener("click", () => window.print());
  els.ccDownload.addEventListener("click", downloadComposeHtml);
  els.composeOverlay.addEventListener("click", (e) => {
    if (e.target === els.composeOverlay) closeCompose();
  });

  els.resultGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".use-btn");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    const pattern = window.__rankedPatterns?.[idx]?.pattern;
    if (pattern) openCompose(pattern);
  });

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
  window.__rankedPatterns = ranked;
  els.resultMeta.textContent = `${ranked.length}件の推奨（スコア順）／ カードの「このデザインで組版する」で詳細サンプルを生成`;
  els.resultGrid.innerHTML = ranked.map((item, i) => renderCard(item, i + 1, i)).join("");
}

function renderCard({ pattern: p, score }, rank, idx) {
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
      <button class="use-btn" data-idx="${idx}">このデザインで組版する →</button>
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

// ---------- COMPOSE (typesetting sample) ----------

const SAMPLE_TEXTS = {
  book_literary: {
    title: "暮らしと余白",
    subtitle: "都市と植物のあいだで／本文サンプル",
    lead: "朝の光が差し込む小さな台所で、ひと匙のコーヒー粉を量る。日々の動作が、いつのまにか暮らしの輪郭を描いていく。",
    body: "しんと静まりかえった部屋の片隅に、かれは机を据えた。窓の向こうには、まだ夜の名残を残した薄青い空が広がっている。インクの匂いが、部屋に漂う埃と混ざりあって、独特の朝を作っていた。\nペンを走らせる音だけが、時間の在処を告げている。書きながらかれは思う、書くという行為は、世界を見ることの別名なのだろうと。文字は、見たものの輪郭を、紙の上に静かに沈めていく。\nやがて朝陽が机の端まで届くころ、最初の一行が完成した。それは小さな、しかし確かな印であった。"
  },
  book_default: {
    title: "Editorial Design",
    subtitle: "An Introduction to Page Composition",
    lead: "The art of arranging text and image on a page is one of the oldest and most refined disciplines in design.",
    body: "From the manuscripts of medieval scribes to the screens of contemporary readers, the principles of editorial design have evolved while remaining anchored in fundamental concerns: legibility, hierarchy, and harmony.\nThe page is a system of relationships. Margins frame content. Columns organize text. Type creates voice. Together, they form an architecture that guides the reader's eye through ideas.\nGood editorial design is invisible. It does not call attention to itself but instead disappears, leaving only the experience of effortless reading."
  },
  magazine_fashion: {
    title: "STYLE EDITION",
    subtitle: "Spring / Summer 2026 — Special Feature",
    lead: "光と素材、そして余白。今シーズンの装いは、日常に溶け込む静かな詩情を纏う。",
    body: "今号の特集は、季節の移ろいを身にまとう人々を訪ねた。リネンの白、コットンの陰影、わずかに光を含んだウールの織り。素材が語る言葉に耳を澄ませると、ファッションが単なる装飾ではなく、生活そのものの編集行為であることが見えてくる。\nパリ、東京、京都。三つの都市で出会った七人のスタイリッシュな日々。彼らの選ぶ服には、必ず理由がある。\n服を選ぶ、ということは、自分という風景を編集することに他ならない。"
  },
  magazine_lifestyle: {
    title: "Casa & Coffee",
    subtitle: "暮らしの中の小さな愛着",
    lead: "本棚の隅に置かれた一冊の写真集、窓辺のドライフラワー。家を構成する小さな選択が、人生の輪郭を形作る。",
    body: "日々の暮らしを支えているのは、大きな出来事ではなく、無数の小さな選択である。どんなマグカップを使うか、どの椅子で本を読むか、朝食に何を食べるか。\nそれらの選択は、一つひとつは些細でも、積み重なれば紛れもない自分の輪郭になる。家とは、その輪郭が物質化された場所だ。\n今号は、そんな「暮らしの編集」を実践する人々を訪ねた。共通するのは、生活への深い愛着と、ものを大切にする時間の積み重ねだ。"
  },
  magazine_culture: {
    title: "CULTURE NOW",
    subtitle: "Music, Art, Literature — Mid 2026",
    lead: "新しい表現は、どこからやってくるのか。同時代の文化を読み解く、編集者からの手紙。",
    body: "あるバンドのアルバムが、ある詩人の新作と同じ年に出るとき、それは偶然ではなく、時代の意志である。文化はいつも複数のチャンネルから同時に発信され、私たちはそのうちのいくつかを受信できる感受性を持っているにすぎない。\n今号は、2026年前半にリリースされた音楽、出版された書物、開催された展覧会のなかから、編集部が「この時代を最も雄弁に語る」と判断した作品群を紹介する。\nそれぞれの作品は、互いに無関係に見えて、深部でつながっている。"
  },
  newspaper: {
    title: "国内外の動き、時代の見出し",
    subtitle: "2026年5月5日 朝刊／第1面",
    lead: "東京発——新しい都市計画が発表された。中心市街地の再開発に伴い、既存の路地や小規模商店の保全が議論の焦点となっている。",
    body: "都市は単なる物理的な空間ではない。そこに住む人々の記憶、商いの履歴、世代を越えて受け継がれてきた風景の総体である。今回の再開発計画では、近代的なオフィス棟と、戦後から続く商店街の調和をどう図るかが最大の論点となった。\n専門家らは、効率と歴史の両立を求める声を強めている。地域住民への説明会が今月中に複数回開催される予定で、意見の集約が進められる見通しだ。\n計画の最終決定は来月中とされている。"
  },
  report: {
    title: "Annual Report 2026",
    subtitle: "Sustainable Growth & Community",
    lead: "本年度、私たちは地域社会との対話を重ね、持続可能な事業運営の基盤を築きました。年次報告書として、その歩みを記録します。",
    body: "私たちの事業活動は、地域社会、従業員、取引先、そして地球環境という相互依存的なネットワークの中で営まれています。本年度は、特に次の三つの領域で進展がありました。\n第一に、製品ライフサイクル全体での炭素排出量を前年比18%削減しました。第二に、サプライチェーン全体での労働環境監査を完了しました。第三に、地域コミュニティとの対話プログラムを新規に三つ立ち上げました。\n次年度は、これらの取り組みを定量的に拡大し、第三者検証を導入する予定です。"
  },
  catalog: {
    title: "Selected Works 2020–2026",
    subtitle: "Exhibition Catalogue",
    lead: "六年間の制作活動を振り返る展覧会の図録。素材、空間、時間に向き合った作品群を一冊に収めた。",
    body: "本図録は、2020年から2026年までに発表された主要作品を年代順に収録している。各作品には、寸法、素材、制作場所、制作意図に関する記述を付した。\nまた、主要評論家による論考三篇を巻末に掲載している。これらの論考は、作家の制作哲学と同時代美術の文脈における位置づけを論じるものである。\n図録の編集にあたっては、作品の物質性を可能な限り誌面に反映させることを心がけた。"
  },
  zine: {
    title: "ZINE Vol.04",
    subtitle: "Personal Notes / 個人出版",
    lead: "東京の路上で見つけた小さな違和感の記録。誰かに届けば、それでいい。",
    body: "編集後記。今号は、東京で過ごした一年間の散歩中に書きためたメモを編んだものです。地下鉄の駅、コンビニのレジ、古書店の通路。日常の片隅に潜む違和感を、写真と短いテキストで束ねました。\n紙にすることで、デジタルでは流れてしまう小さな観察が、形を持ち始めます。手に取った人が、次に街を歩くときに少しだけ違う風景を見られたら、嬉しい。\n次号は秋に出ます。"
  }
};

function pickSampleText(coord, p) {
  const m = (p.medium || "").toLowerCase();
  const sub = (p.sub_medium || "").toLowerCase();
  if (m === "book") {
    if (sub === "literary" || sub === "shinsho") return SAMPLE_TEXTS.book_literary;
    return SAMPLE_TEXTS.book_default;
  }
  if (m === "magazine") {
    if (sub === "fashion") return SAMPLE_TEXTS.magazine_fashion;
    if (sub === "lifestyle") return SAMPLE_TEXTS.magazine_lifestyle;
    if (sub === "culture") return SAMPLE_TEXTS.magazine_culture;
    return SAMPLE_TEXTS.magazine_lifestyle;
  }
  if (m === "newspaper") return SAMPLE_TEXTS.newspaper;
  if (m === "report") return SAMPLE_TEXTS.report;
  if (m === "catalog") return SAMPLE_TEXTS.catalog;
  if (m === "zine") return SAMPLE_TEXTS.zine;
  return SAMPLE_TEXTS.book_default;
}

// Map design DB face name -> CSS font-family stack
function resolveFontStack(faceName, isVertical) {
  const f = (faceName || "").toLowerCase();
  const serifJa = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", serif';
  const sansJa = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "YuGothic", sans-serif';
  const serifEn = '"EB Garamond", Garamond, "Times New Roman", Georgia, serif';
  const sansEn = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
  const slabEn = '"Roboto Slab", "Rockwell", Georgia, serif';
  const isMincho = /明朝|mincho|秀英|游明朝|筑紫|貂|岩波|新潮|リュウミン|garamond|caslon|bodoni|didot|baskerville|bembo|sabon|times/i.test(faceName || "");
  const isGothic = /ゴシック|gothic|游ゴシック|筑紫オールドゴシック|ヒラギノ角|新ゴ|helvetica|univers|akzidenz|futura|frutiger|avenir|inter|söhne|grotesk/i.test(faceName || "");
  const isSerifEn = /garamond|caslon|bodoni|didot|baskerville|bembo|sabon|times|caslon|jenson|adobe/i.test(faceName || "");
  const isSlab = /slab|rockwell|clarendon|freight/i.test(faceName || "");
  if (isSlab) return slabEn;
  if (isSerifEn && !/明朝|mincho/i.test(faceName || "")) return `"${faceName}", ${serifEn}`;
  if (isMincho) return `"${faceName}", ${serifJa}`;
  if (isGothic) return `"${faceName}", ${sansJa}`;
  // fallback: prefer mincho for vertical, sans for horizontal
  return isVertical ? serifJa : sansJa;
}

function openCompose(pattern) {
  CURRENT_PATTERN = pattern;
  CURRENT_COORD = parseCoord(pattern.coordinate_json) || {};
  els.composeTitle.textContent = pattern.name_ja || pattern.name || "組版サンプル";
  const meta = [pattern.medium, pattern.sub_medium, pattern.era, pattern.region].filter(Boolean).join(" / ");
  const designer = pattern.inspiration_designer ? `／参考デザイナー: ${pattern.inspiration_designer}` : "";
  const works = pattern.example_works ? `／参考作品: ${pattern.example_works}` : "";
  els.composeMeta.textContent = `${meta}${designer}${works}`;

  // pre-fill sample
  const sample = pickSampleText(CURRENT_COORD, pattern);
  els.ccTitle.value = sample.title;
  els.ccSubtitle.value = sample.subtitle;
  els.ccLead.value = sample.lead;
  els.ccBody.value = sample.body;

  // default orientation: vertical for Japanese literary book
  const isJaLiterary = (pattern.medium === "book") && (pattern.region === "Japan") && /literary|shinsho/i.test(pattern.sub_medium || "");
  els.ccOrient.value = isJaLiterary ? "vertical" : "horizontal";
  els.ccBgmode.value = "paper";

  els.composeOverlay.classList.add("show");
  document.body.style.overflow = "hidden";
  renderComposePage();
}

function closeCompose() {
  els.composeOverlay.classList.remove("show");
  document.body.style.overflow = "";
}

function renderComposePage() {
  if (!CURRENT_COORD) return;
  const c = CURRENT_COORD;
  const trim = c.trim_size_mm || c.trim_size || [148, 210];
  const [w, h] = trim.map(Number);
  const margin = c.margin_mm || c.margin || { inner: 18, outer: 18, top: 22, bottom: 26 };
  const inner = +margin.inner || 18;
  const top = +margin.top || 22;
  const outer = +margin.outer || 18;
  const bottom = +margin.bottom || 26;
  const cols = +c.columns || 1;
  const gutter = +c.gutter_mm || c.gutter || 5;
  const baselinePt = +c.baseline_grid_pt || 16;
  const typo = c.typography || {};
  const sizePt = +typo.size_pt || 10;
  const leadingPt = +typo.leading_pt || baselinePt;
  const tracking = +typo.tracking_em || 0;
  const measure = +typo.measure_chars || 0;
  const face = typo.primary_face || "";

  const orient = els.ccOrient.value;
  const isVertical = orient === "vertical";
  const bgMode = els.ccBgmode.value;
  const fontStack = resolveFontStack(face, isVertical);

  // Convert mm -> px at 3.78 px/mm = 96 dpi (CSS standard)
  const PX_PER_MM = 3.7795;
  const pageWpx = w * PX_PER_MM;
  const pageHpx = h * PX_PER_MM;
  // Convert pt -> px at 1pt = 1/72 inch = 96/72 px
  const PX_PER_PT = 96 / 72;
  const sizePx = sizePt * PX_PER_PT;
  const leadingPx = leadingPt * PX_PER_PT;
  const leadingRatio = (leadingPt / sizePt).toFixed(3);

  // scale to fit stage width approx (max 720px wide page)
  const stageWidth = els.composeStage.clientWidth - 48;
  const maxPageW = Math.min(720, stageWidth || 600);
  const scale = Math.min(1, maxPageW / pageWpx);

  const titleSize = sizePx * 2.4;
  const leadSize = sizePx * 1.05;

  const bgFill = bgMode === "dark" ? "#121212" : "#FFFFFF";
  const fgColor = bgMode === "dark" ? "#E8E6E2" : "#121212";
  const subColor = bgMode === "dark" ? "#999" : "#555";

  const titleText = escapeHtml(els.ccTitle.value);
  const subtitleText = escapeHtml(els.ccSubtitle.value);
  const leadText = escapeHtml(els.ccLead.value);
  const bodyParas = (els.ccBody.value || "").split(/\n+/).filter(Boolean)
    .map(p => `<p>${escapeHtml(p)}</p>`).join("");

  // Body column container with column-rule support via CSS columns
  const colRule = cols > 1 ? `column-count: ${cols}; column-gap: ${gutter}mm; column-fill: auto;` : "";

  // Build inner HTML
  const headerBlock = `
    <header class="pp-header" style="margin-bottom: ${leadingPx * 0.6}px;">
      <h1 class="pp-title" style="font-size: ${titleSize}px; font-weight: 700; letter-spacing: 0.02em; line-height: 1.35;">${titleText}</h1>
      ${subtitleText ? `<div class="pp-subtitle" style="font-size: ${sizePx * 0.86}px; color: ${subColor}; margin-top: 0.4em; letter-spacing: 0.04em;">${subtitleText}</div>` : ""}
      ${leadText ? `<div class="pp-lead" style="font-size: ${leadSize}px; color: ${subColor};">${leadText}</div>` : ""}
    </header>
  `;

  const bodyBlock = `
    <div class="pp-body" style="font-size: ${sizePx}px; line-height: ${leadingRatio}; ${tracking ? `letter-spacing: ${tracking}em;` : ""} ${colRule}">
      ${bodyParas}
    </div>
  `;

  const folio = `<div class="pp-folio" style="bottom: ${bottom * 0.4}mm; right: ${outer * 0.4}mm; font-size: ${sizePx * 0.7}px;">— 1 —</div>`;

  const pageStyle = `
    width: ${pageWpx}px;
    height: ${pageHpx}px;
    padding: ${top}mm ${outer}mm ${bottom}mm ${inner}mm;
    font-family: ${fontStack};
    background: ${bgFill};
    color: ${fgColor};
    transform: scale(${scale});
    transform-origin: top left;
    box-sizing: border-box;
  `;

  const inner_html = isVertical
    ? `<div class="page-preview vertical" style="${pageStyle} writing-mode: vertical-rl; text-orientation: mixed;">${headerBlock}${bodyBlock}${folio}</div>`
    : `<div class="page-preview" style="${pageStyle}">${headerBlock}${bodyBlock}${folio}</div>`;

  // Wrapper to hold space for scaled element
  const wrapH = pageHpx * scale + 16;
  els.composeStage.innerHTML = `<div style="width: ${pageWpx * scale}px; height: ${wrapH}px; position: relative;">${inner_html}</div>`;

  // Spec block
  els.ccSpec.innerHTML = `
    <strong>仕様</strong><br>
    判型 ${w}×${h}mm／マージン 内${inner}/上${top}/外${outer}/下${bottom}mm<br>
    ${cols}段組${cols > 1 ? `／ガター ${gutter}mm` : ""}／ベースライン ${baselinePt}pt<br>
    本文 ${sizePt}pt／行送り ${leadingPt}pt（行送り比 ${leadingRatio}）${tracking ? `／字間 ${tracking}em` : ""}${measure ? `／${measure}字詰め` : ""}<br>
    書体 ${escapeHtml(face || "(未指定)")} → CSS: <code style="font-size:0.9em;">${escapeHtml(fontStack)}</code>
  `;
}

function downloadComposeHtml() {
  if (!CURRENT_PATTERN || !CURRENT_COORD) return;
  const stageHtml = els.composeStage.innerHTML;
  const c = CURRENT_COORD;
  const w = (c.trim_size_mm || [148])[0];
  const h = (c.trim_size_mm || [148, 210])[1];
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(els.ccTitle.value)} — EDD組版サンプル</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Noto+Serif+JP:wght@400;700;900&family=EB+Garamond:wght@400;500;700&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #f0f0f0; padding: 40px; -webkit-font-smoothing: antialiased; }
.page-preview { font-feature-settings: "palt", "pkna"; letter-spacing: 0.01em; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
.page-preview h1.pp-title { margin: 0; line-height: 1.4; }
.page-preview .pp-lead { margin-top: 0.6em; line-height: 1.7; }
.page-preview .pp-body p { text-indent: 1em; margin: 0; }
.page-preview .pp-body p + p { margin-top: 0.4em; }
.page-preview.vertical { writing-mode: vertical-rl; text-orientation: mixed; }
.page-preview .pp-folio { position: absolute; }
@page { size: ${w}mm ${h}mm; margin: 0; }
@media print {
  body { background: #fff; padding: 0; }
  .page-preview { box-shadow: none; transform: none !important; }
}
</style>
</head>
<body>
${stageHtml.replace(/transform: scale\([0-9.]+\);[^"']*/g, "")}
<div style="margin-top: 24px; font-family: sans-serif; font-size: 12px; color: #666;">
EDD pattern: ${escapeHtml(CURRENT_PATTERN.name_ja || CURRENT_PATTERN.name)} —
generated ${new Date().toISOString().slice(0, 10)} from
<a href="https://editorial-design-db.vercel.app/" style="color:#CC1400;">Editorial Design Knowledge DB</a>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (CURRENT_PATTERN.name || "edd-sample").toString().replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 50);
  a.href = url;
  a.download = `edd-${slug}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

init();
