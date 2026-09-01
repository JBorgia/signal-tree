#!/bin/bash

# Ordered public release set. Kernel must be packed/published before adapters.
PUBLISHABLE_PACKAGES=()
while IFS= read -r package; do
	PUBLISHABLE_PACKAGES+=("$package")
done < <(node scripts/release-plan.mjs)

BUILD_PACKAGES=("${PUBLISHABLE_PACKAGES[@]}")
