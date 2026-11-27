#!/usr/bin/env bash
# Runs E2E against a clean copy of HEAD, so files that are mid-edit in the working tree can't break the run.
# The copy (about 500 MB with its node_modules), and Playwright's data folder inside it, go when the script
# ends, also on failure, Ctrl-C and SIGTERM. E2E_KEEP=1 keeps them for debugging.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
dir=$(mktemp -d "${TMPDIR:-/tmp}/tracker-e2e-XXXXXX")
child=

cleanup() {
  if [ "${E2E_KEEP:-}" = 1 ]; then
    echo "E2E_KEEP=1: kept the copy at $dir" >&2
  else
    rm -rf -- "$dir"
  fi
}

# Bash runs a trap only once its foreground command ends, so each step runs in the background while the
# script waits for it: a SIGTERM then stops the step at once instead of after the whole run. The step
# gets a SIGINT either way: Playwright stops its web servers on SIGINT, but dies on SIGTERM and leaves
# the API server running. A second Ctrl-C then reaches it alone and stops it at once.
stop() {
  trap '' INT TERM
  if [ -n "$child" ]; then
    kill -INT "$child" 2>/dev/null || true
    wait "$child" 2>/dev/null || true
  fi

  exit "$1"
}

run() {
  "$@" &
  child=$!
  wait "$child"
  child=
}

trap cleanup EXIT
trap 'stop 130' INT
trap 'stop 143' TERM

git -C "$root" archive HEAD | tar -x -C "$dir"
cd "$dir"
export E2E_DATA_DIR="${E2E_DATA_DIR:-$dir/e2e-data}"
mkdir -p "$E2E_DATA_DIR"

run env HUSKY=0 npm ci --prefer-offline --no-audit --no-fund >/dev/null
run ./node_modules/.bin/playwright test "$@"
