#!/bin/bash

# Ordered public release set. Kernel must be packed/published before Angular.
PUBLISHABLE_PACKAGES=(
    "kernel"
    "angular"
)

# Shared is private and bundled into public packages; it is built, never published.
BUILD_PACKAGES=(
    "shared"
    "kernel"
    "angular"
)

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
