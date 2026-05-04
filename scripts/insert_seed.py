#!/usr/bin/env python3
"""EDD seed loader — robust ingestion of agent-produced JSONL files."""
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "editorial_design.db"
SEED_DIR = ROOT / "data" / "seed"

TABLE_FROM_STEM = re.compile(r"_(C|Q|R)\d+$")

# Field aliases by table — agents sometimes write slightly different names.
ALIASES = {
    "designers": {"name_ja_official": "name_ja", "japanese_name": "name_ja"},
    "fonts": {"font_name": "name", "font_name_ja": "name_ja"},
    "works_corpus": {
        "title_ja_only": "title_ja",
        "publication_title": "title",
        "publication": "publication",
        "issue": "issue_or_volume",
    },
    "copy_techniques": {"technique_name": "name", "technique_name_ja": "name_ja"},
    "copywriters": {"copywriter_name": "name", "copywriter_name_ja": "name_ja"},
    "design_patterns": {
        "design_name": "name",
        "design_name_ja": "name_ja",
        "style": "name",
        "structural_role_ja": "structural_role_ja_alias",
        "example_works_text": "example_works",
    },
    "grid_systems": {
        "design_name": "name",
        "design_name_ja": "name_ja",
    },
    "theory_concepts": {
        "concept_name": "name",
        "concept_name_ja": "name_ja",
    },
    "theorists": {
        "theorist_name": "name",
    },
}

# Special: pack flat coordinate fields into coordinate_json for design_patterns.
COORDINATE_FIELDS = {
    "trim_size_mm",
    "bleed_mm",
    "columns",
    "gutter_mm",
    "baseline_grid_pt",
    "typography",
    "color_system",
    "margin_mm",
    "type_area_mm",
    "hierarchy_levels",
}

# Drop these columns from records — they're auto-generated.
DROP_COLS = {"id", "created_at"}


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def resolve_table(stem: str) -> str:
    return TABLE_FROM_STEM.sub("", stem)


def get_table_columns(con: sqlite3.Connection, table: str) -> list[str]:
    cur = con.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cur.fetchall()]


def normalize_record(record: dict, table: str, valid_cols: set[str]) -> dict:
    aliases = ALIASES.get(table, {})
    out: dict = {}
    coordinate_collected: dict = {}

    for k, v in record.items():
        if k in DROP_COLS:
            continue
        key = aliases.get(k, k)
        # Pack flat coordinate fields into coordinate_json for design_patterns.
        if table == "design_patterns" and key in COORDINATE_FIELDS and "coordinate_json" in valid_cols:
            coordinate_collected[key] = v
            continue
        if key not in valid_cols:
            continue
        if isinstance(v, (dict, list)):
            out[key] = json.dumps(v, ensure_ascii=False)
        else:
            out[key] = v

    if coordinate_collected:
        existing = out.get("coordinate_json")
        if existing:
            try:
                merged = json.loads(existing)
                merged.update(coordinate_collected)
                out["coordinate_json"] = json.dumps(merged, ensure_ascii=False)
            except json.JSONDecodeError:
                out["coordinate_json"] = json.dumps(coordinate_collected, ensure_ascii=False)
        else:
            out["coordinate_json"] = json.dumps(coordinate_collected, ensure_ascii=False)

    # Auto-fill name/title from alternates if missing.
    if "name" in valid_cols and not out.get("name"):
        for alt in ("name_ja", "design_name", "design_name_ja", "pattern_code"):
            if record.get(alt):
                out["name"] = record[alt]
                break
    if "title" in valid_cols and not out.get("title"):
        for alt in ("title_ja", "publication", "issue_or_volume"):
            if record.get(alt):
                out["title"] = record[alt]
                break
    if "description" in valid_cols and not out.get("description"):
        if out.get("description_ja"):
            out["description"] = out["description_ja"]
    return out


def insert_records(con: sqlite3.Connection, table: str, records: list[dict]) -> int:
    if not records:
        return 0
    cols_per_record: list[list[str]] = [list(r.keys()) for r in records]
    success = 0
    cur = con.cursor()
    for r, cols in zip(records, cols_per_record):
        if not cols:
            continue
        col_list = ",".join(cols)
        placeholders = ",".join("?" * len(cols))
        sql = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})"
        try:
            cur.execute(sql, tuple(r.get(c) for c in cols))
            success += 1
        except sqlite3.Error:
            continue
    con.commit()
    return success


def main() -> None:
    if not DB_PATH.exists():
        print(f"[error] DB not found: {DB_PATH} — run init_db.py first")
        return

    con = sqlite3.connect(DB_PATH)
    total = 0
    try:
        sources = list(sorted(SEED_DIR.glob("*.jsonl"))) + list(sorted((ROOT / "data" / "seed_q").glob("*.jsonl")))
        for jsonl in sources:
            table = resolve_table(jsonl.stem)
            records = load_jsonl(jsonl)
            if not records:
                print(f"[skip] {jsonl.name}: empty")
                continue
            try:
                valid = set(get_table_columns(con, table))
            except sqlite3.OperationalError:
                print(f"[skip] {jsonl.name}: table {table} missing")
                continue
            normalized = [normalize_record(r, table, valid) for r in records]
            normalized = [r for r in normalized if r]
            n = insert_records(con, table, normalized)
            print(f"[seed] {jsonl.name} -> {table}: {n}/{len(records)}")
            total += n
    finally:
        con.close()
    print(f"[done] total seeded: {total} rows")


if __name__ == "__main__":
    main()
