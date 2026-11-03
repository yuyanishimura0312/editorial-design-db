#!/usr/bin/env python3
"""
fonts の手入力行に、機械で判別できる問題の印を付け、使える行だけを返すビューを作る（additive）。

  python3 flag_fonts.py [--dry-run]

印（acd_row_flag, table_name='fonts'。行は消さない・値は書き換えない）
  synthetic_placeholder  is_synthetic=1 の行（Experimental-NN と Foundry-N の組）
  foundry_placeholder    制作元が仮の名前（Design Foundry / Premium Foundry / Foundry）
  script_conflicts_official  名前が Google Fonts のファミリーと完全一致し、書字系が Google の主書字系と食い違う
  duplicate_name         同じ名前（小文字化）が複数行ある。google-fonts-metadata 行が在ればそれ以外に付ける

ビュー v_fonts_usable
  公式データで裏づけた行だけ: ingest_source='google-fonts-metadata' かつ source_url が在り、印が無い行。
  手入力行は、制作元の公式ページで確かめるまでここに出さない（★確かめていないのであって、誤りと決めたのではない）。

冪等: set_by がこのスクリプトの印を消してから付け直す。
"""
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

DB = os.path.expanduser("~/projects/research/editorial-design-db/data/editorial_design.db")
GF = sys.argv[sys.argv.index("--gf") + 1] if "--gf" in sys.argv else None
BY = "editorial-design-db/etl/flag_fonts.py"
PLACEHOLDER_FOUNDRY = ("Design Foundry", "Premium Foundry", "Foundry")

con = sqlite3.connect(DB)
now = datetime.now(timezone.utc).isoformat()
rows = con.execute("select id, name, script_type, foundry, is_synthetic, ingest_source from fonts").fetchall()
flags = []
for fid, name, sc, foundry, syn, src in rows:
    if src is None and syn == 1:
        flags.append((fid, "synthetic_placeholder", "is_synthetic=1"))
    if src is None and (foundry in PLACEHOLDER_FOUNDRY or (foundry or "").startswith("Foundry-")):
        flags.append((fid, "foundry_placeholder", f"foundry={foundry}"))

if GF:
    raw = open(GF, encoding="utf-8").read()
    fams = {f["family"]: f for f in json.loads(raw[raw.index("{"):])["familyMetadataList"]}
    for fid, name, sc, foundry, syn, src in rows:
        if src is None and name in fams:
            ps = fams[name].get("primaryScript") or ""
            official_ja = ps in ("Jpan", "Hira", "Kana")
            if (sc == "japanese") != official_ja and sc is not None:
                flags.append((fid, "script_conflicts_official", f"script_type={sc}; google primaryScript='{ps}'"))

groups = {}
for fid, name, sc, foundry, syn, src in rows:
    groups.setdefault((name or "").strip().lower(), []).append((fid, src))
for key, members in groups.items():
    if len(members) < 2 or not key:
        continue
    keep = next((fid for fid, src in members if src == "google-fonts-metadata"), min(fid for fid, _ in members))
    for fid, _ in members:
        if fid != keep:
            flags.append((fid, "duplicate_name", f"same name as fonts.id={keep}"))

count = {}
for _, f, _ in flags:
    count[f] = count.get(f, 0) + 1
print(json.dumps(count, ensure_ascii=False), "flagged rows", len({fid for fid, _, _ in flags}))
if "--dry-run" in sys.argv:
    sys.exit()
with con:
    con.execute("delete from acd_row_flag where table_name='fonts' and set_by=?", (BY,))
    con.executemany("insert into acd_row_flag (table_name, row_id, flag, detail, set_by, set_at) values ('fonts',?,?,?,?,?)",
                    [(fid, f, d, BY, now) for fid, f, d in flags])
    con.execute("drop view if exists v_fonts_usable")
    con.execute("""create view v_fonts_usable as
        select f.* from fonts f
        where f.ingest_source = 'google-fonts-metadata' and coalesce(f.source_url, '') <> ''
          and not exists (select 1 from acd_row_flag r where r.table_name = 'fonts' and r.row_id = f.id)""")
print("usable", con.execute("select count(*) from v_fonts_usable").fetchone()[0],
      "japanese usable", con.execute("select count(*) from v_fonts_usable where script_type='japanese'").fetchone()[0],
      "integrity", con.execute("pragma integrity_check").fetchone()[0])
