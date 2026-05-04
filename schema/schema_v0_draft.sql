-- Editorial Design Knowledge DB (EDD) — Schema Draft v0
-- 学習ソース: 多言語 / 最終アウトプット: 日本語
-- 目標規模: 約20,000レコード（うちパターン10,000+）

PRAGMA foreign_keys = ON;

-- ============================================================
-- L0: 理論基盤レイヤー
-- ============================================================
CREATE TABLE IF NOT EXISTS theory_concepts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    name_en TEXT,
    category TEXT,
    layer TEXT CHECK(layer IN ('typography','grid','printing','perception','editorial','copywriting','semiotics')),
    era TEXT,
    description TEXT NOT NULL,
    description_ja TEXT,
    origin_culture TEXT,
    related_theorists TEXT,
    references_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS theorists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    name_native TEXT,
    nationality TEXT,
    birth_year INTEGER,
    death_year INTEGER,
    role TEXT,
    school_movement TEXT,
    main_works TEXT,
    contribution TEXT,
    influences TEXT,
    influenced TEXT,
    references_json TEXT
);

-- ============================================================
-- L1: フォント知識レイヤー
-- ============================================================
CREATE TABLE IF NOT EXISTS fonts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    name_native TEXT,
    script_type TEXT CHECK(script_type IN ('japanese','latin','cjk','arabic','devanagari','mixed','other')),
    classification TEXT,
    sub_classification TEXT,
    foundry TEXT,
    designer TEXT,
    release_year INTEGER,
    weights TEXT,
    style_axes_json TEXT,
    adobe_japan1 TEXT,
    glyph_count INTEGER,
    license_type TEXT,
    license_terms TEXT,
    use_cases TEXT,
    use_cases_ja TEXT,
    famous_uses TEXT,
    pairing_recommendations TEXT,
    metric_x_height_em REAL,
    metric_cap_height_em REAL,
    metric_stroke_contrast TEXT,
    visual_warmth INTEGER,
    visual_formality INTEGER,
    description TEXT,
    description_ja TEXT,
    typical_use_size_pt TEXT,
    references_json TEXT
);

CREATE TABLE IF NOT EXISTS font_designers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    nationality TEXT,
    birth_year INTEGER,
    death_year INTEGER,
    foundry TEXT,
    notable_fonts TEXT,
    bio TEXT,
    references_json TEXT
);

CREATE TABLE IF NOT EXISTS typography_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_name_ja TEXT,
    category TEXT,
    description TEXT,
    description_ja TEXT,
    typical_range TEXT,
    measurement_unit TEXT,
    applicable_scripts TEXT
);

-- ============================================================
-- L2: 座標構造レイヤー（判型・グリッド・版面）
-- ============================================================
CREATE TABLE IF NOT EXISTS trim_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    width_mm REAL NOT NULL,
    height_mm REAL NOT NULL,
    region TEXT,
    typical_use TEXT,
    typical_use_ja TEXT,
    historical_origin TEXT
);

CREATE TABLE IF NOT EXISTS grid_systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    grid_type TEXT CHECK(grid_type IN ('manuscript','column','modular','hierarchical','baseline','compound','canon','japanese_traditional')),
    inventor TEXT,
    era TEXT,
    description TEXT,
    description_ja TEXT,
    construction_rule_json TEXT,
    typical_use_cases TEXT,
    references_json TEXT
);

CREATE TABLE IF NOT EXISTS layout_canons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    margin_ratio TEXT,
    historical_period TEXT,
    construction_method TEXT
);

-- ============================================================
-- L3: デザインパターンレイヤー（10,000+ 目標）
-- ============================================================
CREATE TABLE IF NOT EXISTS design_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_code TEXT UNIQUE,
    name TEXT NOT NULL,
    name_ja TEXT,
    medium TEXT CHECK(medium IN ('book','magazine','newspaper','report','catalog','zine','pamphlet','poster','editorial_other')),
    sub_medium TEXT,
    genre TEXT,
    era TEXT,
    region TEXT,
    description TEXT,
    description_ja TEXT,
    structural_role TEXT,
    coordinate_json TEXT,
    typography_json TEXT,
    color_json TEXT,
    hierarchy_levels INTEGER,
    visual_complexity INTEGER,
    primary_face_id INTEGER REFERENCES fonts(id),
    secondary_face_id INTEGER REFERENCES fonts(id),
    grid_system_id INTEGER REFERENCES grid_systems(id),
    trim_size_id INTEGER REFERENCES trim_sizes(id),
    example_works_json TEXT,
    example_works TEXT,
    inspiration_designer TEXT,
    primary_face TEXT,
    related_patterns TEXT,
    use_when TEXT,
    use_when_ja TEXT,
    avoid_when TEXT,
    references_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pattern_medium ON design_patterns(medium);
CREATE INDEX IF NOT EXISTS idx_pattern_genre ON design_patterns(genre);
CREATE INDEX IF NOT EXISTS idx_pattern_era ON design_patterns(era);

