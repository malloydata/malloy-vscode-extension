#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --keep VSCE_PAT --keep GA_API_SECRET --keep GA_MEASUREMENT_ID  --keep GHAPI_PAT --command  "$(cat <<NIXCMD
  set -euxo pipefail
  cd /workspace
  npm ci --loglevel error
  npm run build && npm run publish-extensions patch
  ls -l dist
NIXCMD
)"
