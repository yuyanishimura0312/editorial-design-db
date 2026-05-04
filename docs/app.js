// EDD Dashboard - vanilla JS

const PAGE_SIZE = 24;
let DATA = null;

async function init() {
  const res = await fetch("data.json");
  DATA = await res.json();
  renderStats();
  setupSection("pattern", DATA.design_patterns, {
    titleField: ["name_ja", "name"],
    metaFields: ["medium", "sub_medium", "era", "region"],
    descField: "description_ja",
    extraField: r => [r.example_works, r.inspiration_designer && `参考: ${r.inspiration_designer}`, r.primary_face && `書体: ${r.primary_face}`].filter(Boolean).join(" / "),
    filters: {
      patternMedium: "medium",
      patternEra: "era",
    },
    searchFields: ["name", "name_ja", "description_ja", "structural_role"],
  });
  setupSection("works", DATA.works_corpus, {
    titleField: ["title_ja", "title"],
    metaFields: ["medium", "year", "publisher_text", "designer_or_director", "designer_name"],
    descField: "structural_notes_ja",
    extraField: r => [r.significance_ja, r.publication, r.typography_face_used && `書体: ${r.typography_face_used}`].filter(Boolean).join(" / "),
    filters: { worksMedium: "medium" },
    searchFields: ["title", "title_ja", "designer_or_director", "designer_name", "publisher_text", "structural_notes_ja"],
  });
  setupSection("font", DATA.fonts, {
    titleField: ["name_ja", "name"],
    metaFields: ["script_type", "classification", "foundry", "release_year"],
    descField: "description_ja",
    extraField: r => [r.designer && `デザイナー: ${r.designer}`, r.weights && `ウエイト: ${r.weights}`, r.famous_uses && `使用例: ${r.famous_uses}`].filter(Boolean).join(" / "),
    filters: { fontScript: "script_type", fontClass: "classification" },
    searchFields: ["name", "name_ja", "foundry", "designer", "description_ja"],
  });
  setupSection("designer", DATA.designers, {
    titleField: ["name_ja", "name"],
    metaFields: ["role_primary", "nationality", "birth_year", "studio"],
    descField: "bio_ja",
    extraField: r => [r.style_description_ja, r.key_works && `代表作: ${r.key_works}`, r.awards && `受賞: ${r.awards}`].filter(Boolean).join(" / "),
    filters: { designerRole: "role_primary", designerCountry: "nationality" },
    searchFields: ["name", "name_ja", "studio", "bio_ja"],
  });
  setupSection("theory", DATA.theory_concepts, {
    titleField: ["name_ja", "name"],
    metaFields: ["category", "layer", "era", "origin_culture"],
    descField: "description_ja",
    extraField: r => [r.related_theorists && `関連: ${r.related_theorists}`, r.application_example_ja && `適用例: ${r.application_example_ja}`].filter(Boolean).join(" / "),
    filters: { theoryCategory: "category" },
    searchFields: ["name", "name_ja", "description_ja", "category"],
  });
  setupSection("copy", DATA.copy_techniques, {
    titleField: ["name_ja", "name"],
    metaFields: ["category", "rhetorical_device", "applicable_genres"],
    descField: "description_ja",
    extraField: r => [r.example_ja && `例: ${r.example_ja}`, r.inventor_or_master && `提唱: ${r.inventor_or_master}`].filter(Boolean).join(" / "),
    filters: { copyCategory: "category" },
    searchFields: ["name", "name_ja", "description_ja", "example_ja"],
  });
}

function renderStats() {
  const stats = [
    ["6,195", "総レコード"],
    ["363", "デザインパターン"],
    ["2,893", "作例コーパス"],
    ["1,127", "コピー技法"],
    ["764", "フォント"],
    ["446", "理論概念"],
    ["243", "デザイナー"],
    ["55", "理論家"],
    ["76", "出版社・スタジオ"],
    ["50", "書体ペアリング"],
    ["40", "グリッドシステム"],
    ["40", "コピーライター"],
    ["30", "古典カノン"],
    ["30", "判型"],
    ["100%", "座標JSON有効"],
  ];
  const grid = document.getElementById("statsGrid");
  grid.innerHTML = stats.map(([n, l]) => `<div class="stat-card"><div class="stat-num">${n}</div><div class="stat-label">${l}</div></div>`).join("");
}

function setupSection(prefix, rows, cfg) {
  const state = { rows, filtered: rows, page: 1, cfg };

  // Populate filters
  Object.entries(cfg.filters).forEach(([selectId, field]) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const values = [...new Set(rows.map(r => r[field]).filter(Boolean))].sort();
    values.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => apply(state, prefix));
  });

  const search = document.getElementById(prefix + "Search");
  if (search) {
    let timer;
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => apply(state, prefix), 250);
    });
  }

  apply(state, prefix);
}

function apply(state, prefix) {
  const { rows, cfg } = state;
  let filtered = rows;

  Object.entries(cfg.filters).forEach(([selectId, field]) => {
    const sel = document.getElementById(selectId);
    if (sel && sel.value) {
      filtered = filtered.filter(r => r[field] === sel.value);
    }
  });

  const search = document.getElementById(prefix + "Search");
  if (search && search.value.trim()) {
    const q = search.value.trim().toLowerCase();
    filtered = filtered.filter(r =>
      cfg.searchFields.some(f => (r[f] || "").toString().toLowerCase().includes(q))
    );
  }

  state.filtered = filtered;
  state.page = 1;
  render(state, prefix);
}

function render(state, prefix) {
  const { filtered, page, cfg } = state;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  document.getElementById(prefix + "Meta").textContent = `${total.toLocaleString()}件 / ページ ${page}/${totalPages}`;

  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);
  const cardsEl = document.getElementById(prefix + "Cards");
  cardsEl.innerHTML = slice.map(r => renderCard(r, cfg)).join("");

  // pager
  const pagerEl = document.getElementById(prefix + "Pager");
  pagerEl.innerHTML = "";
  if (totalPages <= 1) return;
  const showPages = pagerNumbers(page, totalPages);
  showPages.forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = p === "..." ? "..." : p;
    if (p === page) btn.classList.add("active");
    if (p === "...") btn.disabled = true;
    if (p !== "..." && p !== page) btn.addEventListener("click", () => {
      state.page = p;
      render(state, prefix);
      window.scrollTo({ top: document.getElementById(prefix === "pattern" ? "patterns" : prefix + "s").offsetTop - 80, behavior: "smooth" });
    });
    pagerEl.appendChild(btn);
  });
}

function pagerNumbers(current, total) {
  const out = [];
  const window = 2;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - window && i <= current + window)) {
      out.push(i);
    } else if (out[out.length - 1] !== "...") {
      out.push("...");
    }
  }
  return out;
}

function renderCard(r, cfg) {
  const titleField = cfg.titleField.find(f => r[f]);
  const title = titleField ? escapeHtml(r[titleField]) : "(no title)";
  const meta = cfg.metaFields
    .map(f => r[f])
    .filter(Boolean)
    .map(v => `<span class="tag">${escapeHtml(v.toString())}</span>`)
    .join("");
  const desc = r[cfg.descField] ? escapeHtml(r[cfg.descField]) : "";
  const extra = cfg.extraField ? cfg.extraField(r) : "";
  return `<div class="card">
    <h3>${title}</h3>
    <div class="meta">${meta}</div>
    <div class="desc">${desc}</div>
    ${extra ? `<div class="extra">${escapeHtml(extra)}</div>` : ""}
  </div>`;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

init();
