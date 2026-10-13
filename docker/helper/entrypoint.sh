#!/bin/sh
set -eu

# Railway mounts its volume owned by root, and Claude Code won't skip permissions as root.
if [ "$(id -u)" = 0 ]; then
  mkdir -p /data/code /data/project-tracker
  for dir in /data/code /data/project-tracker; do
    if [ "$(stat -c %u "$dir")" = 0 ]; then chown node:node "$dir"; fi
  done
  exec gosu node "$0" "$@"
fi

: "${TRACKER_URL:?Set TRACKER_URL to the https address of the tracker.}"

if [ -z "${ANTHROPIC_API_KEY:-}${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "Neither ANTHROPIC_API_KEY nor CLAUDE_CODE_OAUTH_TOKEN is set, so Claude Code may not be logged in." >&2
fi

if [ -n "${PROJECT_GIT_URL:-}" ] && [ ! -e /data/code/.git ]; then
  git clone "$PROJECT_GIT_URL" /data/code
fi

# Saved to the config file and taken out of the environment, so the helper and the MCP server
# read the same token and Claude's shell commands don't see it in a variable.
if [ -n "${TRACKER_API_TOKEN:-}" ]; then
  printf '%s\n' "$TRACKER_API_TOKEN" | env -u TRACKER_API_TOKEN tracker login --url "$TRACKER_URL"
  unset TRACKER_API_TOKEN
fi

# Variables as well as arguments, since Railway sets variables but not a container's arguments.
exec tracker watch \
  ${TRACKER_PROJECT:+"$TRACKER_PROJECT"} \
  ${TRACKER_HELPER_NAME:+"--name=$TRACKER_HELPER_NAME"} \
  ${TRACKER_PERMISSION_MODE:+"--permission-mode=$TRACKER_PERMISSION_MODE"} \
  "$@"
