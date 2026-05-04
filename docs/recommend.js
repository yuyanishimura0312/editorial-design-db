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
  // flow + view toggle
  ccFulltext: document.getElementById("cc-fulltext"),
  ccFlow: document.getElementById("cc-flow"),
  ccFlowClear: document.getElementById("cc-flow-clear"),
  ccFlowStatus: document.getElementById("cc-flow-status"),
  vtDetail: document.getElementById("vt-detail"),
  vtList: document.getElementById("vt-list"),
};

let DATA = null;
let CURRENT_PATTERN = null;
let CURRENT_COORD = null;
let STRUCTURED_CONTENT = null; // AI-structured manuscript output
let CURRENT_VIEW = "detail"; // "detail" | "list"

async function init() {
  els.runBtn.addEventListener("click", run);
  els.composeClose.addEventListener("click", closeCompose);
  els.ccUpdate.addEventListener("click", renderComposePage);
  els.ccOrient.addEventListener("change", renderComposePage);
  els.ccBgmode.addEventListener("change", renderComposePage);
  els.ccPrint.addEventListener("click", () => window.print());
  els.ccDownload.addEventListener("click", downloadComposeHtml);
  els.ccFlow.addEventListener("click", flowFullText);
  els.ccFlowClear.addEventListener("click", () => {
    STRUCTURED_CONTENT = null;
    els.ccFulltext.value = "";
    setFlowStatus("流し込みデータをクリアしました");
    renderComposePage();
  });
  els.vtDetail.addEventListener("click", () => switchView("detail"));
  els.vtList.addEventListener("click", () => switchView("list"));

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
  STRUCTURED_CONTENT = null;
  CURRENT_VIEW = "detail";
  updateViewToggle();
  setFlowStatus("");

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
  els.ccFulltext.value = "";

  // default orientation: vertical for Japanese literary book
  const isJaLiterary = (pattern.medium === "book") && (pattern.region === "Japan") && /literary|shinsho/i.test(pattern.sub_medium || "");
  els.ccOrient.value = isJaLiterary ? "vertical" : "horizontal";
  els.ccBgmode.value = "paper";

  els.composeOverlay.classList.add("show");
  document.body.style.overflow = "hidden";
  renderComposePage();
}

function setFlowStatus(msg, type = "info") {
  els.ccFlowStatus.textContent = msg;
  els.ccFlowStatus.className = "flow-status" + (type === "error" ? " error" : "");
}

async function flowFullText() {
  const manuscript = (els.ccFulltext.value || "").trim();
  if (manuscript.length < 30) {
    setFlowStatus("原稿は30字以上を貼り付けてください", "error");
    return;
  }
  if (!CURRENT_PATTERN) return;

  els.ccFlow.disabled = true;
  setFlowStatus("AIで原稿を解析中（10〜30秒）...");

  try {
    const res = await fetch("/api/structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manuscript,
        medium: CURRENT_PATTERN.medium,
        pattern_name: CURRENT_PATTERN.name_ja || CURRENT_PATTERN.name,
        pattern_description: CURRENT_PATTERN.description_ja || CURRENT_PATTERN.description,
      }),
    });
    if (!res.ok) {
      let err = "";
      try { err = (await res.json()).error || ""; } catch { err = await res.text(); }
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    STRUCTURED_CONTENT = await res.json();
    const chapterCount = (STRUCTURED_CONTENT.chapters || []).length;
    const tocCount = (STRUCTURED_CONTENT.toc_items || []).length;
    setFlowStatus(`解析完了。タイトル「${STRUCTURED_CONTENT.title || "(なし)"}」／章数 ${chapterCount}／目次 ${tocCount}項目`);

    // Sync structured content into the form fields (so user sees AI's title etc.)
    if (STRUCTURED_CONTENT.title) els.ccTitle.value = STRUCTURED_CONTENT.title;
    if (STRUCTURED_CONTENT.subtitle) els.ccSubtitle.value = STRUCTURED_CONTENT.subtitle;
    if (STRUCTURED_CONTENT.foreword) els.ccLead.value = STRUCTURED_CONTENT.foreword.slice(0, 200);
    if (STRUCTURED_CONTENT.chapters?.[0]?.body) els.ccBody.value = STRUCTURED_CONTENT.chapters[0].body;

    renderComposePage();
  } catch (e) {
    setFlowStatus("AI判定エラー: " + e.message, "error");
  } finally {
    els.ccFlow.disabled = false;
  }
}

function switchView(view) {
  CURRENT_VIEW = view;
  updateViewToggle();
  renderComposePage();
}

function updateViewToggle() {
  els.vtDetail.classList.toggle("active", CURRENT_VIEW === "detail");
  els.vtList.classList.toggle("active", CURRENT_VIEW === "list");
}

function closeCompose() {
  els.composeOverlay.classList.remove("show");
  document.body.style.overflow = "";
}

