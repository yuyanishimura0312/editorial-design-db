#!/usr/bin/env python3
"""
手入力の和文書体のうち、制作元の公式ページで確かめられた行に印を付ける（additive）。

  python3 apply_font_verification.py <stage20 dir> [--dry-run]

入力（~/work/web-design-kdb-rebuild/stage20）
  verified.jsonl      codex が見つけた公式ページを、こちらで取り直して引用と書体名が本文に在ると確かめた結果
  judge-result.jsonl  Sonnet（収集した codex と別系統）の判定: same_typeface / maker_ok / class_ok
  audit-result.jsonl  Opus 盲検の標本20件（乱数種 20261111）の判定

印（acd_row_flag, table_name='fonts'）
  verified_official         同一書体・制作元一致・分類が矛盾しない。detail に公式URL
  maker_conflicts_official  制作元が公式と食い違う
  class_conflicts_official  分類が公式と食い違う
  audit_class_doubt         盲検で分類の疑いが指摘された行（個別）
空の source_url / observed_at だけを公式URL と取得時刻で埋める。値のある欄は書き換えない。
v_fonts_usable の定義は flag_fonts.py が持つ（verified_official の行を含める）。冪等。
"""
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

DB = os.path.expanduser("~/projects/research/editorial-design-db/data/editorial_design.db")
BY = "editorial-design-db/etl/apply_font_verification.py"
DOUBT = {"f134": "Georgia は欧文のセリフ体だが分類が mincho（Opus 盲検 2026-11-03 の指摘）"}

d = Path(sys.argv[1])
ver = {json.loads(l)["id"]: json.loads(l) for l in open(d / "verified.jsonl")}
jud = {json.loads(l)["id"]: json.loads(l) for l in open(d / "judge-result.jsonl")}
aud = [json.loads(l) for l in open(d / "audit-result.jsonl")]
bad = [a for a in aud if a.get("pass") != "yes"]
if len(bad) > 3:
    sys.exit(f"audit failed: {len(bad)} of {len(aud)} not yes; nothing applied")
now = datetime.now(timezone.utc).isoformat()
flags, fills = [], []
for iid, j in jud.items():
    fid, url = ver[iid]["edd_id"], ver[iid]["url"]
    if j["maker_ok"] == "no":
        flags.append((fid, "maker_conflicts_official", f"{url} | {j.get('note', '')}"[:500]))
    if j["class_ok"] == "no":
        flags.append((fid, "class_conflicts_official", f"{url} | {j.get('note', '')}"[:500]))
    if iid in DOUBT:
        flags.append((fid, "audit_class_doubt", DOUBT[iid]))
    if j["same_typeface"] == "yes" and j["maker_ok"] == "yes" and j["class_ok"] != "no":
        flags.append((fid, "verified_official", url))
        fills.append((url, now, fid))
count = {}
for _, f, _ in flags:
    count[f] = count.get(f, 0) + 1
print(json.dumps(count, ensure_ascii=False))
if "--dry-run" in sys.argv:
    sys.exit()
con = sqlite3.connect(DB)
with con:
    con.execute("delete from acd_row_flag where table_name='fonts' and set_by=?", (BY,))
    con.executemany("insert into acd_row_flag (table_name, row_id, flag, detail, set_by, set_at) values ('fonts',?,?,?,?,?)",
                    [(fid, f, det, BY, now) for fid, f, det in flags])
    con.executemany("update fonts set source_url=coalesce(source_url, ?), observed_at=coalesce(observed_at, ?) where id=?", fills)
print("integrity", con.execute("pragma integrity_check").fetchone()[0])
