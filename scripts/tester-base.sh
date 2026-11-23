#!/usr/bin/env bash
# Teste la migration Supabase sur un Postgres local (sans Supabase).
#   scripts/tester-base.sh            (nécessite un serveur PostgreSQL local et le droit de créer une base)
set -euo pipefail
cd "$(dirname "$0")/../supabase"
BASE="calbasse_test_$$"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
if [ "$(id -u)" = "0" ]; then run() { su postgres -c "$*"; }; else run() { bash -c "$*"; }; fi
run "psql -q -X -c 'create database $BASE'" >/dev/null
trap 'run "psql -q -X -c \"drop database $BASE\"" >/dev/null' EXIT
run "psql -v ON_ERROR_STOP=1 -q -X -d $BASE -f $PWD/tests/stub_supabase.sql"
for f in migrations/*.sql; do run "psql -v ON_ERROR_STOP=1 -q -X -d $BASE -f $PWD/$f"; done
run "psql -v ON_ERROR_STOP=1 -q -X -tA -d $BASE -f $PWD/tests/quota.sql" | tail -1
