# Editorial Design DB — Validation Report

## Coverage
| Table | Count | Target | Coverage |
|---|---:|---:|---:|
| fonts | 764 | 750 | 101.9% |
| font_designers | 23 | — | — |
| font_pairings | 50 | — | — |
| designers | 243 | 260 | 93.5% |
| studios_publishers | 10 | 100 | 10.0% |
| schools_movements | 15 | 30 | 50.0% |
| design_patterns | 363 | 10000 | 3.6% |
| copy_techniques | 1127 | 1000 | 112.7% |
| copywriters | 40 | 40 | 100.0% |
| theory_concepts | 231 | 380 | 60.8% |
| theorists | 55 | — | — |
| grid_systems | 40 | 100 | 40.0% |
| layout_canons | 0 | — | — |
| works_corpus | 2594 | 5000 | 51.9% |
| trim_sizes | 30 | — | — |
| **TOTAL** | **5585** | | |

## JSON Field Validity
- `design_patterns.coordinate_json`: 363/363 valid JSON
- `design_patterns.typography_json`: 0/0 valid JSON
- `grid_systems.construction_rule_json`: 40/40 valid JSON
- `works_corpus.coordinate_json`: 0/0 valid JSON

## Duplicates
- `fonts` by (name, foundry): 0 duplicate groups
- `designers` by (name): 24 duplicate groups
- `design_patterns` by (pattern_code): 1 duplicate groups
- `works_corpus` by (title, year): 0 duplicate groups
