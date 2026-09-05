#!/usr/bin/env python3
"""
design_patterns の判断層（use_when / avoid_when）を TSV から適用する。

  python3 apply_pattern_judgment.py out_*.tsv [--dry-run]

★不変則
  - id は必ず既存行に一致すること。★存在しない id への UPDATE は 0 行で成功するので、
    件数を必ず突き合わせる（UPDATE は嘘をつく）
  - 既に埋まっている行は上書きしない（再実行を安全にする）
  - `導出不能` はそのまま入れる。★空欄にしない（「まだ判定していない」と区別がつかなくなる）
  - 元の説明文に無い固有名・数値が混ざっていないかは**別人格の検証**に委ねる
    （ここでは機械的に入れられる形式検査だけを行う）
"""
import argparse
import csv
import os
import sqlite3
import sys

DB = os.path.expanduser("~/projects/research/editorial-design-db/data/editorial_design.db")
MIN_LEN, MAX_LEN = 20, 400


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    con = sqlite3.connect(DB)
    valid_ids = {r[0] for r in con.execute("SELECT id FROM design_patterns")}
    already = {r[0] for r in con.execute(
        "SELECT id FROM design_patterns WHERE COALESCE(use_when,'')<>''")}

    rows, rejected = [], []
    seen = set()
    for path in args.files:
        with open(path, encoding="utf-8", errors="replace") as fh:
            for i, rec in enumerate(csv.reader(fh, delimiter="\t")):
                if i == 0 and rec and rec[0].strip().lower() == "id":
                    continue
                if len(rec) != 3:
                    rejected.append((os.path.basename(path), i, f"列数{len(rec)}"))
                    continue
                sid, use, avoid = (c.strip() for c in rec)
                if not sid.isdigit():
                    rejected.append((os.path.basename(path), i, f"id不正 {sid!r}"))
                    continue
                pid = int(sid)
                if pid not in valid_ids:
                    # ★存在しない id を黙って捨てない。UPDATE は 0 行で成功する
                    rejected.append((os.path.basename(path), i, f"id {pid} が design_patterns に無い"))
                    continue
                if pid in seen:
                    rejected.append((os.path.basename(path), i, f"id {pid} 重複"))
                    continue
                if pid in already:
                    rejected.append((os.path.basename(path), i, f"id {pid} は既に埋まっている（上書きしない）"))
                    continue
                if use == "導出不能" and avoid == "導出不能":
                    seen.add(pid)
                    rows.append((use, avoid, pid))
                    continue
                bad = [n for n, v in (("use_when", use), ("avoid_when", avoid))
                       if not (MIN_LEN <= len(v) <= MAX_LEN)]
                if bad:
                    rejected.append((os.path.basename(path), i, f"id {pid} 長さ不正 {bad}"))
                    continue
                seen.add(pid)
                rows.append((use, avoid, pid))

    if not args.dry_run and rows:
        cur = con.executemany(
            "UPDATE design_patterns SET use_when=?, avoid_when=? WHERE id=?", rows)
        con.commit()
        # ★UPDATE の実行行数と、入れようとした行数を必ず突き合わせる
        if cur.rowcount != len(rows):
            print(f"[apply] ★不一致: 入れた{len(rows)} 反映{cur.rowcount}", file=sys.stderr)

    total = con.execute("SELECT COUNT(*) FROM design_patterns").fetchone()[0]
    filled = con.execute(
        "SELECT COUNT(*) FROM design_patterns WHERE COALESCE(use_when,'')<>''").fetchone()[0]
    undecided = con.execute(
        "SELECT COUNT(*) FROM design_patterns WHERE use_when='導出不能'").fetchone()[0]
    print(f"[apply] 適用 {len(rows)}{' (dry-run)' if args.dry_run else ''} / 却下 {len(rejected)}")
    print(f"[apply] design_patterns {filled}/{total} に判断層あり（うち導出不能 {undecided}）")
    for r in rejected[:12]:
        print(f"[apply] reject {r[0]}:{r[1]} {r[2]}")
    if len(rejected) > 12:
        print(f"[apply] ... 他 {len(rejected)-12} 件")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
