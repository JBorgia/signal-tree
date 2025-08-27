#!/usr/bin/env bash
# Start a local Verdaccio registry for testing pack-and-publish flows
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
# Ensure storage dir exists
mkdir -p ./tmp/local-registry/storage
npx verdaccio --config .verdaccio/config.yml
