#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --keep VSCE_PAT --keep GA_API_SECRET --keep GA_MEASUREMENT_ID --keep GHAPI_PAT --keep OVSX_TOKEN --command  "$(cat <<NIXCMD
  set -euxo pipefail
  cd /workspace
  npm ci --loglevel error
  npm run integration && npm run publish-extensions pre-release
NIXCMD
)"
