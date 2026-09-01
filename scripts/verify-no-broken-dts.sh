#!/usr/bin/env bash
# Verify that every package's manifest-declared type entry exists.

set -e

EXIT_CODE=0

echo "🔍 Verifying TypeScript declaration structure in dist/packages/..."

for pkg in dist/packages/*; do
  if [ ! -d "$pkg" ]; then
    continue
  fi

  PKG_NAME=$(basename "$pkg")

  TYPES_ENTRY=$(node -p "require('./$pkg/package.json').types")
  TYPES_PATH="$pkg/${TYPES_ENTRY#./}"
  if [ ! -f "$TYPES_PATH" ]; then
    echo "❌ ERROR: Missing $PKG_NAME declaration entry $TYPES_ENTRY"
    EXIT_CODE=1
  else
    echo "✅ $PKG_NAME: declaration entry $TYPES_ENTRY exists"
  fi
done

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ All packages have their manifest-declared TypeScript entry"
fi

exit $EXIT_CODE
