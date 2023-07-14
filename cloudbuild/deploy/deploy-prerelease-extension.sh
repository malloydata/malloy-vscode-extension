#!/usr/bin/env bash
set -euxo pipefail

npm ci --loglevel error
npm run integration
npm run publish-extensions pre-release
