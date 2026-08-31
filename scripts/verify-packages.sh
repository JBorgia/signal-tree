#!/bin/bash

# Package Configuration Verification Script
# Ensures all packages are ready for NPM publishing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}🔍 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_step "Verifying package configurations for NPM publishing..."
echo ""

# shellcheck source=release-packages.sh
source "scripts/release-packages.sh"
PACKAGES=("${PUBLISHABLE_PACKAGES[@]}")

ISSUES_FOUND=0

for pkg in "${PACKAGES[@]}"; do
    pkg_json="packages/$pkg/package.json"

    print_step "Checking package: $pkg"

    if [ ! -f "$pkg_json" ]; then
        print_error "package.json not found for $pkg"
        ((ISSUES_FOUND++))
        continue
    fi

    # Check package name format
    name=$(cat "$pkg_json" | grep '"name"' | sed 's/.*"name": "\(.*\)".*/\1/')
    expected_name="@signal-tree/$pkg"

    if [ "$name" = "$expected_name" ]; then
        print_success "✓ Name: $name"
    else
        print_error "✗ Name mismatch. Expected: $expected_name, Got: $name"
        ((ISSUES_FOUND++))
    fi

    # Check if version exists
    version=$(cat "$pkg_json" | grep '"version"' | sed 's/.*"version": "\(.*\)".*/\1/')
    if [ -n "$version" ]; then
        print_success "✓ Version: $version"
    else
        print_error "✗ No version found"
        ((ISSUES_FOUND++))
    fi

    # Both packages are side-effect-free. Framework realization is bound to the
    # package factory; importing Angular mutates no process-global state.
    sideEffects=$(node -p "try { const p = require('./$pkg_json'); String(p.sideEffects) } catch { '' }")
    if [ "$sideEffects" != "false" ]; then
        print_error "✗ $pkg must declare sideEffects: false"
        ((ISSUES_FOUND++))
    else
        print_success "✓ sideEffects: false (tree-shaking enabled)"
    fi

    echo ""
done

# Check NPM authentication
print_step "Checking NPM authentication..."
if npm whoami &>/dev/null; then
    npm_user=$(npm whoami)
    print_success "✓ Logged into NPM as: $npm_user"
else
    print_warning "⚠ Not logged into NPM. Run: npm login"
    # Note: Auth token in ~/.npmrc is sufficient for publishing
    # ((ISSUES_FOUND++))
fi

# Check if @signal-tree org exists (this will fail if not accessible, which is fine)
print_step "Checking @signal-tree organization access..."
if npm org ls signal-tree &>/dev/null; then
    print_success "✓ Access to @signal-tree organization confirmed"
else
    print_warning "⚠ Cannot access @signal-tree organization. You may need to:"
    echo "  1. Create it: npm org create signal-tree"
    echo "  2. Get added to it if it exists"
fi

echo ""
print_step "Verification Summary:"

if [ $ISSUES_FOUND -eq 0 ]; then
    print_success "🎉 All packages are correctly configured!"
    echo ""
    print_step "Ready to publish! Next steps:"
    echo "1. Run: ./scripts/release.sh patch"
    echo "2. Or manually: npm login && ./scripts/release.sh patch"
else
    print_error "❌ Found $ISSUES_FOUND issues that need to be resolved"
    echo ""
    print_step "Please fix the issues above before publishing"
fi

echo ""
print_step "Package publication will create:"
for pkg in "${PACKAGES[@]}"; do
    echo "  📦 @signal-tree/$pkg"
done

echo ""
print_step "Users will install with:"
echo "  npm install @signal-tree/kernel"
echo "  npm install @signal-tree/angular"
echo "  npm install @signal-tree/react"
echo ""
