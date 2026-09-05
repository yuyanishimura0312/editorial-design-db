#!/usr/bin/env python3
"""
designers の同名重複に印を付ける（★削除しない）。

  python3 flag_designer_duplicates.py [--dry-run]

★なぜ削除しないか
  規範「削除より flag」。243行中26行が重複だが、重複は別々の投入回の産物で、
  行ごとに埋まっている列が違う（充実した行と空に近い行が混在する）。
  消すと「どの投入でどこまで埋まったか」が失われ、同じ重複が再び作られる。

★代表行の選び方（決定論・恣意を入れない）
  非空の列が最も多い行を代表とし、同数なら id の小さい方。
  ★「良さそうな方」を人が選ばない。

★発見の経緯
  2026-09-05、MoMA 識別子を付与したところ Saul Bass が3行返った。
  重複は識別子を張るまで見えていなかった（★接続は在庫の検査にもなる）。
"""
import argparse
import os
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timezone

DB = os.path.expanduser("~/projects/research/editorial-design-db/data/editorial_design.db")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    con = sqlite3.connect(DB)
    cols = {r[1] for r in con.execute("PRAGMA table_info(designers)")}
    for col in ("duplicate_of", "dup_note"):
        if col not in cols:
            con.execute(f"ALTER TABLE designers ADD COLUMN {col} TEXT")  # additive
    con.commit()

    names = [c for c in
             (r[1] for r in con.execute("PRAGMA table_info(designers)"))
             if c not in ("id", "duplicate_of", "dup_note",
                          "link_source", "link_checked_at", "link_conflict")]
    sel = ", ".join(["id", "name"] + names)

    groups = defaultdict(list)
    for row in con.execute(f"SELECT {sel} FROM designers WHERE COALESCE(name,'')<>''"):
        did, name = row[0], row[1]
        filled = sum(1 for v in row[2:] if v not in (None, "", 0))
        groups[name].append((did, filled))

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    updates, kept = [], 0
    for name, members in groups.items():
        if len(members) < 2:
            continue
        # 非空列が最多 → 同数なら id 昇順
        members.sort(key=lambda x: (-x[1], x[0]))
        canon = members[0][0]
        kept += 1
        for did, filled in members[1:]:
            updates.append((
                str(canon),
                f"[{now}] 同名重複。代表は id={canon}（非空列 {members[0][1]} 対 この行 {filled}）。"
                f"★削除しない — 別々の投入回の産物で、行ごとに埋まった列が違う",
                did))

    if not args.dry_run and updates:
        con.executemany(
            "UPDATE designers SET duplicate_of=?, dup_note=? WHERE id=?", updates)
        con.commit()

    total = con.execute("SELECT COUNT(*) FROM designers").fetchone()[0]
    uniq = con.execute("SELECT COUNT(DISTINCT name) FROM designers").fetchone()[0]
    flagged = con.execute(
        "SELECT COUNT(*) FROM designers WHERE COALESCE(duplicate_of,'')<>''").fetchone()[0]
    print(f"[dup] 重複グループ {kept} / 印をつけた行 {len(updates)}"
          + ("  ※--dry-run" if args.dry_run else ""))
    print(f"[dup] designers {total} 行 / 異なり {uniq} 名 / duplicate_of あり {flagged}")
    print("[dup] ★件数を配るときは異なり数を使う（行数は投入回の重複を含む）")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
