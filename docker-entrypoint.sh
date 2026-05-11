#!/bin/sh
# Entrypoint for the plc-st-review container.
#
# Two modes:
#   1. GitHub Action invocation — action.yml sets PLC_PR_NUMBER, PLC_REPO,
#      PLC_SEVERITY env vars. We rewrite those into proper --github CLI args.
#      This avoids action.yml `args:` arrays, which silently drop GHA
#      expressions that resolve to non-string types.
#   2. Direct invocation (CLI mode, GitLab mode) — args are passed straight
#      through to the CLI binary.
set -e

if [ -n "$PLC_PR_NUMBER" ] && [ -n "$PLC_REPO" ]; then
  exec node /app/dist/cli.js \
    --github \
    --pr "$PLC_PR_NUMBER" \
    --repo "$PLC_REPO" \
    --severity "${PLC_SEVERITY:-info}"
fi

exec node /app/dist/cli.js "$@"