// Page layout sequences per medium
const PAGE_SEQUENCES = {
  book: [
    { role: "cover", label: "表紙" },
    { role: "title_page", label: "扉" },
    { role: "toc", label: "目次" },
    { role: "foreword", label: "はじめに" },
    { role: "chapter_opener", label: "章扉" },
    { role: "body", label: "本文" },
    { role: "colophon", label: "奥付" },
    { role: "back_cover", label: "裏表紙" },
  ],
  magazine: [
    { role: "cover", label: "表紙" },
    { role: "toc", label: "目次" },
    { role: "feature_opener", label: "特集扉" },
    { role: "feature_spread", label: "特集本文" },
    { role: "article", label: "記事" },
    { role: "column", label: "コラム" },
    { role: "colophon", label: "奥付" },
    { role: "back_cover", label: "裏表紙" },
  ],
  newspaper: [
    { role: "front_page", label: "1面" },
    { role: "inside_page", label: "総合面" },
    { role: "feature_page", label: "特集面" },
    { role: "back_page", label: "最終面" },
  ],
  report: [
    { role: "cover", label: "表紙" },
    { role: "toc", label: "目次" },
    { role: "exec_summary", label: "エグゼクティブサマリー" },
    { role: "body", label: "本文" },
    { role: "data_page", label: "データページ" },
    { role: "back_cover", label: "裏表紙" },
  ],
  catalog: [
    { role: "cover", label: "表紙" },
    { role: "foreword", label: "ごあいさつ" },
    { role: "toc", label: "目次" },
    { role: "work_image", label: "作品（画像主）" },
    { role: "work_text", label: "作品解説" },
    { role: "colophon", label: "奥付" },
  ],
  zine: [
    { role: "cover", label: "表紙" },
    { role: "toc", label: "目次／インデックス" },
    { role: "feature_spread", label: "本文見開き" },
    { role: "editorial_note", label: "編集後記" },
    { role: "back_cover", label: "裏表紙" },
  ],
  pamphlet: [
    { role: "cover", label: "表面" },
    { role: "feature_spread", label: "中面" },
    { role: "back_cover", label: "裏面" },
  ],
};

function renderComposePage() {
  if (!CURRENT_COORD) return;
  const c = CURRENT_COORD;
  const p = CURRENT_PATTERN;
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

  const PX_PER_MM = 3.7795;
  const pageWpx = w * PX_PER_MM;
  const pageHpx = h * PX_PER_MM;
  const PX_PER_PT = 96 / 72;
  const sizePx = sizePt * PX_PER_PT;
  const leadingRatio = (leadingPt / sizePt).toFixed(3);

  const stageWidth = els.composeStage.clientWidth - 48;
  const maxPageW = Math.min(560, stageWidth || 480);
  const scale = Math.min(1, maxPageW / pageWpx);

  // Determine page sequence based on medium
  const medium = (p.medium || "book").toLowerCase();
  const baseSequence = PAGE_SEQUENCES[medium] || PAGE_SEQUENCES.book;

  // Build sequence: if structured content present, expand chapters into multiple chapter_opener+body pairs
  let sequence = baseSequence;
  if (STRUCTURED_CONTENT && STRUCTURED_CONTENT.chapters && STRUCTURED_CONTENT.chapters.length > 0) {
    sequence = expandSequenceWithChapters(baseSequence, STRUCTURED_CONTENT.chapters, medium);
  }

  const ctx = {
    titleText: els.ccTitle.value,
    subtitleText: els.ccSubtitle.value,
    leadText: els.ccLead.value,
    bodyText: els.ccBody.value,
    isVertical,
    bgMode,
    fontStack,
    pageWpx, pageHpx, scale,
    PX_PER_MM, PX_PER_PT,
    sizePx, sizePt, leadingRatio, tracking, cols, gutter, measure, face,
    inner, top, outer, bottom, w, h,
    medium, subMedium: p.sub_medium,
    pattern: p,
    structured: STRUCTURED_CONTENT,
  };

  const pagesHtml = sequence.map((step, idx) => {
    // step may include chapterIndex for chapter-specific rendering
    const stepCtx = step.chapterIndex != null ? { ...ctx, _chapterIndex: step.chapterIndex } : ctx;
    return renderPageByRole(step.role, step.label, idx + 1, sequence.length, stepCtx);
  }).join("");

  if (CURRENT_VIEW === "list") {
    // Wrap each page in thumbnail card
    els.composeStage.classList.add("list-view");
    const thumbnails = sequence.map((step, idx) => {
      const stepCtx = step.chapterIndex != null ? { ...ctx, _chapterIndex: step.chapterIndex } : ctx;
      const pageHtml = renderPageByRole(step.role, step.label, idx + 1, sequence.length, stepCtx);
      // Extract just the inner page-preview (strip outer page-wrap label)
      return makeThumbnailCard(step.label, idx + 1, sequence.length, pageHtml, ctx);
    }).join("");
    els.composeStage.innerHTML = `<div class="list-grid">${thumbnails}</div>`;
  } else {
    els.composeStage.classList.remove("list-view");
    els.composeStage.innerHTML = pagesHtml;
  }

  const flowNote = STRUCTURED_CONTENT ? `<br><strong>AI流し込み</strong>: ${(STRUCTURED_CONTENT.chapters || []).length}章 / 目次 ${(STRUCTURED_CONTENT.toc_items || []).length}項目` : "";
  els.ccSpec.innerHTML = `
    <strong>仕様</strong><br>
    判型 ${w}×${h}mm／マージン 内${inner}/上${top}/外${outer}/下${bottom}mm<br>
    ${cols}段組${cols > 1 ? `／ガター ${gutter}mm` : ""}／ベースライン ${baselinePt}pt<br>
    本文 ${sizePt}pt／行送り ${leadingPt}pt（行送り比 ${leadingRatio}）${tracking ? `／字間 ${tracking}em` : ""}${measure ? `／${measure}字詰め` : ""}<br>
    書体 ${escapeHtml(face || "(未指定)")}<br>
    <strong>構成 (${sequence.length}ページ)</strong>: ${sequence.map(s => s.label).join(" → ")}${flowNote}
  `;
}

