#!/usr/bin/env sh
set -euxo pipefail

nix-shell --quiet --pure --command "$(cat <<NIXCMD
  cd /workspace
  npm ci --silent
  npm run package-extension
  ls -l dist
  unzip -l dist/malloy-vscode-0.2.0.vsix
NIXCMD
)"
