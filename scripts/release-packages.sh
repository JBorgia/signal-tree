#!/bin/bash

# Ordered public release set. Kernel must be packed/published before adapters.
PUBLISHABLE_PACKAGES=(
    "kernel"
    "angular"
    "react"
)

BUILD_PACKAGES=("${PUBLISHABLE_PACKAGES[@]}")

node - "${PUBLISHABLE_PACKAGES[@]}" <<'NODE'
const fs = require('node:fs');
const expected = process.argv.slice(2).sort();
const actual = fs
    .readdirSync('packages', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((project) => {
        const manifestPath = `packages/${project}/package.json`;
        return (
            fs.existsSync(manifestPath) &&
            JSON.parse(fs.readFileSync(manifestPath, 'utf8')).private !== true
        );
    })
    .sort();

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(
        `Release package set mismatch: configured=${expected.join(',')} actual=${actual.join(',')}`
    );
    process.exit(1);
}
NODE
