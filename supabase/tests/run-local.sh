#!/bin/zsh
# Applies schema.sql + every migration to a throwaway local PostgreSQL and
# runs the database-level tests. Needs `postgres`/`psql` on PATH (e.g.
# brew install postgresql@17). Nothing here touches the Supabase project.
set -e
PG=${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DATA=$(mktemp -d)
PORT=${PGPORT:-54329}
"$PG/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 >/dev/null
"$PG/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA" -l "$DATA/log" start >/dev/null
trap '"$PG/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1; rm -rf "$DATA"' EXIT
sleep 1
psqlx() { "$PG/psql" -v ON_ERROR_STOP=1 -q -h "$DATA" -p "$PORT" -U postgres "$@"; }
psqlx -c "create database diverge_test" postgres
psqlx -d diverge_test -f "$ROOT/supabase/tests/local-harness.sql"
psqlx -d diverge_test -f "$ROOT/supabase/schema.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  psqlx -d diverge_test -f "$f"
done
echo "running database tests"
psqlx -d diverge_test -f "$ROOT/supabase/tests/db.test.sql"
