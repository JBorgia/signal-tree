# Release follow-through measurements

Run on the repository's Node/pnpm versions, serially with other builds, tests and
measurements stopped. These generators refuse an existing output cohort. Preserve
failed attempts rather than retrying into the same directory.

Prepare immutable package copies in an external packet. The aging replay uses
`packed-kernel` and `v16-kernel` (the qualified predecessor). The lazy-field
comparison uses `qualified-v16-kernel` and `lazy-v16-kernel`. The stable comparison
uses `v15-repaired-kernel` (retention fixes only) and `lazy-v15-kernel`. Each is the
complete kernel package directory, including `dist/index.js`.

```sh
python3 tools/release-followthrough/compare.py /absolute/packet aging
python3 tools/release-followthrough/compare-lazy.py /absolute/packet demand
python3 tools/release-followthrough/compare-lazy.py /absolute/packet aging
python3 tools/release-followthrough/compare-v15-fields.py /absolute/packet demand
```

The separate final ordinary packet contains `v15-kernel` (published),
`v15-repaired-kernel` (both repairs plus lazy fields), and `v16-kernel` (successor).
Do not replace the earlier retention-only or qualified artifacts to create it.

```sh
python3 tools/release-followthrough/compare.py /absolute/final-packet ordinary
```

`policy.json`, each generator's plan, input hashes, per-child receipts and raw
outputs bind the operations. Ordinary app self-tests use `ordinary-child.mjs`
with `selftest jobs 5` or `selftest products 5` following its root/packet/arm
arguments. They reject empty visible results and wrong selections. The original
v15 heap collection failure is preserved and classified explicitly; candidate
failures stop a cohort. Directional comparisons require disjoint arm ranges and
a median gap larger than every observed A/A or arm range.

For the Angular view, supply the exact five-package integrity value computed by
`scripts/publish-artifact-integrity.mjs`, then build and run the fresh consumer:

```sh
node tools/release-followthrough/angular-profile.mjs prepare /absolute/angular-packet /absolute/checkout/dist/packages sha256-EXPECTED
node tools/release-followthrough/angular-profile.mjs build /absolute/angular-packet
node tools/release-followthrough/angular-profile.mjs run /absolute/angular-packet
```

The app/profile sources, copied packages, consumed dependency closure, build
metadata and served bytes are bound. Browser controls and samples run in fresh
serial Chromium processes. Loaded-module timing, CPU emulation, assertions,
quiescence and collection limits are detailed in the
[audit](../../docs/audits/2026-11-10-v15-v16-followthrough/README.md).
These experiments supplement full release qualification; they do not replace it.
