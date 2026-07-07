#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$ROOT_DIR"

npm run flush:data

printf 'Re-seed default system data? (yes/no) '
read -r reseed

case "$(printf '%s' "$reseed" | tr '[:upper:]' '[:lower:]')" in
  yes)
    npm run seed
    npm run verify:seed
    ;;
  *)
    echo 'Re-seed skipped.'
    ;;
esac

echo 'BCVS development environment reset completed.'
