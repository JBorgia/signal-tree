#!/bin/bash

# SignalTree Publishing Script
# Publishes all packages in the correct dependency order

set -euo pipefail

echo "🚀 Starting SignalTree package publishing process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verify we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    print_error "This script must be run from the root of the SignalTree workspace"
    exit 1
fi

# Load packages in dependency order from the release authority.
VERSION=$(node -p "require('./package.json').version")
# shellcheck source=release-packages.sh
source "scripts/release-packages.sh"
PACKAGES=("${PUBLISHABLE_PACKAGES[@]}")

# Check if dry-run flag is passed.
DRY_RUN=""
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN="--dry-run"
    print_warning "Running in DRY RUN mode - no packages will actually be published"
elif ! npm whoami > /dev/null 2>&1; then
    print_error "You must be logged into npm. Run 'npm login' first."
    exit 1
else
    print_status "Verified npm authentication"
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

# Build the complete candidate once before mutating or verifying dist manifests.
BUILD_LIST=$(IFS=,; echo "${BUILD_PACKAGES[*]}")
print_status "Building candidate packages: $BUILD_LIST"
pnpm nx run-many -t build --projects="$BUILD_LIST" --configuration=production

# Prepare any generated publish artifacts, then VERIFY every declared `files`
# entry resolves. The 15.0 release removed the stale AI-skill and llms artifacts;
# this script remains the single shared preparation hook.
node scripts/prepare-publish-artifacts.mjs || exit 1

# Resolve pnpm `workspace:` / bare `*` specs before publishing. This path had
# NO rewrite at all, so publishing through it shipped
# `peerDependencies: { "@signaltree/core": "workspace:*" }` on every non-core
# package — an invalid semver range that fails on install. ci-publish.sh and
# release.sh each carried their own copy; this one was simply missed.
echo "Resolving workspace specs in dist manifests..."
node scripts/resolve-workspace-specs.mjs "$VERSION" "${PACKAGES[@]}" || exit 1

# Every glob declared in `files` must resolve to a real file in dist. npm
# ships a tarball missing an unmatched glob without a word.
node scripts/verify-publish-artifacts.mjs "${PACKAGES[@]}" || exit 1

# Function to publish a single package
publish_package() {
    local package_name=$1
    local dist_path="dist/packages/$package_name"

    # Check if dist directory exists
    if [ ! -d "$dist_path" ]; then
        print_error "Distribution directory not found: $dist_path"
        return 1
    fi

    # Independent guard on the actual bytes about to be published, so that a
    # future reordering cannot reintroduce unresolved workspace specs quietly.
    # Checks only the fields a consumer installs from; devDependencies keeping
    # `workspace:*` is correct and must not trip this.
    if ! node -e "
      const m = require('./$dist_path/package.json');
      const bad = ['dependencies','peerDependencies','optionalDependencies']
        .flatMap((f) => Object.entries(m[f] ?? {}))
        .filter(([, v]) => v === '*' || String(v).startsWith('workspace:'));
      if (bad.length) {
        console.error('UNPUBLISHABLE SPEC in ' + m.name + ': ' +
          bad.map(([k, v]) => k + '@' + v).join(', '));
        process.exit(1);
      }
    "; then
        print_error "Refusing to publish $package_name with an unresolvable dependency spec"
        return 1
    fi

    print_status "Publishing package: @signal-tree/$package_name"

    # Change to dist directory and publish
    cd "$dist_path"

    if [ -n "$DRY_RUN" ]; then
        print_warning "DRY RUN: Would publish @signal-tree/$package_name"
        npm publish --access public --tag "$NPM_TAG" $DRY_RUN
    else
        if npm publish --access public --tag "$NPM_TAG"; then
            print_success "Successfully published @signal-tree/$package_name"
        else
            print_error "Failed to publish @signal-tree/$package_name"
            cd - > /dev/null
            return 1
        fi
    fi

    # Return to root directory
    cd - > /dev/null

    # Add small delay between publishes to avoid rate limiting
    if [ -z "$DRY_RUN" ]; then
        sleep 2
    fi

    return 0
}

# Main publishing loop
print_status "Verifying runtime and declaration documentation artifacts..."
node scripts/verify-jsdoc-stripping.js || exit 1
node tools/check-declaration-docs.mjs || exit 1

print_status "Starting to publish ${#PACKAGES[@]} packages..."

FAILED_PACKAGES=()
SUCCESSFUL_PACKAGES=()

for package in "${PACKAGES[@]}"; do
    if publish_package "$package"; then
        SUCCESSFUL_PACKAGES+=("$package")
    else
        FAILED_PACKAGES+=("$package")
        print_error "Stopping publication due to failure in package: $package"
        break
    fi
done

# Summary
echo
print_status "Publication Summary:"
echo "===================="

if [ ${#SUCCESSFUL_PACKAGES[@]} -gt 0 ]; then
    print_success "Successfully published packages:"
    for package in "${SUCCESSFUL_PACKAGES[@]}"; do
        echo "  ✅ @signal-tree/$package"
    done
fi

if [ ${#FAILED_PACKAGES[@]} -gt 0 ]; then
    print_error "Failed to publish packages:"
    for package in "${FAILED_PACKAGES[@]}"; do
        echo "  ❌ @signal-tree/$package"
    done
    echo
    print_error "Publication process stopped due to failures."
    exit 1
else
    echo
    if [ -n "$DRY_RUN" ]; then
        print_success "DRY RUN completed successfully!"
        print_status "To actually publish, run: npm run publish:all"
    else
        print_success "All packages published successfully! 🎉"
        print_status "SignalTree ecosystem is now available on npm"
    fi
fi