// Expand the base sequence: replace single chapter_opener/body with one pair per AI chapter
function expandSequenceWithChapters(baseSeq, chapters, medium) {
  const out = [];
  let inserted = false;
  for (const step of baseSeq) {
    const isChapterPair = step.role === "chapter_opener" || (step.role === "body" && !inserted);
    const isFeaturePair = step.role === "feature_opener" || step.role === "feature_spread" || step.role === "article" || step.role === "column";

    if (medium === "book" && step.role === "chapter_opener" && !inserted) {
      // Replace this chapter_opener with N chapter_opener + body pairs
      chapters.forEach((ch, ci) => {
        out.push({ role: "chapter_opener", label: `${ch.label || `第${ci + 1}章`}扉`, chapterIndex: ci });
        out.push({ role: "body", label: `${ch.label || `第${ci + 1}章`}本文`, chapterIndex: ci });
      });
      inserted = true;
    } else if (medium === "book" && step.role === "body" && inserted) {
      // skip — already inserted body pages above
      continue;
    } else if (medium === "magazine" && (step.role === "feature_opener" || step.role === "feature_spread") && !inserted) {
      chapters.forEach((ch, ci) => {
        if (ci === 0) out.push({ role: "feature_opener", label: `特集扉: ${ch.title || ch.label || ""}`, chapterIndex: ci });
        out.push({ role: "feature_spread", label: `${ch.label || `記事${ci + 1}`}（見開き）`, chapterIndex: ci });
      });
      inserted = true;
    } else if (medium === "magazine" && (step.role === "article" || step.role === "column") && inserted) {
      continue;
    } else if (medium === "report" && step.role === "body" && !inserted) {
      chapters.forEach((ch, ci) => {
        out.push({ role: "body", label: `${ch.label || `セクション${ci + 1}`}`, chapterIndex: ci });
      });
      inserted = true;
    } else if (medium === "catalog" && step.role === "work_image" && !inserted) {
      chapters.forEach((ch, ci) => {
        out.push({ role: "work_image", label: `${ch.title || `作品${ci + 1}`}（画像）`, chapterIndex: ci });
        out.push({ role: "work_text", label: `${ch.title || `作品${ci + 1}`}（解説）`, chapterIndex: ci });
      });
      inserted = true;
    } else if (medium === "catalog" && step.role === "work_text" && inserted) {
      continue;
    } else {
      out.push(step);
    }
  }
  return out;
}

function makeThumbnailCard(label, idx, total, pageHtml, ctx) {
  // Extract the inner element with its scale, then re-scale to thumbnail size
  const thumbW = 180;
  const thumbScale = thumbW / ctx.pageWpx;
  // Re-render the page at smaller scale
  const reHtml = pageHtml
    .replace(/transform: scale\(([0-9.]+)\)/g, `transform: scale(${thumbScale})`);
  // Strip outer .page-wrap and .page-label, keep only inner content
  const inner = reHtml.replace(/<div class="page-wrap"><div class="page-label">[^<]*<\/div>/, '<div class="page-wrap-inner">').replace(/<\/div>$/, "");
  return `
    <div class="thumb-card">
      <div class="thumb-img" style="height: ${ctx.pageHpx * thumbScale}px;">${inner}</div>
      <div class="thumb-meta">${idx} / ${total}</div>
      <div class="thumb-label">${escapeHtml(label)}</div>
    </div>
  `;
}

function pageStyleStr(ctx, opts = {}) {
  const bgFill = opts.bg || (ctx.bgMode === "dark" ? "#121212" : "#FFFFFF");
  const fgColor = opts.fg || (ctx.bgMode === "dark" ? "#E8E6E2" : "#121212");
  const padTop = opts.padTop != null ? opts.padTop : ctx.top;
  const padOuter = opts.padOuter != null ? opts.padOuter : ctx.outer;
  const padBottom = opts.padBottom != null ? opts.padBottom : ctx.bottom;
  const padInner = opts.padInner != null ? opts.padInner : ctx.inner;
  return `
    width: ${ctx.pageWpx}px;
    height: ${ctx.pageHpx}px;
    padding: ${padTop}mm ${padOuter}mm ${padBottom}mm ${padInner}mm;
    font-family: ${ctx.fontStack};
    background: ${bgFill};
    color: ${fgColor};
    transform: scale(${ctx.scale});
    transform-origin: top left;
    box-sizing: border-box;
    ${opts.extra || ""}
  `;
}

function pageWrapStyle(ctx) {
  const wrapW = ctx.pageWpx * ctx.scale;
  const wrapH = ctx.pageHpx * ctx.scale;
  return `width: ${wrapW}px; height: ${wrapH}px; position: relative;`;
}

function pageWrap(label, idx, total, inner) {
  return `<div class="page-wrap"><div class="page-label">${escapeHtml(label)} (${idx}/${total})</div>${inner}</div>`;
}

