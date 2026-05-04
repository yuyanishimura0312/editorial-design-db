#!/usr/bin/env python3
"""Editorial Design Knowledge DB (EDD) — initialization script."""
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "schema" / "schema_v0_draft.sql"
DB_PATH = ROOT / "data" / "editorial_design.db"


def init_db(force: bool = False) -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists() and not force:
        print(f"[skip] DB already exists: {DB_PATH}")
        return
    if DB_PATH.exists() and force:
        DB_PATH.unlink()
        print(f"[reset] removed {DB_PATH}")

    schema_sql = SCHEMA.read_text(encoding="utf-8")
    con = sqlite3.connect(DB_PATH)
    try:
        con.executescript(schema_sql)
        con.commit()
        print(f"[ok] initialized {DB_PATH}")
        cur = con.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [r[0] for r in cur.fetchall()]
        print(f"[tables] {len(tables)}: {tables}")
    finally:
        con.close()


if __name__ == "__main__":
    force = "--force" in sys.argv
    init_db(force=force)
