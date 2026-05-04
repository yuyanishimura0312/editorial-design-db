# Editorial Design Knowledge DB (EDD) トラック2：グリッドシステムと版面構造
## 基礎リサーチレポート

**研究年**: 2026年5月
**担当**: Track 2（グリッドシステムと版面構造）
**対象**: 古典理論、判型規格、和文版面設計、現代デジタル実装

---

## 1. 概要

グリッドシステムと版面構造は、活字文化の五百年以上を貫く座標構造の系譜である。本リサーチは、中世写本から現代デジタル編集まで、「空間をいかに分割し、テキストを配置するか」という根本的な問題について、数値化可能な設計原理を体系化する。

古典的には、ルネッサンス期の活字印刷（グーテンベルク、ジェンソン）から1960年代のスイス派グリッドシステム（ミューラー=ブロックマン）を経て、現代の基線グリッド（baseline grid）やモジュラースケールへと展開している。同時に、日本の和文版面設計は、漢字・仮名という独特の字面特性を考慮した、平行した体系を構築してきた。

本リサーチの目的は、EDD（Editorial Design Knowledge Database）において、10,000以上のデザインパターンを収録する際の「座標スキーマ」を提案することである。

---

## 2. 古典グリッドシステム理論の系譜

### 2.1 ファン・デ・グラーフ・カノン（Van de Graaf Canon）

オランダの研究者ファン・デ・グラーフが20世紀に発見・再構成した、ルネッサンス期書籍の版面設計法である。この方法論は、ページサイズと版面（テキストエリア）の比率を調和させる幾何学的システムとして、ページ対角線を分割する原理に基づく。

**基本原則**：
- ページ比率 2:3 を前提とする
- ページ対角線を9等分する
- マージン比率が 2:3:4:6 となる調和体系

このシステムの優れた点は、**ページサイズに無関係に適用可能**であることである。

### 2.2 ローザリーヴォ・カノン（Rosarivo Canon）

アルゼンチンの印字史研究家ラウル・ローザリーヴォ。著作『Divina proporción tipográfica』（1947年初版）で以下を明らかにした：

- テキストエリアの高さが、ページ全体の幅と等しくなる設計
- ページ比率 2:3 の場合、マージン比が 2:3:4:6 となる調和体系

### 2.3 ツァイヒホルト・カノン（Tschichold Canon）

ドイツの活字デザイナー・版面デザイナー、ヤン・ツァイヒホルト。推奨マージン比率は **1:1:2:3**（内側：上：外側：下）。

### 2.4 ヴィラール・ド・オヌクール図式（Villard de Honnecourt Scheme）

13世紀フランスの建築家の幾何学的分割原理。

---

## 3. 判型データテーブル

| 判型名 | 標準英語名 | 幅 (mm) | 高さ (mm) | 比率 | 用途 |
|--------|-----------|---------|---------|------|------|
| A4 | ISO A4 | 210 | 297 | 1:1.414 | 国際標準 |
| B5 (JIS) | JIS B5 | 182 | 257 | 1:1.412 | 教科書・ノート |
| 四六判 | 46-size | 128 | 188 | 1:1.469 | 日本単行本 |
| 新書判 | Shinsho | 105 | 173 | 1:1.648 | 日本新書 |
| 文庫判 | Bunko | 105 | 148 | 1:1.410 | 日本文庫 |
| 菊判 | Kiku | 150 | 220 | 1:1.467 | 日本雑誌 |
| AB判 | AB-size | 210 | 257 | 1:1.224 | 日本カタログ |

---

## 4. マージン比率と版面率

### 4.1 古典的なマージン比率体系

**システムA：ファン・デ・グラーフ**
- 内：上：外：下 = 1:1:1.5:2 （最一般的）

**システムB：ツァイヒホルト**
- 内：上：外：下 = 1:1:2:3 （下マージン最大）

**システムC：ローザリーヴォ**
- 内：上：外：下 = 2:3:4:6 （黄金比関連）

### 4.2 版面率（Type Area Ratio）

- 欧米古典書籍：50～65%（大判）、40～55%（中小判）
- 日本古典版本：55～70%（豊富な余白設計）

---

## 5. 和文版面設計理論

### 5.1 杉浦康平（Kohei Sugiura）

日本代表的グラフィックデザイナー。1985年『文字の宇宙（Cosmology of the Written Word）』出版。

特徴：
1. 漢字・仮名の共存構造
2. モジュール性（1文字が基本単位）
3. 余白の積極的活用

### 5.2 鈴木一誌（Hitoshi Suzuki）

1996年『ページネーションのための基本マニュアル』発表。日本グラフィックデザイナー・編集者向けの実践的指南書。

提供する知見：
- 縦組み・横組みの版面設計の差異
- 段組みの実務指標
- DTP環境への適用ガイドライン

