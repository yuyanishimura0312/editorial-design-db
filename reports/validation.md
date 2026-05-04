# Editorial Design DB — Validation Report

## Coverage
| Table | Count | Target | Coverage |
|---|---:|---:|---:|
| fonts | 630 | 750 | 84.0% |
| font_designers | 23 | — | — |
| font_pairings | 50 | — | — |
| designers | 177 | 260 | 68.1% |
| studios_publishers | 10 | 100 | 10.0% |
| schools_movements | 15 | 30 | 50.0% |
| design_patterns | 6580 | 10000 | 65.8% |
| copy_techniques | 999 | 1000 | 99.9% |
| copywriters | 40 | 40 | 100.0% |
| theory_concepts | 227 | 380 | 59.7% |
| theorists | 55 | — | — |
| grid_systems | 40 | 100 | 40.0% |
| layout_canons | 0 | — | — |
| works_corpus | 2653 | 5000 | 53.1% |
| trim_sizes | 30 | — | — |
| **TOTAL** | **11529** | | |

## JSON Field Validity
- `design_patterns.coordinate_json`: 6580/6580 valid JSON
- `design_patterns.typography_json`: 1000/1000 valid JSON
- `grid_systems.construction_rule_json`: 40/40 valid JSON
- `works_corpus.coordinate_json`: 0/0 valid JSON

## Duplicates
- `fonts` by (name, foundry): 16 duplicate groups
- `designers` by (name): 11 duplicate groups
- `design_patterns` by (pattern_code): 0 duplicate groups
- `works_corpus` by (title, year): 47 duplicate groups
