#!/usr/bin/env python3
"""EDD validation — checks coverage, JSON validity, FK candidates."""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "editorial_design.db"
REPORT = ROOT / "reports" / "validation.md"


TABLES = [
    "fonts", "font_designers", "font_pairings", "designers", "studios_publishers",
    "schools_movements", "design_patterns", "copy_techniques", "copywriters",
    "theory_concepts", "theorists", "grid_systems", "layout_canons",
    "works_corpus", "trim_sizes",
]

TARGETS = {
    "fonts": 750,
    "designers": 260,
    "studios_publishers": 100,
    "schools_movements": 30,
    "design_patterns": 10000,
    "copy_techniques": 1000,
    "copywriters": 40,
    "theory_concepts": 380,
    "grid_systems": 100,
    "works_corpus": 5000,
}


def count_table(con, t):
    cur = con.cursor()
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    return cur.fetchone()[0]


def validate_json_column(con, table, col):
    cur = con.cursor()
    cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {col} IS NOT NULL AND {col} != ''")
    total = cur.fetchone()[0]
    cur.execute(f"SELECT id, {col} FROM {table} WHERE {col} IS NOT NULL AND {col} != ''")
    valid = 0
    for _, val in cur.fetchall():
        try:
            json.loads(val)
            valid += 1
        except (json.JSONDecodeError, TypeError):
            pass
    return valid, total


def find_duplicates(con, table, *cols):
    col_list = ", ".join(cols)
    cur = con.cursor()
    cur.execute(
        f"SELECT {col_list}, COUNT(*) FROM {table} GROUP BY {col_list} HAVING COUNT(*) > 1"
    )
    return cur.fetchall()


def main():
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB)

    lines = ["# Editorial Design DB — Validation Report", ""]
    total = 0
    lines.append("## Coverage")
    lines.append("| Table | Count | Target | Coverage |")
    lines.append("|---|---:|---:|---:|")
    for t in TABLES:
        n = count_table(con, t)
        total += n
        target = TARGETS.get(t, 0)
        cov = f"{100*n/target:.1f}%" if target else "—"
        lines.append(f"| {t} | {n} | {target or '—'} | {cov} |")
    lines.append(f"| **TOTAL** | **{total}** | | |")
    lines.append("")

    lines.append("## JSON Field Validity")
    cases = [
        ("design_patterns", "coordinate_json"),
        ("design_patterns", "typography_json"),
        ("grid_systems", "construction_rule_json"),
        ("works_corpus", "coordinate_json"),
    ]
    for tbl, col in cases:
        try:
            v, t = validate_json_column(con, tbl, col)
            lines.append(f"- `{tbl}.{col}`: {v}/{t} valid JSON")
        except sqlite3.OperationalError:
            lines.append(f"- `{tbl}.{col}`: column missing")
    lines.append("")

    lines.append("## Duplicates")
    for table, *cols in [
        ("fonts", "name", "foundry"),
        ("designers", "name"),
        ("design_patterns", "pattern_code"),
        ("works_corpus", "title", "year"),
    ]:
        try:
            dups = find_duplicates(con, table, *cols)
            lines.append(f"- `{table}` by ({', '.join(cols)}): {len(dups)} duplicate groups")
        except sqlite3.OperationalError:
            lines.append(f"- `{table}`: query failed")
    lines.append("")

    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"[ok] wrote {REPORT}")
    print(f"[total] {total} records")
    con.close()


if __name__ == "__main__":
    main()