function renderPageByRole(role, label, idx, total, ctx) {
  switch (role) {
    case "cover": return renderCover(label, idx, total, ctx);
    case "back_cover": return renderBackCover(label, idx, total, ctx);
    case "title_page": return renderTitlePage(label, idx, total, ctx);
    case "toc": return renderTOC(label, idx, total, ctx);
    case "foreword": return renderForeword(label, idx, total, ctx);
    case "chapter_opener": return renderChapterOpener(label, idx, total, ctx);
    case "body": return renderBodyPage(label, idx, total, ctx);
    case "feature_opener": return renderFeatureOpener(label, idx, total, ctx);
    case "feature_spread": return renderFeatureSpread(label, idx, total, ctx);
    case "article": return renderArticle(label, idx, total, ctx);
    case "column": return renderColumn(label, idx, total, ctx);
    case "colophon": return renderColophon(label, idx, total, ctx);
    case "front_page": return renderNewspaperFront(label, idx, total, ctx);
    case "inside_page": return renderNewspaperInside(label, idx, total, ctx);
    case "feature_page": return renderNewspaperFeature(label, idx, total, ctx);
    case "back_page": return renderNewspaperBack(label, idx, total, ctx);
    case "exec_summary": return renderExecSummary(label, idx, total, ctx);
    case "data_page": return renderDataPage(label, idx, total, ctx);
    case "work_image": return renderWorkImage(label, idx, total, ctx);
    case "work_text": return renderWorkText(label, idx, total, ctx);
    case "editorial_note": return renderEditorialNote(label, idx, total, ctx);
    default: return renderBodyPage(label, idx, total, ctx);
  }
}

// --------- role renderers ---------

