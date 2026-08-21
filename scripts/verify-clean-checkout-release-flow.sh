#!/bin/bash

# Verifies that a freshly exported checkout can install, build, gate, and dry-run
# the CI publish path without relying on untracked local files or stale dist/.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REF="${1:-HEAD}"
TMP_DIR="$(mktemp -d)"

cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "📦 Cloning clean checkout for $REF"
git clone --quiet --no-hardlinks "$ROOT" "$TMP_DIR/repo"
cd "$TMP_DIR/repo"
git checkout --quiet "$REF"

echo "📦 Verifying clean git state"
git status --short --untracked-files=no

echo "📦 Installing from frozen lockfile"
pnpm install --frozen-lockfile --ignore-scripts

echo "📦 Building publishable packages"
pnpm run build:all

echo "📦 Running fast gate set"
node tools/verify-gates.mjs --fast

echo "📦 Exercising CI publish dry run through trusted-publishing branch"
GITHUB_ACTIONS=true NPM_CONFIG_PROVENANCE=true bash scripts/ci-publish.sh --dry-run

echo "✅ Clean-checkout release flow passed for $REF"
