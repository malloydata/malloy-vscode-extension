#!/usr/bin/env bash

set -euxo pipefail

cd /workspace
npm ci --silent
npm run package-extension