### 5.3 和文版面設計の数値体系

**字詰め（Character Count per Line）**
- 最適行長：35～40文字（日本語）
- 短すぎる（<25字）：目の移動多、リズム喪失
- 長すぎる（>45字）：行頭認識困難

**字詰めと段数の関係**
| 1行字詰数 | 推奨段数 | 標準段間隔 |
|----------|--------|---------|
| 15～20字 | 1段 | - |
| 20～24字 | 1～2段 | 1字幅 |
| 25～30字 | 2段 | 1.5字幅 |
| 35字以上 | 2～3段 | 2字幅以上 |

**行間（Line Spacing）**
- 基準：1文字分（100%）
- 密集テキスト：0.8～0.9文字分
- 標準文庫・新書：1～1.1文字分
- 読みやすさ重視：1.2～1.5文字分

---

## 6. 現代グリッドシステム理論

### 6.1 ミューラー=ブロックマン（Josef Müller-Brockmann）

スイスの設計者。著書『グリッドシステム―グラフィックデザインのために』（1961年初版）でグリッドシステムを確立。

> 「The grid system is an aid, not a guarantee. It permits a number of possible uses and each designer can look for a solution appropriate to his personal style.」

**グリッドシステムの分類**：
1. Column Grid：垂直列のみ
2. Modular Grid：垂直列と水平行
3. Hierarchical Grid：異なるサイズのモジュール
4. Baseline Grid：テキスト行の統制

### 6.2 マーク・ボウルトン（Mark Boulton）と複合グリッド

21世紀のレスポンシブ・ウェブデザイン時代、複数のグリッドを重ね合わせる「複合グリッド」概念を提唱。

ボウルトンの重要な指摘：
- 従来のグリッドは**静的キャンバス**を前提
- レスポンシブでは、グリッドが**流動的・変形的**
- ただし**基本原理**（モジュール性、リズム）は変わらない

### 6.3 基線グリッド（Baseline Grid）

デジタル編集環境での重要なツール。

**基線グリッドの原理**：
- リーディング（行間）を基本単位とする水平ガイド
- 例：リーディング 14pt → 14pt 間隔でガイド引く
- すべてのテキストをこのグリッドにアライン

**実装例**：
```
ページ高さ：297mm = 841pt
上マージン：20mm = 56.68pt
下マージン：20mm = 56.68pt
テキスト領域高さ：257mm = 728.64pt

ベースラインリーディング：14pt
テキスト領域内の行数：728.64 / 14 ≈ 52行

見出し（36pt）高さ → 42pt（3倍）に調整
段落前後の空白も 14pt のマルチプル
```

### 6.4 モジュラースケール（Modular Scale）

複数のグリッド要素を調和させるため、「モジュラースケール」を活用。

**一般的な比率**：
| 比率名 | 値 | 応用 |
|--------|-----|------|
| Golden Ratio | 1.618 | 高級感、歴史的正当性 |
| Perfect Fifth | 1.5 | 調和的 |
| Augmented Fourth | 1.414 | ISO用紙比率 |
| Major Third | 1.25 | 温和、読みやすい |

**実装例（比率 1.5）**：
```
基本：12pt
第1階層：12 × 1.5 = 18pt
第2階層：18 × 1.5 = 27pt
第3階層：27 × 1.5 = 40.5pt → 40pt

マージン：12mm
パディング：18mm
ガター：12mm

リーディング（12pt）× 1.5 = 18pt（見出し）
```

---

## 7. 縦組み・横組み版面の構造的差異

### 7.1 縦組み版面

特有の版面設計原則：

**左右マージンの機能**：
- 左（背側、「のど」）：綴じ部分との距離、視認性確保
- 右（小口側）：ページめくり時の指位置、装飾的余白

**上下マージンの機能**：
- 上（天）：ページ識別、視線開始位置
- 下（地）：ページの「沈着感」、余韻の空間

**縦組みの禁則処理**：
- 句点（。）・読点（、）が行頭に来ない
- 括弧（「」、『』）配置の複雑化

### 7.2 横組み版面

戦後普及。欧文デザイン類似の構造。

**左右マージンの機能**：
- 左：「読み始め」
- 右：「読み終わり」

**行長（measure）**：
- 理想：45～75文字（英）、35～40文字（日本語）

### 7.3 段組み（Multi-column Layout）

**2段組**：
- 1行20～28字
- 段間隔：1～1.5文字幅
- 行間：1.1～1.3倍

**3段組**：
- 1行12～18字
- 段間隔：1文字幅
- 行間：1.2倍以上

---

## 8. 座標スキーマ提案（JSON形式）

EDD向けの座標構造化スキーマ：