function renderCover(label, idx, total, ctx) {
  const titleSize = ctx.sizePx * 4.2;
  const subSize = ctx.sizePx * 1.05;
  const isMag = ctx.medium === "magazine";
  const accentColor = ctx.bgMode === "dark" ? "#CC1400" : "#CC1400";
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx, { padTop: ctx.top * 1.5, padBottom: ctx.bottom * 1.5 })}">
        <div style="font-size: ${ctx.sizePx * 0.7}px; letter-spacing: 0.18em; color: ${subColor}; text-transform: uppercase;">EDITORIAL DESIGN SAMPLE</div>
        <div style="margin-top: ${ctx.h * 0.18}mm;">
          <h1 style="font-size: ${titleSize}px; font-weight: 900; line-height: 1.15; letter-spacing: 0.02em;">${escapeHtml(ctx.titleText)}</h1>
          ${ctx.subtitleText ? `<div style="margin-top: 1em; font-size: ${subSize}px; color: ${subColor}; line-height: 1.6;">${escapeHtml(ctx.subtitleText)}</div>` : ""}
        </div>
        ${isMag ? `<div style="position: absolute; bottom: ${ctx.bottom * 1.2}mm; left: ${ctx.inner}mm; right: ${ctx.outer}mm; display: flex; justify-content: space-between; align-items: baseline; font-size: ${ctx.sizePx * 0.78}px; color: ${subColor};"><span>Issue 01 / 2026</span><span style="font-weight:700; color:${accentColor}; letter-spacing: 0.06em;">SPECIAL EDITION</span></div>` : `<div style="position: absolute; bottom: ${ctx.bottom * 1.2}mm; left: ${ctx.inner}mm; font-size: ${ctx.sizePx * 0.86}px; color: ${subColor}; letter-spacing: 0.04em;">2026</div>`}
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderBackCover(label, idx, total, ctx) {
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const copy = ctx.structured?.back_cover_copy || ctx.leadText || "本書は、紙面デザインの可能性を一冊に編んだ試みである。";
  const isbn = ctx.structured?.colophon?.isbn || "978-4-XXXX-XXXX-X";
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx)}">
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="font-size: ${ctx.sizePx * 1.1}px; line-height: 1.7; max-width: ${ctx.w * 0.7}mm;">${escapeHtml(copy)}</div>
          <div style="font-size: ${ctx.sizePx * 0.8}px; color: ${subColor}; display: flex; justify-content: space-between; align-items: baseline; letter-spacing: 0.04em;">
            <span>${escapeHtml(ctx.structured?.colophon?.publisher || "Editorial Design Knowledge DB")}</span>
            <span style="font-family: monospace;">ISBN ${escapeHtml(isbn)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderTitlePage(label, idx, total, ctx) {
  const titleSize = ctx.sizePx * 3.6;
  const subColor = ctx.bgMode === "dark" ? "#888" : "#555";
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx)}">
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: ${ctx.isVertical ? 'flex-end' : 'flex-start'};">
          <h1 style="font-size: ${titleSize}px; font-weight: 700; line-height: 1.3; letter-spacing: 0.02em;">${escapeHtml(ctx.titleText)}</h1>
          ${ctx.subtitleText ? `<div style="margin-top: 1.2em; font-size: ${ctx.sizePx * 1.0}px; color: ${subColor}; letter-spacing: 0.04em;">${escapeHtml(ctx.subtitleText)}</div>` : ""}
        </div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderTOC(label, idx, total, ctx) {
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const titleSize = ctx.sizePx * 1.8;
  let tocItems;
  if (ctx.structured?.toc_items?.length) {
    tocItems = ctx.structured.toc_items.map(t => [t.label || "", t.title || "", String(t.page || "").padStart(3, "0")]);
  } else if (ctx.medium === "magazine" || ctx.medium === "report") {
    tocItems = [
      ["FEATURE", ctx.titleText, "008"],
      ["ESSAY", "暮らしと余白について", "024"],
      ["PORTRAIT", "ある編集者の机", "036"],
      ["PHOTO", "都市の手触り", "048"],
      ["INTERVIEW", "言葉の重さを量る", "060"],
      ["COLUMN", "今月の本", "072"],
      ["REVIEW", "新刊から五冊", "078"],
      ["BACKMATTER", "編集後記", "094"],
    ];
  } else {
    tocItems = [
      ["第一章", "始まりの一行", "011"],
      ["第二章", "余白という器", "047"],
      ["第三章", "文字の呼吸", "089"],
      ["第四章", "ページの向こう側", "131"],
      ["第五章", "編集の手", "175"],
      ["第六章", "終わりの余白", "211"],
      ["", "あとがき", "247"],
      ["", "索引", "253"],
    ];
  }
  const itemRows = tocItems.map(([k, t, p]) => `
    <div style="display: flex; align-items: baseline; padding: ${ctx.leadingRatio * 0.5}em 0; border-bottom: 1px dotted ${ctx.bgMode === 'dark' ? '#333' : '#ccc'};">
      <span style="min-width: 80px; font-size: ${ctx.sizePx * 0.78}px; color: ${subColor}; letter-spacing: 0.06em;">${escapeHtml(k)}</span>
      <span style="flex: 1; font-size: ${ctx.sizePx}px;">${escapeHtml(t)}</span>
      <span style="font-size: ${ctx.sizePx * 0.86}px; color: ${subColor}; font-family: monospace;">${escapeHtml(p)}</span>
    </div>
  `).join("");
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx)}">
        <h2 style="font-size: ${titleSize}px; font-weight: 700; letter-spacing: 0.04em; margin-bottom: 1.4em; padding-bottom: 0.6em; border-bottom: 2px solid currentColor;">${ctx.medium === 'book' ? '目次' : 'CONTENTS'}</h2>
        <div>${itemRows}</div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderForeword(label, idx, total, ctx) {
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const verticalClass = ctx.isVertical ? "vertical" : "";
  const verticalCss = ctx.isVertical ? "writing-mode: vertical-rl; text-orientation: mixed;" : "";
  const fallback = ctx.medium === 'catalog' ? "本展覧会は、六年間の制作活動を通じて見えてきた素材と空間の関係を、ひとつの問いとして提示するものである。" : "本書を手に取ってくださった方へ。ここに書かれた言葉が、誰かの日常の片隅に少しの光を差し込むことができれば、それ以上の喜びはありません。";
  const fullText = ctx.structured?.foreword || ctx.leadText || fallback;
  const paragraphs = fullText.split(/\n+/).filter(Boolean);
  const author = ctx.structured?.author || (ctx.medium === 'catalog' ? '館長より' : '著者');
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview ${verticalClass}" style="${pageStyleStr(ctx)} ${verticalCss}">
        <h2 style="font-size: ${ctx.sizePx * 1.6}px; font-weight: 700; letter-spacing: 0.04em; margin-bottom: 1.6em;">${ctx.medium === 'catalog' ? 'ごあいさつ' : 'はじめに'}</h2>
        <div style="font-size: ${ctx.sizePx * 1.05}px; line-height: 1.85; max-width: ${ctx.isVertical ? 'none' : (ctx.w - ctx.inner - ctx.outer) * 0.85 + 'mm'};">
          ${paragraphs.map((p, i) => `<p style="margin: ${i === 0 ? '0' : '1em 0 0'}; ${i > 0 ? 'text-indent: 1em;' : ''}">${escapeHtml(p)}</p>`).join("")}
        </div>
        <div style="position: absolute; ${ctx.isVertical ? 'left' : 'right'}: ${ctx.outer}mm; bottom: ${ctx.bottom * 1.2}mm; font-size: ${ctx.sizePx * 0.86}px; color: ${subColor}; letter-spacing: 0.04em;">${escapeHtml(author)}</div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderChapterOpener(label, idx, total, ctx) {
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const ci = ctx._chapterIndex;
  const ch = (ci != null && ctx.structured?.chapters?.[ci]) ? ctx.structured.chapters[ci] : null;
  const chapterLabel = ch?.label || "CHAPTER 01";
  const chapterTitle = ch?.title || ctx.titleText;
  const chapterLead = ch?.lead || ctx.leadText;
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx)}">
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: flex-start;">
          <div style="font-family: monospace; font-size: ${ctx.sizePx * 0.86}px; color: ${subColor}; letter-spacing: 0.2em;">${escapeHtml(chapterLabel)}</div>
          <h2 style="margin-top: 0.6em; font-size: ${ctx.sizePx * 3.0}px; font-weight: 700; letter-spacing: 0.04em; line-height: 1.3;">${escapeHtml(chapterTitle)}</h2>
          <div style="margin-top: 1.6em; max-width: ${(ctx.w - ctx.inner - ctx.outer) * 0.7}mm; font-size: ${ctx.sizePx * 0.95}px; color: ${subColor}; line-height: 1.85;">${escapeHtml(chapterLead)}</div>
        </div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderBodyPage(label, idx, total, ctx) {
  const verticalClass = ctx.isVertical ? "vertical" : "";
  const verticalCss = ctx.isVertical ? "writing-mode: vertical-rl; text-orientation: mixed;" : "";
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const colRule = ctx.cols > 1 ? `column-count: ${ctx.cols}; column-gap: ${ctx.gutter}mm; column-fill: auto;` : "";
  const ci = ctx._chapterIndex;
  const ch = (ci != null && ctx.structured?.chapters?.[ci]) ? ctx.structured.chapters[ci] : null;
  const bodySource = ch?.body || ctx.bodyText || "";
  const runnerTitle = ch?.title || ctx.titleText || "";
  const bodyParas = bodySource.split(/\n+/).filter(Boolean).map(p => `<p style="text-indent: 1em; margin: 0;">${escapeHtml(p)}</p>`).join('<p style="margin-top: 0.4em;"></p>');
  const folio = `<div style="position: absolute; bottom: ${ctx.bottom * 0.4}mm; right: ${ctx.outer * 0.5}mm; font-size: ${ctx.sizePx * 0.7}px; color: ${subColor}; font-family: monospace;">— ${idx} —</div>`;
  const runner = `<div style="position: absolute; top: ${ctx.top * 0.5}mm; left: ${ctx.inner}mm; font-size: ${ctx.sizePx * 0.7}px; color: ${subColor}; letter-spacing: 0.1em; text-transform: uppercase;">${escapeHtml(runnerTitle.slice(0, 24))}</div>`;
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview ${verticalClass}" style="${pageStyleStr(ctx)} ${verticalCss}">
        ${runner}
        <div style="font-size: ${ctx.sizePx}px; line-height: ${ctx.leadingRatio}; ${ctx.tracking ? `letter-spacing: ${ctx.tracking}em;` : ""} ${colRule} margin-top: ${ctx.top * 0.3}mm; height: calc(100% - ${ctx.top * 0.3}mm - ${ctx.bottom * 0.3}mm);">
          ${bodyParas}
        </div>
        ${folio}
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderFeatureOpener(label, idx, total, ctx) {
  const accent = "#CC1400";
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx, { padTop: 0, padBottom: 0, padInner: 0, padOuter: 0 })}">
        <div style="height: 60%; background: linear-gradient(135deg, #2a2a2a 0%, #444 100%); display: flex; align-items: flex-end; padding: ${ctx.bottom}mm ${ctx.outer}mm ${ctx.bottom * 0.5}mm ${ctx.inner}mm;">
          <div style="color: #fff;">
            <div style="font-size: ${ctx.sizePx * 0.78}px; letter-spacing: 0.2em; color: #fff; opacity: 0.7;">FEATURE</div>
            <h2 style="margin-top: 0.4em; font-size: ${ctx.sizePx * 3.4}px; font-weight: 900; line-height: 1.15; letter-spacing: 0.02em;">${escapeHtml(ctx.titleText)}</h2>
          </div>
        </div>
        <div style="padding: ${ctx.top * 1.2}mm ${ctx.outer}mm ${ctx.bottom}mm ${ctx.inner}mm;">
          <div style="font-size: ${ctx.sizePx * 1.1}px; line-height: 1.85; color: ${subColor}; max-width: ${(ctx.w - ctx.inner - ctx.outer) * 0.85}mm;">
            <span style="color: ${accent}; font-weight: 700;">__ </span>${escapeHtml(ctx.leadText)}
          </div>
        </div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderFeatureSpread(label, idx, total, ctx) {
  // Spread = two pages side by side
  const colRule = ctx.cols > 1 ? `column-count: ${ctx.cols}; column-gap: ${ctx.gutter}mm; column-fill: auto;` : "";
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const bodyParas = (ctx.bodyText || "").split(/\n+/).filter(Boolean).map(p => `<p style="text-indent: 1em; margin: 0;">${escapeHtml(p)}</p>`).join('<p style="margin-top: 0.4em;"></p>');
  const leftPage = `
    <div class="page-preview" style="${pageStyleStr(ctx, { padInner: ctx.outer, padOuter: ctx.inner })}">
      <div style="height: 100%; background: linear-gradient(180deg, #aaa 0%, #ddd 100%); display: flex; align-items: flex-end; padding: ${ctx.bottom * 0.6}mm ${ctx.outer * 0.5}mm; margin: -${ctx.top}mm -${ctx.outer}mm -${ctx.bottom}mm -${ctx.inner}mm;">
        <div style="color: #fff;">
          <div style="font-size: ${ctx.sizePx * 0.7}px; letter-spacing: 0.15em; opacity: 0.85;">PHOTO ESSAY</div>
          <div style="font-size: ${ctx.sizePx * 0.78}px; margin-top: 0.4em; opacity: 0.85;">caption: 朝の光と机の上のコーヒー</div>
        </div>
      </div>
    </div>
  `;
  const rightPage = `
    <div class="page-preview" style="${pageStyleStr(ctx)}">
      <h3 style="font-size: ${ctx.sizePx * 1.4}px; font-weight: 700; margin-bottom: 1em; letter-spacing: 0.04em;">${escapeHtml(ctx.titleText)}</h3>
      <div style="font-size: ${ctx.sizePx * 1.0}px; line-height: 1.7; color: ${subColor}; margin-bottom: 1.4em; padding-bottom: 1em; border-bottom: 1px solid ${ctx.bgMode === 'dark' ? '#333' : '#ddd'};">${escapeHtml(ctx.leadText)}</div>
      <div style="font-size: ${ctx.sizePx}px; line-height: ${ctx.leadingRatio}; ${ctx.tracking ? `letter-spacing: ${ctx.tracking}em;` : ""} ${colRule}">
        ${bodyParas}
      </div>
    </div>
  `;
  const wrap = `
    <div class="spread-pair" style="width: ${ctx.pageWpx * ctx.scale * 2}px;">
      ${leftPage}${rightPage}
    </div>
  `;
  return pageWrap(label + "（見開き）", idx, total, wrap);
}