-- ============================================================
-- L4: 巨匠・スタジオレイヤー
-- ============================================================
CREATE TABLE IF NOT EXISTS designers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    name_native TEXT,
    role_primary TEXT CHECK(role_primary IN ('book_designer','art_director','editorial_designer','type_designer','copywriter','illustrator','photographer','editor_designer','generalist')),
    role_secondary TEXT,
    nationality TEXT,
    birth_year INTEGER,
    death_year INTEGER,
    studio TEXT,
    associated_publications TEXT,
    style_description TEXT,
    style_description_ja TEXT,
    influences TEXT,
    influenced TEXT,
    awards TEXT,
    bio_ja TEXT,
    key_works TEXT,
    references_json TEXT
);

CREATE TABLE IF NOT EXISTS studios_publishers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    type TEXT CHECK(type IN ('design_studio','publisher','magazine_house','newspaper','agency','self_published','collective')),
    country TEXT,
    founded_year INTEGER,
    closed_year INTEGER,
    notable_titles TEXT,
    house_style TEXT,
    house_style_ja TEXT,
    references_json TEXT
);

CREATE TABLE IF NOT EXISTS schools_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    era_start INTEGER,
    era_end INTEGER,
    region TEXT,
    description TEXT,
    description_ja TEXT,
    key_figures TEXT,
    key_principles TEXT
);

-- ============================================================
-- L5: コピー・タイトル技法レイヤー
-- ============================================================
CREATE TABLE IF NOT EXISTS copy_techniques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    category TEXT CHECK(category IN ('book_title','book_subtitle','obi_catch','magazine_cover','feature_title','lead','subhead','caption','callout','headline_news','jacket_copy','tagline')),
    structural_pattern TEXT,
    description TEXT,
    description_ja TEXT,
    example_ja TEXT,
    example_other TEXT,
    rhetorical_device TEXT,
    typical_length_chars TEXT,
    applicable_genres TEXT,
    inventor_or_master TEXT,
    writing_craft_db_link TEXT,
    references_json TEXT
);

CREATE TABLE IF NOT EXISTS copywriters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    nationality TEXT,
    birth_year INTEGER,
    death_year INTEGER,
    notable_campaigns TEXT,
    style_signature TEXT,
    style_signature_ja TEXT,
    references_json TEXT
);

-- ============================================================
-- L6: 作例コーパス
-- ============================================================
CREATE TABLE IF NOT EXISTS works_corpus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_ja TEXT,
    medium TEXT,
    publication TEXT,
    issue_or_volume TEXT,
    publisher_id INTEGER REFERENCES studios_publishers(id),
    designer_id INTEGER REFERENCES designers(id),
    year INTEGER,
    trim_size_id INTEGER REFERENCES trim_sizes(id),
    page_count INTEGER,
    binding_method TEXT,
    paper_stock TEXT,
    primary_face_id INTEGER REFERENCES fonts(id),
    secondary_face_id INTEGER REFERENCES fonts(id),
    coordinate_json TEXT,
    structural_notes TEXT,
    structural_notes_ja TEXT,
    significance TEXT,
    significance_ja TEXT,
    image_refs_json TEXT,
    pattern_ids TEXT,
    references_json TEXT,
    publisher_text TEXT,
    designer_or_director TEXT,
    designer_name TEXT,
    typography_face_used TEXT,
    award_or_recognition TEXT
);

-- ============================================================
-- 関係テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS pattern_designer_links (
    pattern_id INTEGER REFERENCES design_patterns(id),
    designer_id INTEGER REFERENCES designers(id),
    relation_type TEXT,
    PRIMARY KEY (pattern_id, designer_id, relation_type)
);

CREATE TABLE IF NOT EXISTS designer_school_links (
    designer_id INTEGER REFERENCES designers(id),
    school_id INTEGER REFERENCES schools_movements(id),
    PRIMARY KEY (designer_id, school_id)
);

CREATE TABLE IF NOT EXISTS pattern_relations (
    from_pattern_id INTEGER REFERENCES design_patterns(id),
    to_pattern_id INTEGER REFERENCES design_patterns(id),
    relation_type TEXT CHECK(relation_type IN ('derivative_of','contrasts_with','combined_with','evolved_into','genre_sibling')),
    PRIMARY KEY (from_pattern_id, to_pattern_id, relation_type)
);

CREATE TABLE IF NOT EXISTS font_pairings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    primary_face_id INTEGER REFERENCES fonts(id),
    secondary_face_id INTEGER REFERENCES fonts(id),
    pairing_purpose TEXT,
    rationale TEXT,
    rationale_ja TEXT,
    score INTEGER
);

-- ============================================================
-- 文献・出典
-- ============================================================
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_ja TEXT,
    author TEXT,
    publisher TEXT,
    year INTEGER,
    type TEXT CHECK(type IN ('book','article','website','catalog','interview','archive','academic_paper')),
    url TEXT,
    isbn TEXT,
    notes TEXT
);
