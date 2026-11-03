#!/usr/bin/env python3
"""
Google Fonts 由来の fonts 行の空欄を、Google の公式データで埋める（additive）。

  python3 enrich_google_fonts.py [--dry-run]

埋める欄（★NULL の欄だけ。値のある欄は上書きしない）
  weights      fonts.google.com/metadata/fonts の fonts キー（例 "100,200,400,400i,700"）
  script_type  同 primaryScript（ISO 15924）を fonts の CHECK 制約の語彙へ写す。'' は NULL のまま（推測しない）
  license_terms github.com/google/fonts の METADATA.pb の license 欄（OFL-1.1 / Apache-2.0 / UFL-1.0）

★対象は ingest_source='google-fonts-metadata' の行だけ（手で入れた行には触らない）
★ライセンスは、ファミリー名を正規化して一致したディレクトリの METADATA.pb を取得し、
  その name 欄がファミリー名と完全に一致したときだけ採る（名前の近さで結ばない）
★取得した本文は sha256 つきで保存し、acq_fetch と row_provenance に来歴を残す
"""
import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

DB = os.path.expanduser("~/projects/research/editorial-design-db/data/editorial_design.db")
META = "https://fonts.google.com/metadata/fonts"
RAW = "/Volumes/Data/web-design-kdb/raw-fonts"
ACTOR = "editorial-design-db/etl/enrich_google_fonts.py"
LICENSE = {"OFL": "OFL-1.1", "APACHE2": "Apache-2.0", "UFL": "UFL-1.0"}
SCRIPT = {"Jpan": "japanese", "Hira": "japanese", "Kana": "japanese", "Kore": "cjk", "Hang": "cjk",
          "Hans": "cjk", "Hant": "cjk", "Hani": "cjk", "Latn": "latin", "Arab": "arabic", "Deva": "devanagari"}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "miratuku-edd-enrich/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception:
        return None, b""


def save(body):
    sha = hashlib.sha256(body).hexdigest()
    os.makedirs(RAW, exist_ok=True)
    path = f"{RAW}/{sha}"
    if not os.path.exists(path):
        open(path, "wb").write(body)
    return sha


def tree(path_sha):
    st, body = get(f"https://api.github.com/repos/google/fonts/git/trees/{path_sha}")
    return json.loads(body) if st == 200 else {}


def weights(fonts_field):
    try:
        keys = list(fonts_field.keys()) if isinstance(fonts_field, dict) else []
    except Exception:
        keys = []
    keys = [k for k in keys if re.fullmatch(r"\d{3}i?", k)]
    keys.sort(key=lambda k: (int(k[:3]), k.endswith("i")))
    return ",".join(keys) or None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    now = datetime.now(timezone.utc).isoformat()
    con = sqlite3.connect(DB)
    allowed = set(re.findall(r"'([^']+)'", re.search(r"script_type[^(]*IN\s*\(([^)]*)\)",
                  con.execute("select sql from sqlite_master where name='fonts'").fetchone()[0]).group(1)))

    st, body = get(META)
    if st != 200:
        sys.exit(f"metadata fetch failed: {st}")
    meta_sha = save(body)
    raw = body.decode("utf-8", "replace")
    fams = {f["family"]: f for f in json.loads(raw[raw.index("{"):])["familyMetadataList"]}

    root = tree("main")
    dirs = {}
    for t in root.get("tree", []):
        if t["path"] in ("ofl", "apache", "ufl"):
            sub = tree(t["sha"])
            if sub.get("truncated"):
                sys.exit(f"tree {t['path']} truncated")
            for e in sub.get("tree", []):
                if e["type"] == "tree":
                    dirs.setdefault(norm(e["path"]), []).append(f"{t['path']}/{e['path']}")

    rows = con.execute("select id, name, weights, script_type, license_terms from fonts "
                       "where ingest_source='google-fonts-metadata'").fetchall()

    def lic(name):
        for d in dirs.get(norm(name), []):
            url = f"https://raw.githubusercontent.com/google/fonts/main/{d}/METADATA.pb"
            st, b = get(url)
            text = b.decode("utf-8", "replace")
            m = re.search(r'^name:\s*"([^"]*)"', text, re.M)
            if st == 200 and m and m.group(1) == name:
                lm = re.search(r'^license:\s*"([^"]*)"', text, re.M)
                return url, st, b, (lm.group(0) if lm else None), LICENSE.get(lm.group(1)) if lm else None
        return None

    need = [r for r in rows if r[4] is None]
    with ThreadPoolExecutor(8) as ex:
        found = dict(zip([r[0] for r in need], ex.map(lambda r: lic(r[1]), need)))

    upd, prov, fetches = [], [], []
    stat = {"weights": 0, "script_type": 0, "license_terms": 0, "no_family": 0, "no_license_dir": 0}
    meta_fetch = ("google-fonts-metadata", META, META, now, "ok", 200, meta_sha, len(body), ACTOR)
    for fid, name, w, sc, lt in rows:
        f = fams.get(name)
        if f is None:
            stat["no_family"] += 1
            continue
        new = {}
        if w is None and weights(f.get("fonts")):
            new["weights"] = weights(f.get("fonts"))
        code = f.get("primaryScript") or ""
        if sc is None and code:
            mapped = SCRIPT.get(code, "other")
            if mapped in allowed:
                new["script_type"] = mapped
        q_meta = json.dumps({"family": name, "primaryScript": code, "fonts": sorted((f.get("fonts") or {}).keys())},
                            ensure_ascii=False)
        if new:
            prov.append(("fonts", fid, name, "meta", q_meta))
        if lt is None:
            hit = found.get(fid)
            if hit and hit[4]:
                url, st2, b2, line, terms = hit
                new["license_terms"] = terms
                fetches.append((f"gfpb:{name}", url, url, now, "ok", st2, save(b2), len(b2), ACTOR))
                prov.append(("fonts", fid, name, url, line))
            else:
                stat["no_license_dir"] += 1
        for k in new:
            stat[k] += 1
        if new:
            upd.append((fid, new))

    print(json.dumps({"rows": len(rows), "updated_rows": len(upd), **stat}, ensure_ascii=False))
    if args.dry_run:
        return
    with con:
        ids = {}
        for f in [meta_fetch] + fetches:
            cur = con.execute("insert into acq_fetch (locator, requested_url, attempted_at, outcome, http_status,"
                              " content_hash, bytes, actor) values (?,?,?,?,?,?,?,?)", f[1:])
            ids[f[0] if f[0] != "google-fonts-metadata" else "meta"] = cur.lastrowid
        for fid, new in upd:
            sets = ", ".join(f"{k}=?" for k in new)
            con.execute(f"update fonts set {sets} where id=? and " + " and ".join(f"{k} is null" for k in new),
                        [*new.values(), fid])
        for table, fid, name, key, quote in prov:
            fetch_id = ids["meta"] if key == "meta" else ids[f"gfpb:{name}"]
            con.execute("insert into row_provenance (table_name, row_id, source_key, fetch_id, quote, quote_found,"
                        " summary_by, extracted_by, inferred, ingested_at) values (?,?,?,?,?,?,?,?,?,?)",
                        (table, fid, f"gf:{name}:{'meta' if key == 'meta' else 'license'}", fetch_id, quote, 1, "none (field copy)", ACTOR, "{}", now))
    print("integrity", con.execute("pragma integrity_check").fetchone()[0])


if __name__ == "__main__":
    main()
