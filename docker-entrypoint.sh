#!/bin/sh
# Entrypoint for the plc-st-review container.
#
# Two modes:
#   1. GitHub Action invocation — the container has GITHUB_REPOSITORY,
#      GITHUB_REF, and GITHUB_TOKEN auto-set by Actions. We parse the PR
#      number from GITHUB_REF (refs/pull/<num>/merge on pull_request
#      events) unless PLC_PR_INPUT overrides it, and the repo from
#      GITHUB_REPOSITORY unless PLC_REPO_INPUT overrides it. The CLI
#      runs in --github mode.
#   2. Direct invocation (CLI mode, GitLab mode) — args are passed
#      straight through to the CLI binary.
set -eu

echo "plc-st-review entrypoint: starting"
echo "  GITHUB_REF=${GITHUB_REF:-<unset>}"
echo "  GITHUB_REPOSITORY=${GITHUB_REPOSITORY:-<unset>}"
echo "  PLC_PR_INPUT=${PLC_PR_INPUT:-<unset>}"
echo "  PLC_REPO_INPUT=${PLC_REPO_INPUT:-<unset>}"
echo "  PLC_SEVERITY_INPUT=${PLC_SEVERITY_INPUT:-<unset>}"

# Resolve the PR number: explicit input wins, else parse from GITHUB_REF.
pr_number="${PLC_PR_INPUT:-}"
if [ -z "$pr_number" ] && [ -n "${GITHUB_REF:-}" ]; then
  # refs/pull/<num>/merge -> <num>
  case "$GITHUB_REF" in
    refs/pull/*/merge|refs/pull/*/head)
      pr_number=$(echo "$GITHUB_REF" | sed -e 's|^refs/pull/||' -e 's|/.*$||')
      ;;
  esac
fi

repo="${PLC_REPO_INPUT:-${GITHUB_REPOSITORY:-}}"
severity="${PLC_SEVERITY_INPUT:-info}"

if [ -n "$pr_number" ] && [ -n "$repo" ]; then
  echo "plc-st-review entrypoint: running --github --pr $pr_number --repo $repo --severity $severity"
  exec node /app/dist/cli.js \
    --github \
    --pr "$pr_number" \
    --repo "$repo" \
    --severity "$severity"
fi

echo "plc-st-review entrypoint: no PR context found, passing args through"
exec node /app/dist/cli.js "$@"
