#!/usr/bin/env bash
set -uo pipefail

cd "$(dirname "$0")"
node scripts/dev-environment.mjs stop "$@"
result=$?

echo
if [[ "${CLOSERENT_NO_PAUSE:-0}" != "1" ]]; then
  read -r -p "Press Enter to close this window..."
fi
exit "$result"
