#!/usr/bin/env bash
# EDD finalization: clean reset + load all seeds + validate.
set -e
cd "$(dirname "$0")/.."

echo "=== EDD finalization ==="
rm -f data/editorial_design.db
python3 scripts/init_db.py
python3 scripts/insert_seed.py
python3 scripts/validate.py
echo "=== done ==="