function renderArticle(label, idx, total, ctx) {
  return renderBodyPage(label, idx, total, ctx);
}

function renderColumn(label, idx, total, ctx) {
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx)}">
        <div style="border-left: 3px solid #CC1400; padding-left: 1em;">
          <div style="font-size: ${ctx.sizePx * 0.78}px; letter-spacing: 0.18em; color: #CC1400;">COLUMN</div>
          <h3 style="margin-top: 0.4em; font-size: ${ctx.sizePx * 1.5}px; font-weight: 700; letter-spacing: 0.02em;">${escapeHtml(ctx.titleText)}</h3>
        </div>
        <div style="margin-top: 2em; font-size: ${ctx.sizePx}px; line-height: ${ctx.leadingRatio}; max-width: ${(ctx.w - ctx.inner - ctx.outer) * 0.9}mm;">
          ${(ctx.bodyText || "").split(/\n+/).filter(Boolean).slice(0, 2).map(p => `<p style="text-indent: 1em; margin: 0 0 0.6em;">${escapeHtml(p)}</p>`).join("")}
        </div>
        <div style="margin-top: 1.6em; font-size: ${ctx.sizePx * 0.82}px; color: ${subColor}; letter-spacing: 0.04em;">— ${escapeHtml(ctx.subtitleText.split('／')[0] || '匿名')}</div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderColophon(label, idx, total, ctx) {
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const today = new Date();
  const year = ctx.structured?.colophon?.year || today.getFullYear();
  const printDate = ctx.structured?.colophon?.first_print_date || `${year}年5月5日`;
  const publisher = ctx.structured?.colophon?.publisher || "株式会社サンプル出版";
  const isbn = ctx.structured?.colophon?.isbn || "978-4-XXXX-XXXX-X";
  const author = ctx.structured?.author || "";
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx)}">
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: flex-end;">
          <div style="border-top: 1px solid currentColor; padding-top: 1em; font-size: ${ctx.sizePx * 0.86}px; line-height: 2;">
            <div><strong>${escapeHtml(ctx.titleText)}</strong></div>
            <div style="color: ${subColor};">${escapeHtml(ctx.subtitleText)}</div>
            <div style="margin-top: 0.8em; color: ${subColor};">
              ${escapeHtml(printDate)}　初版第1刷発行<br>
              ${author ? `著者　${escapeHtml(author)}<br>` : ""}
              発行所　${escapeHtml(publisher)}<br>
              〒100-0001　東京都千代田区千代田1-1-1<br>
              印刷・製本　株式会社サンプル印刷<br>
              <br>
              ©${year} ${escapeHtml(author || ctx.titleText)}<br>
              Printed in Japan　ISBN ${escapeHtml(isbn)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderNewspaperFront(label, idx, total, ctx) {
  const subColor = ctx.bgMode === "dark" ? "#888" : "#444";
  const accent = "#CC1400";
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx, { padTop: ctx.top * 0.5 })}">
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 0.6em; border-bottom: 3px double currentColor;">
          <h1 style="font-family: 'Noto Serif JP', serif; font-size: ${ctx.sizePx * 3.6}px; font-weight: 900; letter-spacing: 0.06em;">EDITORIAL TIMES</h1>
          <span style="font-size: ${ctx.sizePx * 0.8}px; color: ${subColor};">2026年5月5日 火曜日</span>
        </div>
        <div style="margin-top: 1em; column-count: 4; column-gap: ${ctx.gutter}mm;">
          <h2 style="font-size: ${ctx.sizePx * 2.2}px; font-weight: 900; line-height: 1.3; column-span: all; margin-bottom: 0.6em; padding-bottom: 0.4em; border-bottom: 1px solid currentColor;">${escapeHtml(ctx.titleText)}</h2>
          <div style="font-size: ${ctx.sizePx * 1.1}px; line-height: 1.6; color: ${accent}; font-weight: 500; column-span: all; margin-bottom: 1em;">${escapeHtml(ctx.leadText)}</div>
          <div style="font-size: ${ctx.sizePx * 0.9}px; line-height: 1.7;">
            ${(ctx.bodyText || "").split(/\n+/).filter(Boolean).map(p => `<p style="text-indent: 1em; margin: 0 0 0.4em;">${escapeHtml(p)}</p>`).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderNewspaperInside(label, idx, total, ctx) {
  return renderBodyPage(label, idx, total, ctx);
}

function renderNewspaperFeature(label, idx, total, ctx) {
  return renderFeatureSpread(label, idx, total, ctx);
}

function renderNewspaperBack(label, idx, total, ctx) {
  return renderColumn(label, idx, total, ctx);
}

function renderExecSummary(label, idx, total, ctx) {
  const subColor = ctx.bgMode === "dark" ? "#888" : "#555";
  const accent = "#CC1400";
  const items = [
    "事業活動による炭素排出量を前年比18%削減（測定範囲拡大を含む）",
    "サプライチェーン全体での労働環境監査を完了、課題8件を特定",
    "地域コミュニティとの対話プログラムを新規に3つ立ち上げ",
    "従業員エンゲージメントスコアが72→81に上昇",
    "次年度の重点投資領域として再生可能エネルギー転換を決定",
  ];
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx)}">
        <div style="font-size: ${ctx.sizePx * 0.78}px; letter-spacing: 0.18em; color: ${accent};">EXECUTIVE SUMMARY</div>
        <h2 style="margin-top: 0.4em; font-size: ${ctx.sizePx * 1.8}px; font-weight: 700; letter-spacing: 0.02em; line-height: 1.4;">${escapeHtml(ctx.titleText)}</h2>
        <div style="margin-top: 1.6em; font-size: ${ctx.sizePx * 1.05}px; line-height: 1.85; color: ${subColor};">${escapeHtml(ctx.leadText)}</div>
        <div style="margin-top: 2em; padding-top: 1em; border-top: 1px solid ${ctx.bgMode === 'dark' ? '#333' : '#ddd'};">
          <h3 style="font-size: ${ctx.sizePx * 1.0}px; font-weight: 700; letter-spacing: 0.06em; margin-bottom: 1em;">本年度のハイライト</h3>
          <ol style="list-style: none; padding: 0; counter-reset: highlight;">
            ${items.map(t => `<li style="counter-increment: highlight; display: flex; gap: 1em; padding: 0.5em 0; font-size: ${ctx.sizePx * 0.95}px; line-height: 1.6;"><span style="color: ${accent}; font-weight: 700; min-width: 1.4em;">·</span><span>${escapeHtml(t)}</span></li>`).join("")}
          </ol>
        </div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderDataPage(label, idx, total, ctx) {
  const subColor = ctx.bgMode === "dark" ? "#888" : "#555";
  const accent = "#CC1400";
  const rows = [
    ["売上高", "12,847", "11,236", "+14.3%"],
    ["営業利益", "1,892", "1,540", "+22.9%"],
    ["純利益", "1,231", "987", "+24.7%"],
    ["従業員数", "847", "812", "+4.3%"],
    ["CO₂排出 (t)", "8,432", "10,283", "-18.0%"],
  ];
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx)}">
        <div style="font-size: ${ctx.sizePx * 0.78}px; letter-spacing: 0.18em; color: ${accent};">DATA SHEET</div>
        <h2 style="margin-top: 0.4em; font-size: ${ctx.sizePx * 1.5}px; font-weight: 700; margin-bottom: 1.4em;">主要指標 — Key Metrics</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: ${ctx.sizePx * 0.9}px; line-height: 1.6;">
          <thead>
            <tr style="border-bottom: 2px solid currentColor;">
              <th style="text-align: left; padding: 0.5em 0; font-weight: 500; letter-spacing: 0.04em;">指標</th>
              <th style="text-align: right; padding: 0.5em 0; font-family: monospace;">2026</th>
              <th style="text-align: right; padding: 0.5em 0; color: ${subColor}; font-family: monospace;">2025</th>
              <th style="text-align: right; padding: 0.5em 0; color: ${accent}; font-family: monospace;">YoY</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `<tr style="border-bottom: 1px dotted ${ctx.bgMode === 'dark' ? '#333' : '#ddd'};"><td style="padding: 0.6em 0;">${escapeHtml(r[0])}</td><td style="text-align: right; font-family: monospace;">${escapeHtml(r[1])}</td><td style="text-align: right; color: ${subColor}; font-family: monospace;">${escapeHtml(r[2])}</td><td style="text-align: right; color: ${accent}; font-family: monospace; font-weight: 700;">${escapeHtml(r[3])}</td></tr>`).join("")}
          </tbody>
        </table>
        <div style="margin-top: 1.4em; font-size: ${ctx.sizePx * 0.78}px; color: ${subColor}; line-height: 1.7;">単位: 百万円。CO₂排出量はGHGプロトコルScope 1+2に基づく。第三者検証済み。</div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderWorkImage(label, idx, total, ctx) {
  const subColor = ctx.bgMode === "dark" ? "#888" : "#666";
  const wrap = `
    <div style="${pageWrapStyle(ctx)}">
      <div class="page-preview" style="${pageStyleStr(ctx, { padTop: 0, padBottom: 0, padInner: 0, padOuter: 0 })}">
        <div style="height: 75%; background: linear-gradient(135deg, #999 0%, #ccc 60%, #888 100%); display: flex; align-items: flex-end;"></div>
        <div style="padding: ${ctx.top}mm ${ctx.outer}mm ${ctx.bottom}mm ${ctx.inner}mm;">
          <div style="font-family: monospace; font-size: ${ctx.sizePx * 0.78}px; color: ${subColor}; letter-spacing: 0.06em;">PLATE 01</div>
          <div style="margin-top: 0.4em; font-size: ${ctx.sizePx * 1.0}px; font-weight: 500;">${escapeHtml(ctx.titleText)}</div>
          <div style="margin-top: 0.4em; font-size: ${ctx.sizePx * 0.82}px; color: ${subColor}; line-height: 1.7;">2024年, インクジェット・プリント, 600×900mm</div>
        </div>
      </div>
    </div>
  `;
  return pageWrap(label, idx, total, wrap);
}

function renderWorkText(label, idx, total, ctx) {
  return renderBodyPage(label, idx, total, ctx);
}

function renderEditorialNote(label, idx, total, ctx) {
  return renderColumn(label, idx, total, ctx);
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
