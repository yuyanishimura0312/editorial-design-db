# Editorial Design DB — 統合タクソノミー v1

6トラック基礎リサーチを統合した、Phase 3収集の指針。

## 1. メディア分類（design_patterns.medium）
- `book` — 書籍（文芸/新書/実用/専門/絵本/写真集/美術書）
- `magazine` — 雑誌（モード/カルチャー/ライフスタイル/ビジネス/思想/学術）
- `newspaper` — 新聞（全国紙/地方紙/タブロイド/専門紙）
- `report` — レポート（年次報告書/統合報告書/白書/政策レポート/技術レポート）
- `catalog` — カタログ（美術館図録/ファッション/商品/展覧会）
- `zine` — ZINE（アート/フォト/個人出版）
- `pamphlet` — パンフレット（観光/企業/イベント）
- `editorial_other` — その他（年鑑/ブックレット）

## 2. 構造的役割（design_patterns.structural_role）
**書籍系**: 表紙 / 背 / カバー / 帯 / 見返し / 扉 / 目次 / 章扉 / 本文 / 柱 / 奥付 / 索引

**雑誌系**: 表紙 / マスターヘッド / 目次 / 特集扉 / 記事フォーマット / コラム / 連載 / 広告 / 編集後記 / インデックス

**新聞系**: 1面 / 主見出し / 中見出し / リード / 本記 / 写真コラム / インフォグラフィック / 識別子

**レポート系**: 表紙 / エグゼクティブサマリー / 章扉 / データビジュアライゼーション / ケーススタディ / 巻末

## 3. ジャンル × 時代マトリクス
時代区分: pre-1900 / 1900-1945 / 1945-1980 / 1980-2000 / 2000-2026

ジャンル軸 × 時代軸 = 80セルでパターン目標を設定（各セル100-200パターン）。

## 4. 座標構造の必須JSONフィールド
```json
{
  "trim_size_mm": [W, H],
  "bleed_mm": 3,
  "margin_mm": {"inner": X, "top": Y, "outer": Z, "bottom": W},
  "type_area_mm": {"x": X, "y": Y, "w": W, "h": H},
  "columns": N,
  "gutter_mm": X,
  "baseline_grid_pt": X.X,
  "typography": {
    "primary_face": "name",
    "size_pt": X,
    "leading_pt": X.X,
    "tracking_em": X,
    "measure_chars_or_words": X
  },
  "color_system": ["#rrggbb", ...],
  "hierarchy_levels": N,
  "japanese_typesetting": {
    "writing_mode": "horizontal|vertical",
    "kinsoku": "loose|standard|strict",
    "wa_eu_pairing": "none|same_size|baseline_shift"
  }
}
```

## 5. 20+ codex並列割り当て確定版

| ID | 担当 | テーブル | 目標件数 |
|---|---|---|---|
| C01 | 和文書体メーカー網羅 | fonts | 200 |
| C02 | 写研・古典・特殊和文 | fonts | 150 |
| C03 | 欧文古典セリフ | fonts | 200 |
| C04 | 欧文サンセリフ・現代 | fonts | 200 |
| C05 | 書体デザイナー＋ペアリング | font_designers, font_pairings | 200+50 |
| C06 | 日本書籍デザイナー＋作品 | designers, works_corpus | 80人+400作 |
| C07 | 海外書籍デザイナー＋作品 | designers, works_corpus | 60人+300作 |
| C08 | 海外雑誌AD＋特集 | designers, works_corpus | 70人+400件 |
| C09 | 日本雑誌AD＋特集＋出版社 | designers, studios_publishers | 50人+50社+300件 |
| C10 | 書籍パターン文芸/新書/実用/専門/絵本 | design_patterns | 1500 |
| C11 | 書籍パターン装幀/本文/扉/目次/奥付/帯 | design_patterns | 1500 |
| C12 | 雑誌パターンモード/カルチャー/ライフ/ビジネス | design_patterns | 1500 |
| C13 | 雑誌パターン表紙/目次/特集扉/記事/コラム | design_patterns | 1500 |
| C14 | レポート・年次報告書パターン | design_patterns | 1000 |
| C15 | 新聞・タブロイドパターン | design_patterns | 1000 |
| C16 | カタログ・図録・パンフレット・ZINE | design_patterns | 1000 |
| C17 | ジャンル横断・実験的パターン | design_patterns | 1000 |
| C18 | 書籍タイトル構文型＋帯コピー＋雑誌見出し | copy_techniques | 400 |
| C19 | コピーライター＋キャッチ・リード・キャプション | copywriters, copy_techniques | 40+600 |
| C20 | タイポグラフィ理論＋理論家 | theory_concepts, theorists | 227+55 |
| C21 | グリッド・版面理論＋判型＋カノン | grid_systems, layout_canons | 152 |
| C22 | 日本伝説書籍コーパス | works_corpus | 2000 |
| C23 | 海外伝説書籍コーパス | works_corpus | 1500 |
| C24 | 雑誌特集・記事コーパス | works_corpus | 1500 |

## 6. 合計目標（再確認）
- フォント: 750
- デザイナー: 260
- 出版社/スタジオ: 100
- 流派: 30
- パターン: **10,000+**
- コピー技法: 1,000
- 理論: 380
- 作例: 5,000

合計 **約17,500-20,000レコード**

## 7. 並列実行プロトコル
1. 各codexは担当テーブルのみ書き込み、ID衝突回避
2. SQLite書き込みは1コネクションずつ短時間で（WALモードで並列読みOK）
3. 関係テーブル（pattern_designer_links等）は全体収集後の後処理（Phase 4）
4. 各codex完了時に件数ログ → reports/ に集計

## 8. 検証フェーズ（Phase 4）
- 重複検出（name + foundry/publisherでgroup by）
- 外部キー整合性
- 座標JSONバリデーション（必須フィールド）
- カバレッジ監査（各カテゴリ最低件数）
- /eddエージェント定義作成
- メモリ登録（MEMORY.md）
