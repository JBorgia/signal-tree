#!/bin/bash

# Verify Distribution Files
# Ensures all expected distribution files exist after build

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verify the private build dependency and the public release set.
# shellcheck source=release-packages.sh
source "scripts/release-packages.sh"
NX_PACKAGES=("${BUILD_PACKAGES[@]}")
ERRORS=0

echo "Verifying distribution files for independent packages..."
echo "(Matches the packages published by scripts/release.sh)"
echo ""

# Check Nx-built packages (output to dist/packages/$package)
for package in "${NX_PACKAGES[@]}"; do
    DIST_DIR="./dist/packages/$package"
    JS_DIR="$DIST_DIR/dist"

    echo "Checking Nx package: $package..."

    # Check dist directory exists
    if [ ! -d "$DIST_DIR" ]; then
        echo -e "${RED}❌ Missing dist directory: $DIST_DIR${NC}"
        ((ERRORS++))
        continue
    fi

    # Check for package.json
    if [ ! -f "$DIST_DIR/package.json" ]; then
        echo -e "${RED}❌ Missing package.json in $DIST_DIR${NC}"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓ package.json found${NC}"
    fi

    # Check for compiled JS entry point
    if [ ! -d "$JS_DIR" ]; then
        echo -e "${RED}❌ Missing compiled output directory: $JS_DIR${NC}"
        ((ERRORS++))
    else
        if [ ! -f "$JS_DIR/index.js" ]; then
            echo -e "${RED}❌ Missing index.js in $JS_DIR${NC}"
            ((ERRORS++))
        else
            echo -e "${GREEN}✓ index.js found${NC}"
        fi
    fi

    # Check for TypeScript declarations
    if [ ! -f "$DIST_DIR/src/index.d.ts" ]; then
        echo -e "${RED}❌ Missing declaration entry: $DIST_DIR/src/index.d.ts${NC}"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓ src/index.d.ts found${NC}"
    fi

    echo -e "${GREEN}✅ $package verified${NC}\n"
done

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}Found $ERRORS distribution file issue(s)${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
else
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ All distribution files verified successfully!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
fi
