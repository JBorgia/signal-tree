#!/bin/bash

# SignalTree CI Publish Script
# ============================
# Non-interactive npm publish of every package in dist/packages/, for use by
# .github/workflows/publish.yml (the sanctioned publish path — v12 audit
# intake, 2026-07-24). Mirrors the publish preflights + loop of
# scripts/release.sh, minus version bumping, tagging, and git pushes: CI
# publishes the EXACT tagged commit that the gate jobs verified.
#
# Requirements:
#   - dist/packages/<pkg> already built (production configuration)
#   - npm trusted publishing configured for .github/workflows/publish.yml, or
#     NPM_TOKEN set as an explicit fallback. No interactive login fallback here.
#
# Idempotent: "cannot publish over the previously published versions" is
# treated as success so a re-run after a partial publish completes the rest.
#
# Dry run: pass `--dry-run` to exercise all pre-publish checks and npm pack
# behavior without writing to the registry.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "${BLUE}📦 $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

DRY_RUN=false
if [[ " $* " == *" --dry-run "* ]]; then
    DRY_RUN=true
fi

cd "$(dirname "$0")/.."

if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    print_error "This script must be run from the workspace root"
    exit 1
fi

if [ -n "${NPM_TOKEN:-}" ]; then
    print_step "Using NPM_TOKEN fallback for npm authentication"
elif [ -n "${GITHUB_ACTIONS:-}" ]; then
    print_step "Using npm trusted publishing via GitHub Actions OIDC"
else
    print_error "No npm authentication available."
    print_error "Configure npm trusted publishing for publish.yml, or set NPM_TOKEN for local fallback."
    exit 1
fi

# shellcheck source=release-packages.sh
source "scripts/release-packages.sh"
PACKAGES=("${PUBLISHABLE_PACKAGES[@]}")

VERSION=$(node -p "require('./package.json').version")
print_step "CI publish of workspace version $VERSION"

# Prepare any generated publish artifacts, then VERIFY every declared `files`
# entry resolves. The 15.0 release removed the stale AI-skill and llms artifacts;
# this script remains the single shared preparation hook.
node scripts/prepare-publish-artifacts.mjs || exit 1

# Preflight 1: every publishable dist folder must exist BEFORE publishing
# anything (avoid partial releases).
print_step "Verifying dist outputs exist for all packages (fail-fast)..."
for package in "${PACKAGES[@]}"; do
    DIST_PATH="./dist/packages/$package"
    if [ ! -d "$DIST_PATH" ] || [ ! -f "$DIST_PATH/package.json" ]; then
        print_error "Missing dist output for $package at $DIST_PATH — build all packages first"
        exit 1
    fi
    DIST_VERSION=$(node -p "require('$DIST_PATH/package.json').version")
    if [ "$DIST_VERSION" != "$VERSION" ]; then
        print_error "Version mismatch: dist/packages/$package is $DIST_VERSION, workspace is $VERSION"
        print_error "The tagged commit must have committed package versions matching the tag"
        exit 1
    fi
done
print_success "All dist outputs present at version $VERSION"

# Preflight 1b: package hygiene — never publish a tarball that ships test
# specs, source maps, raw .ts, or is missing a declared entry.
print_step "Verifying package hygiene (no junk in tarballs)..."
node scripts/verify-package-hygiene.js || exit 1

# Preflight 2: resolve pnpm `workspace:` protocol / bare `*` specs in the
# published dist manifests. npm publish does NOT rewrite them, and a literal
# `workspace:*` in peerDependencies is not a valid semver range — it breaks
# every install of the six non-core packages.
#
# One shared script, called identically from ci-publish.sh, publish-all.sh and
# release.sh. It used to be copy-pasted here and in release.sh, and MISSING from
# publish-all.sh, which is the manual path a human reaches for.
print_step "Resolving workspace:* / * specs in dist manifests to ^$VERSION..."
node scripts/resolve-workspace-specs.mjs "$VERSION" "${PACKAGES[@]}" || exit 1
print_success "Workspace specs resolved in dist manifests"

# Every glob declared in `files` must resolve to a real file in dist. npm
# ships a tarball missing an unmatched glob without a word.
node scripts/verify-publish-artifacts.mjs "${PACKAGES[@]}" || exit 1

# Auth: trusted publishing needs no long-lived token. If NPM_TOKEN is supplied
# for a fallback run, scope it to a temp userconfig so we never touch global
# npm configuration.
NPMRC_TEMP=""
cleanup() {
    if [ -n "$NPMRC_TEMP" ]; then
        rm -f "$NPMRC_TEMP"
    fi
}
trap cleanup EXIT
if [ -n "${NPM_TOKEN:-}" ]; then
    NPMRC_TEMP="$(mktemp)"
    echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > "$NPMRC_TEMP"
