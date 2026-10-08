#!/usr/bin/env bash
# Runs E2E against a clean copy of HEAD, so files that are mid-edit in the working tree can't break the run.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
dir=$(mktemp -d "${TMPDIR:-/tmp}/tracker-e2e-XXXXXX")
git -C "$root" archive HEAD | tar -x -C "$dir"
cd "$dir"
HUSKY=0 npm ci --prefer-offline --no-audit --no-fund >/dev/null
npx playwright test "$@"
