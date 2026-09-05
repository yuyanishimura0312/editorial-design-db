#!/usr/bin/env python3
"""
designers に MoMA 由来の外部識別子を additive に付与する。

  python3 link_designers_moma.py [--dry-run] [--refresh]

★出所とライセンス
  https://github.com/MuseumofModernArt/collection （Artists.csv / **CC0**）
  メタデータのみ。画像は含まれない。

★不変則
  - 突合は**正規化した表示名の完全一致のみ**。★姓名の部分一致・あいまい一致は使わない
    （同名別人を結ぶと、後から見分けがつかない）
  - 一致しても、**生年が2年以上ずれる行は結ばない**。`link_conflict` に理由を残す
    （★実測 2026-09-05: Saul Bass で EDD 1915 / MoMA 1920 のずれを検出し、
      Wikidata Q536884 と照合して **EDD 側の誤り**と判明した。
      この検査が無ければ誤った生年のまま識別子だけ張ることになっていた）
  - 既存の列は一切 UPDATE しない。識別子は新規列にのみ入れる
  - 取れない識別子は NULL のまま（MoMA 側も Wiki QID は 3,247/15,934 しか持たない）
"""
import argparse
import csv
import os
import re
import sqlite3
import subprocess
import sys
import unicodedata
from datetime import datetime, timezone

DB = os.path.expanduser("~/projects/research/editorial-design-db/data/editorial_design.db")
SRC = "https://github.com/MuseumofModernArt/collection/raw/main/Artists.csv"
CACHE = "/private/tmp/claude-502/-Users-nishimura-/31c6d80b-a31c-4d87-b885-9ca5321c5592/scratchpad/dmdb/moma_artists.csv"
BIRTH_TOLERANCE = 2   # 年。これを超えたら結ばない


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKC", s or "").lower())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()

    if args.refresh or not os.path.exists(CACHE):
        subprocess.run(["curl", "-sL", "--max-time", "120", SRC, "-o", CACHE], check=True)

    moma = {}
    with open(CACHE, encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            n = norm(r["DisplayName"])
            if n and n not in moma:
                moma[n] = r

    con = sqlite3.connect(DB)
    cols = {r[1] for r in con.execute("PRAGMA table_info(designers)")}
    for col in ("moma_constituent_id", "wikidata_qid", "ulan_id",
                "link_source", "link_checked_at", "link_conflict"):
        if col not in cols:
            con.execute(f"ALTER TABLE designers ADD COLUMN {col} TEXT")  # additive
    con.commit()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    linked, conflicts, unmatched = [], [], 0

    for did, name, birth in con.execute(
            "SELECT id, name, birth_year FROM designers WHERE COALESCE(name,'')<>''"):
        m = moma.get(norm(name))
        if not m:
            unmatched += 1
            continue

        mb = (m.get("BeginDate") or "").strip()
        if birth and mb not in ("", "0"):
            try:
                if abs(int(str(birth)[:4]) - int(mb)) > BIRTH_TOLERANCE:
                    # ★結ばない。理由を残す（同名別人か、我々の生年が誤っているか）
                    conflicts.append((
                        f"名前一致だが生年が離れている: EDD={birth} / MoMA={mb} "
                        f"(ConstituentID={m['ConstituentID']}, QID={m.get('Wiki QID') or '-'}). "
                        f"★どちらが誤りかを確かめるまで結ばない", now, did))
                    continue
            except ValueError:
                pass

        linked.append((
            m["ConstituentID"],
            (m.get("Wiki QID") or "").strip() or None,
            (m.get("ULAN") or "").strip() or None if (m.get("ULAN") or "").strip() != "0" else None,
            "moma-collection-cc0", now, did))

    if not args.dry_run:
        con.executemany(
            """UPDATE designers SET moma_constituent_id=?, wikidata_qid=?, ulan_id=?,
               link_source=?, link_checked_at=? WHERE id=?""", linked)
        con.executemany(
            "UPDATE designers SET link_conflict=?, link_checked_at=? WHERE id=?", conflicts)
        con.commit()

    total = con.execute("SELECT COUNT(*) FROM designers").fetchone()[0]
    with_id = con.execute(
        "SELECT COUNT(*) FROM designers WHERE COALESCE(moma_constituent_id,'')<>''").fetchone()[0]
    with_qid = con.execute(
        "SELECT COUNT(*) FROM designers WHERE COALESCE(wikidata_qid,'')<>''").fetchone()[0]
    with_ulan = con.execute(
        "SELECT COUNT(*) FROM designers WHERE COALESCE(ulan_id,'')<>''").fetchone()[0]
    with_conf = con.execute(
        "SELECT COUNT(*) FROM designers WHERE COALESCE(link_conflict,'')<>''").fetchone()[0]

    print(f"[moma] 結んだ {len(linked)} / 保留(生年ずれ) {len(conflicts)} / 名前一致せず {unmatched}"
          + ("  ※--dry-run" if args.dry_run else ""))
    print(f"[moma] designers {total}: MoMA-ID {with_id} / Wikidata {with_qid} / ULAN {with_ulan}"
          f" / 保留 {with_conf}")
    print("[moma] ★突合は表示名の完全一致のみ。部分一致・あいまい一致は使っていない")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
