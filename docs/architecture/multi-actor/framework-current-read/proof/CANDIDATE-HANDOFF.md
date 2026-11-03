# Frozen candidate handoff for Heisenberg

Frozen UTC: 2026-10-29T19:26:57.919948+00:00

Candidate root: `/private/tmp/st-current-read-capability-proof`.
Source and tarballs are frozen; no further source/package edits planned.
All 21 source/test hashes match Hume’s reviewed SOURCE-IDENTITY manifest.

Source identity: `/private/tmp/st-current-read-capability-proof/proof-evidence/SOURCE-IDENTITY.json`
SHA256: `10a5d0a4548e7e2da88328d072e0b6b3878633298bd356aee8849ab973614d72`
Retained source: `87f6831fa60cafe87508f0ace84b7638698ca3b0`.

Artifact manifest: `/private/tmp/st-current-read-capability-proof/proof-evidence/ARTIFACT-FREEZE.json`
Artifact manifest SHA256: `fee0a010942dd933b7cb421bf3f353131e957a903eb3bf2205c35f4486f3f4b8`

## Exact tarballs

- kernel: `/private/tmp/st-current-read-capability-proof/proof-evidence/tarballs/signal-tree-kernel-16.0.0-dev.tgz`
  SHA256 `82a290a27e3f6ad238cada0cc84a86c4160e3d405157ba67eb093baa059b8293`; 111 members byte-verified against canonical dist.
- angular: `/private/tmp/st-current-read-capability-proof/proof-evidence/tarballs/signal-tree-angular-16.0.0-dev.tgz`
  SHA256 `f45b5424ecd0ca1c50eed61ffb377f423475fe7a9c51e7467cf0be8da7abc25d`; 16 members byte-verified against canonical dist.
- vue: `/private/tmp/st-current-read-capability-proof/proof-evidence/tarballs/signal-tree-vue-16.0.0-dev.tgz`
  SHA256 `528c6a40340b9b4bcfa1cdc0eed38dba174c5d8bd1712ba205a941fcd0d71867`; 12 members byte-verified against canonical dist.
- solid: `/private/tmp/st-current-read-capability-proof/proof-evidence/tarballs/signal-tree-solid-16.0.0-dev.tgz`
  SHA256 `2884903516acaa28bcd5ad95db1b8d9595f99bdd3a425b6a3aee18a1642d3e92`; 12 members byte-verified against canonical dist.

## Generation and validation

Pinned Node 24.15.0 / pnpm 10.17.0; cwd candidate root.
Canonical build: `corepack pnpm nx run-many -t build --projects=kernel,angular,vue,solid --parallel=1 --skip-nx-cache --outputStyle=stream` — exit 0.
Packages: `npm pack --ignore-scripts --json --pack-destination <candidate>/proof-evidence/tarballs`, cwd each `dist/packages/<name>` — all exit 0.
No declaration rewrites, public carrier weakening, or package manifest finalization edits.
Strict packed consumer: Bundler and Node16, skipLibCheck=false — exit 0 each.
Packed native-adapter migration/runtime controls — exit 0.
Final full suite — exit 0, 6484 passed / 5 expected failures / 15 skipped.
Hume actual-adapter controls and marker-error reproducer — corrected source exit 0.
All five targeted mutants were killed and sources restored by exact hash before freeze.
Mutation artifacts live in candidate `proof-evidence/mutations/`; they are not candidate source.

## Matrix boundary

These tarballs are local bounded-proof artifacts, not release-finalized packages. Framework manifests retain their canonical workspace kernel dependency; provide all local artifacts explicitly in isolated consumers as needed, without rewriting frozen tarballs.
The installed-peer result does not establish Angular 20/21 or Vue 3.5.0 behavior; this handoff is the exact artifact boundary for that work.
No production activation, ceilings, or release authority.
