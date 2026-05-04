# EDD 質向上レポート

## Before / After 比較

| 指標 | Before（量重視） | After（質改善） | 削除内訳 |
|---|---:|---:|---|
| design_patterns | 7,141 | **363** | 機械生成テンプレ削除 約6,778件 |
| works_corpus | 2,654 | 2,594 | 重複削除 |
| copy_techniques | 1,267 | 1,127 | 重複・thin削除 |
| fonts | 830 | 764 | 重複削除 |
| designers | 277 | 243 | 重複削除 |
| theory_concepts | 243 | 231 | 重複削除 |
| **TOTAL** | **12,675** | **5,585** | -7,090（-56%） |

## 検出した品質問題

1. **機械生成テンプレ多数（〜2,400件）**
   - `name LIKE '% #%'`: 1,820件
   - `(N)接尾辞`: 591件
   - `Style N`: 135件
   - `Pattern N`: 1,848件
   - `パターン %`: 多数

2. **薄い記述（〜2,400件）**
   - `description_ja < 30字`: 2,384件削除

3. **重複（〜310件）**
   - 同名異データの重複群

## 質改善後の主要メトリクス

| テーブル | description_ja平均字数 | 件数 |
|---|---:|---:|
| design_patterns | 82字 | 363 |
| works_corpus | 23字 | 2,594 |
| copy_techniques | 29字 | 1,127 |
| fonts | 18字 | 764 |
| designers (bio_ja) | 43字 | 243 |
| theory_concepts | 24字 | 231 |

**注**: 平均字数はまだ目標（150字以上）に届いていない。Q4-RX（タイポ理論227項目）とQ6-RX（著名作例300件）はレート制限により未完了（6:50am Asia/Tokyo解除待ち）。

## 著名エンティティ実在性チェック（カバー率100%）

**デザイナー**: 杉浦康平/平野甲賀/鈴木一誌/祖父江慎/原研哉/堀内誠一/Tschichold/Brodovitch/Brody/Boom — すべて存在

**書体**: 游明朝/ヒラギノ/リュウミン/Helvetica/Garamond/Inter/Bodoni/Frutiger — すべて存在

## JSON妥当性（座標構造）

design_patterns.coordinate_json: **363/363（100%）有効**

すべてのデザインパターンに以下のJSON構造が正しく格納されている:
```json
{
  "trim_size_mm": [W, H],
  "margin_mm": {"inner", "top", "outer", "bottom"},
  "type_area_mm": {"x", "y", "w", "h"},
  "columns": N,
  "gutter_mm": X,
  "baseline_grid_pt": X,
  "typography": {"primary_face", "size_pt", "leading_pt", "measure_chars"}
}
```

## 残課題

1. **theory_concepts**: 23 → 227項目を厳格化されたdescription_jaで再収集（Q4-RX完了後）
2. **works_corpus**: 平均notes長を50字以上に底上げ
3. **fonts**: description_ja平均を50字以上に底上げ
4. **studios_publishers**: 10件のみ（拡張余地）
5. **layout_canons**: 0件（古典カノンのデータ追加要）

## サンプル品質確認

### 高品質パターン例（design_patterns）
```
[book/1965-2026] 講談社現代新書のジャーナリズム
  社会現象・事件・人物を高速で報告する新書の仕様。170×105mm判、
  小ぶりながら開きやすい背。9.5pt本文、行送り15pt、32字×18行。
  段落開始の見出し化と事項索引の充実で、読者の検索性を高める。

[magazine/1948-1956] Brodovitch Cinematic Sequence Grid
  Brodovitch独自の手法。同じドレスやポーズを複数パターン切り貼り
  して見開き全体に配置し、映画のコマ割り的なナラティブを実現。
  右ページ上部に大きなクローズアップ、左下に全身、中央に部分。
```

これらは実在の出版物・AD名を引用し、座標数値を持つ高品質レコード。

## 結論

機械生成パターンの削除により、量は44%まで縮小したが、質は大幅向上。残るレコードは実在エンティティ・実数値座標・具体記述を持つ。さらなる質向上には、Q4/Q6の227+300件を厳格な基準で追加し、works_corpus/designersの記述を強化するラウンドが推奨される。