fi


# ---------------------------------------------------------------------------
# DIST-TAG — derived from the version, never assumed.
#
# `npm publish` sets the `latest` tag BY DEFAULT, including for prerelease
# versions. Publishing 14.0.0-rc.1 without an explicit --tag would therefore
# make the release candidate what every `npm install @signaltree/core` resolves
# to. npm does not protect you from this; the version string looking like a
# prerelease changes nothing.
#
# So: any version containing a hyphen is a prerelease, and its dist-tag is the
# prerelease identifier (14.0.0-rc.1 -> "rc", 14.0.0-next.2 -> "next"). Only a
# clean X.Y.Z goes to `latest`.
# ---------------------------------------------------------------------------
case "$VERSION" in
    *-*)
        NPM_TAG="$(printf '%s' "$VERSION" | sed -E 's/^[^-]*-([A-Za-z]+).*/\1/')"
        [ -n "$NPM_TAG" ] || NPM_TAG="next"
        ;;
    *)
        NPM_TAG="latest"
        ;;
esac

print_step "Publishing with dist-tag: $NPM_TAG (version $VERSION)"
if [ "$DRY_RUN" = true ]; then
    print_warning "Dry run enabled: npm publish will not write to the registry"
fi

PUBLISHED_PACKAGES=()
FAILED_PACKAGES=()

print_step "Verifying runtime and declaration documentation artifacts..."
node scripts/verify-jsdoc-stripping.js || exit 1
node tools/check-declaration-docs.mjs || exit 1

for package in "${PACKAGES[@]}"; do
    DIST_PATH="./dist/packages/$package"
    print_step "Publishing @signal-tree/$package@$VERSION..."

    PUBLISH_CMD=(npm publish --access public --tag "$NPM_TAG")
    if [ -n "$NPMRC_TEMP" ]; then
        PUBLISH_CMD+=(--userconfig "$NPMRC_TEMP")
    fi
    if [ "$DRY_RUN" = true ]; then
        PUBLISH_CMD+=(--dry-run)
    fi
    # Provenance is supported on trusted CI providers (GitHub Actions).
    if [ -n "${GITHUB_ACTIONS:-}" ] || [ "${NPM_CONFIG_PROVENANCE:-}" = "true" ]; then
        PUBLISH_CMD+=(--provenance)
    fi

    LOG_FILE="$(mktemp)"
    set +e
    (cd "$DIST_PATH" && "${PUBLISH_CMD[@]}") 2>&1 | tee "$LOG_FILE"
    PUBLISH_EXIT_CODE=${PIPESTATUS[0]}
    set -e

    if [ "$PUBLISH_EXIT_CODE" -eq 0 ]; then
        print_success "Published @signal-tree/$package@$VERSION (tag: $NPM_TAG)"
        PUBLISHED_PACKAGES+=("$package")
    elif grep -q "cannot publish over the previously published versions" "$LOG_FILE" 2>/dev/null; then
        print_warning "@signal-tree/$package@$VERSION already published, skipping"
        PUBLISHED_PACKAGES+=("$package")
    else
        print_error "npm publish failed for @signal-tree/$package (exit $PUBLISH_EXIT_CODE)"
        tail -10 "$LOG_FILE"
        FAILED_PACKAGES+=("$package")
        rm -f "$LOG_FILE"
        break # fail fast — don't keep publishing a broken release
    fi
    rm -f "$LOG_FILE"
    sleep 2 # avoid registry rate limiting between publishes
done

echo ""
if [ ${#FAILED_PACKAGES[@]} -gt 0 ]; then
    print_error "Publish FAILED at: ${FAILED_PACKAGES[*]}"
    print_error "Published before failure: ${PUBLISHED_PACKAGES[*]:-none}"
    print_error "Fix the cause and re-run — already-published packages are skipped safely"
    exit 1
fi

if [ "$DRY_RUN" = true ]; then
    print_success "Dry run completed for all ${#PUBLISHED_PACKAGES[@]} packages at $VERSION"
else
    print_success "All ${#PUBLISHED_PACKAGES[@]} packages published at $VERSION"
fi
for package in "${PUBLISHED_PACKAGES[@]}"; do
    echo -e "${GREEN}📦 @signal-tree/$package@$VERSION${NC}"
done
