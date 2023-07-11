#!/usr/bin/env sh
set -euxo pipefail

# Allow VS Code
export NIXPKGS_ALLOW_UNFREE=1
# Allow Node 16
export NIXPKGS_ALLOW_INSECURE=1

nix-shell integration.nix --keep NIXPKGS_ALLOW_UNFREE --keep NIXPKGS_ALLOW_INSECURE --quiet --pure --command "$(cat <<NIXCMD
  set -euxo pipefail

  # cd /workspace
  vncserver -SecurityTypes None :1 -noautokill
  export DISPLAY=:1

  npm ci --silent
  npm run integration && npm run test
  vncserver -kill :1
NIXCMD
)"
