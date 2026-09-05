#!/usr/bin/env python3
"""
Google Fonts のファミリー・メタデータを EDD の書体層へ additive に取り込む。

  python3 ingest_google_fonts.py [--dry-run] [--refresh]

★出所とライセンス
  https://fonts.google.com/metadata/fonts （1リクエストで全ファミリー）
  書体ファイル自体は OFL 1.1 / Apache 2.0 / UFL 1.0 で再配布可だが、
  ★**ここで取り込むのはメタデータ（名称・設計者・分類・追加日・可変軸・言語）だけ**で、
  字形（アウトライン）は含まない。

★不変則
  - additive。既存 fonts 行を UPDATE しない（★手で入れた和文書体の記述を機械値で上書きしない）
  - 既存と同名のファミリーは**入れない**（重複を作らない。突合は正規化した名前で行う）
  - 取れなかった項目は NULL のまま。★推測で埋めない
  - `source_url` と `observed_at` を必ず持たせる（★時点の無いメタデータを入れない）
"""
import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone

DB = os.path.expanduser("~/projects/research/editorial-design-db/data/editorial_design.db")
SRC = "https://fonts.google.com/metadata/fonts"
CACHE = "/private/tmp/claude-502/-Users-nishimura-/31c6d80b-a31c-4d87-b885-9ca5321c5592/scratchpad/dmdb/gf.json"

# Google Fonts の category -> EDD classification
CATEGORY = {
    "Sans Serif": "sans-serif",
    "Serif": "serif",
    "Display": "display",
    "Handwriting": "handwriting",
    "Monospace": "monospace",
}

# 書字系 -> EDD script_type
# ★語彙は fonts テーブルの CHECK 制約が正本であり、ここに書き写さない（定義が2か所に割れる）。
#   起動時に制約から読み、写像できない書字系は **NULL のまま**にする。
#   実測 2026-09-05: 制約は japanese/latin/cjk/arabic/devanagari/mixed/other の7値。
#   Korean・Chinese を独自に足すと CHECK に落ちる（実際に落ちた）。
SCRIPT_RAW = {
    "Japanese": "japanese", "Korean": "cjk", "Chinese": "cjk",
    "Latin": "latin", "Arabic": "arabic", "Devanagari": "devanagari",
}


def allowed_script_types(con) -> set:
    """CHECK 制約から許容値を読む。★表に書き写さない。"""
    row = con.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='fonts'").fetchone()
    if not row or not row[0]:
        return set()
    m = re.search(r"script_type\s+IN\s*\(([^)]*)\)", row[0], re.I)
    return set(re.findall(r"'([^']+)'", m.group(1))) if m else set()


def norm(name: str) -> str:
    """突合用の正規化。空白・記号を落として小文字化する。"""
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def fetch(refresh: bool) -> dict:
    if refresh or not os.path.exists(CACHE):
        subprocess.run(["curl", "-sL", "--max-time", "60", SRC, "-o", CACHE], check=True)
    raw = open(CACHE, encoding="utf-8", errors="replace").read()
    return json.loads(raw[raw.index("{"):])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()

    data = fetch(args.refresh)
    fams = data.get("familyMetadataList", [])
    if not fams:
        print("[gf] familyMetadataList が空。取得に失敗している", file=sys.stderr)
        return 1
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    con = sqlite3.connect(DB)
    cols = {r[1] for r in con.execute("PRAGMA table_info(fonts)")}
    for col, ddl in (("source_url", "TEXT"), ("observed_at", "TEXT"), ("ingest_source", "TEXT")):
        if col not in cols:
            con.execute(f"ALTER TABLE fonts ADD COLUMN {col} {ddl}")  # additive
    con.commit()

    allowed = allowed_script_types(con)
    script_map = {k: v for k, v in SCRIPT_RAW.items() if not allowed or v in allowed}
    dropped = sorted(set(SCRIPT_RAW) - set(script_map))
    if dropped:
        print(f"[gf] ★CHECK 制約に無いため写像しない書字系: {', '.join(dropped)}（NULL のまま）")

    existing = {norm(r[0]) for r in con.execute("SELECT name FROM fonts") if r[0]}
    existing |= {norm(r[0]) for r in con.execute("SELECT name_native FROM fonts") if r[0]}

    added = skipped_dup = 0
    rows = []
    for f in fams:
        fam = f.get("family")
        if not fam:
            continue
        if norm(fam) in existing:
            skipped_dup += 1
            continue
        designers = f.get("designers") or []
        axes = f.get("axes") or []
        date_added = f.get("dateAdded") or ""
        year = date_added[:4] if re.match(r"^\d{4}", date_added) else None
        rows.append((
            fam,
            script_map.get(f.get("primaryScript") or "", None),
            CATEGORY.get(f.get("category") or "", None),
            "Google Fonts",
            ", ".join(designers) or None,
            year,
            json.dumps(axes, ensure_ascii=False) if axes else None,
            "open-source",
            f"https://fonts.google.com/specimen/{fam.replace(' ', '+')}",
            now,
            "google-fonts-metadata",
        ))
        existing.add(norm(fam))
        added += 1

    if not args.dry_run and rows:
        con.executemany(
            """INSERT INTO fonts
               (name, script_type, classification, foundry, designer, release_year,
                style_axes_json, license_type, source_url, observed_at, ingest_source)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""", rows)
        con.commit()

    total = con.execute("SELECT COUNT(*) FROM fonts").fetchone()[0]
    with_designer = con.execute(
        "SELECT COUNT(*) FROM fonts WHERE COALESCE(designer,'')<>''").fetchone()[0]
    with_url = con.execute(
        "SELECT COUNT(*) FROM fonts WHERE COALESCE(source_url,'')<>''").fetchone()[0]
    variable = con.execute(
        "SELECT COUNT(*) FROM fonts WHERE COALESCE(style_axes_json,'') NOT IN ('','[]')").fetchone()[0]

    print(f"[gf] 取得ファミリー {len(fams)}")
    print(f"[gf] 追加 {added} / 既存と同名で見送り {skipped_dup}"
          + ("  ※--dry-run のため書き込んでいない" if args.dry_run else ""))
    print(f"[gf] fonts 合計 {total} / 設計者あり {with_designer} / 出典あり {with_url} / 可変軸あり {variable}")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