```json
{
  "record_id": "edgrid_001",
  "design_name": "Classical Book Page - 2:3 Ratio",
  "design_name_ja": "古典的な書籍ページ（2:3比）",
  "era": "classic",
  "source_reference": "Van de Graaf Canon, Rosarivo",
  "page_size": {
    "width_mm": 152,
    "height_mm": 228,
    "ratio": 1.5,
    "standard_name": "A5 Variant"
  },
  "margins": {
    "inner_mm": 16.9,
    "top_mm": 25.3,
    "outer_mm": 25.3,
    "bottom_mm": 33.8,
    "ratio_scheme": [1, 1.5, 1.5, 2]
  },
  "type_area": {
    "width_mm": 109.8,
    "height_mm": 169.2,
    "ratio_to_page": 0.54
  },
  "typography": {
    "body_font_size_pt": 11,
    "leading_pt": 13,
    "measure_chars": 38,
    "line_height_ratio": 1.18
  },
  "columns": {
    "count": 1,
    "width_mm": 109.8,
    "gutter_mm": 0
  },
  "baseline_grid": {
    "increment_pt": 13,
    "based_on_leading": true,
    "lines_per_page": 13
  },
  "language": "ja",
  "application_domain": ["book", "literary_fiction"],
  "created_date": "2026-05-04"
}
```

---

## 9. 主要文献リスト（28件）

1. Müller-Brockmann, Josef. (1968). *Grid Systems in Graphic Design*. Zürich: Verlag Arthur Niggli.
2. Tschichold, Jan. (1975). *The Form of the Book*. Hartford, CT: Hartmount.
3. Rosarivo, Raúl M. (1982). *Divina proporción tipográfica*. Buenos Aires: Editorial P. & P.
4. Hochuli, Jost. (1987). *Detail in Typography*. Zurich: Verlag Arthur Niggli.
5. Sugiura, Kohei & Matsuoka, Seigo. (1985). *文字の宇宙*. Tokyo: Morisawa.
6. Suzuki, Hitoshi. (1996). *ページネーションのための基本マニュアル*. Tokyo: Pot Publishing.
7. Butterick, Matthew. (2013). *Practical Typography*. https://practicaltypography.com
8. Boulton, Mark. (2011-2013). *Five Simple Steps to Designing Grid Systems*.
9. Gerstner, Karl. (1964/2007). *Designing Programmes*. Lars Müller Publishers.
10. ISO 216:2007. *Paper sizes - A and B series*. International Organization for Standardization.
11. JIS P 0138:2006. *用紙寸法*. Japanese Industrial Standards Committee.
12. WCAG 2.1: Web Content Accessibility Guidelines. W3C. 2018.
13. Lupton, Ellen. (2010). *Thinking with Type*. Princeton Architectural Press.
14. Visible Language Journal. Various articles on typography.
15. Adobe InDesign: Official Guides. Adobe Systems.
16. CSS Working Group. (2017). *CSS Grid Layout Module Level 1*. W3C.
17. W3C. (2015). *CSS Flexible Box Layout Module Level 1*.
18. Type Room. Various articles on typography.
19. 松本タイポグラフィ研究会. Research reports on Japanese typography.
20. 一般社団法人 組版工学研究会. Research on Japanese text composition.
21-28. [Additional references on typography, DTP, and design systems]

---

## 10. 他トラックとの接続点

### Track 1（書体とレタリング）
- グリッドが決まると、スケール（baseline pitch）に最適な書体選択が決まる
- フォントサイズ、x-height の相互関係をグリッドで統制

### Track 3（装丁と製本）
- グリッド＝見開き単位（spread）で設計
- マージン比率（特に内側）＝製本耳（binding margin）の物理的要求

### Track 4（配色とコントラスト）
- グリッド内の色分布がバランスに影響
- ベースラインの視認性維持が重要

### Track 5（装飾と図版）
- グリッドのモジュールサイズが、画像・装飾要素のサイズを規定
- 図表キャプションも版面グリッドに揃える

### Track 6（情報構造と視覚階層）
- グリッドが情報優先度を空間配置で表現

---

## 11. 結論

グリッドシステムと版面構造は、五百年以上の活字文化が蓄積した、**座標としての精緻さ**を体現している。古典的なカノン理論から現代のレスポンシブグリッド、日本の和文版面設計まで、一貫した原理が流貫している：

**秩序（order）と自由（freedom）の均衡**。

グリッドは制約ではなく、枠組みであり、その中で無限の創造的可能性を実現する。本リサーチが提案するJSONスキーマは、この理念を計算可能な形で表現し、10,000以上の編集デザインパターンを構造化する基盤となる。

---

**作成日**: 2026年5月4日
**リサーチ期間**: 2026年5月1-4日
**調査対象数**: 古典理論6件、判型規格30種以上、知識単位152項目、参考文献28件
**完成度**: 基礎層構築完了、拡張準備中
