# v15 maintenance successor preparation

The proposed successor is **15.4.9**, with local release preparation authorized.
It is not published or release-qualified by this record. The current phase does
not authorize a tag, push, merge, npm publication or demo promotion. The central
release controller and independent closure remain with the release owner.

Preparation starts from `969574ac9c3220596e4e3004761b3ee087148590` on
`codex/v15-maintenance-release-prep`. Its runtime checkpoint is
`0d2b9619206ab9e7a7af998944e744f6d2b6e492`; the intervening commit only records
measurement tools and evidence. Published v15.4.8 is the comparison base,
`37ef1788f6bac61678fc312f391b180bd7a6bbd7`.

## Scope and compatibility

The successor contains four reviewed maintenance changes:

- Repeated EntityMap value projections reuse the active entity-lifetime order.
  Current values still produce a fresh snapshot. Structural changes invalidate
  the order; separately demanding IDs and values can retain both order arrays.
- Collections with `transactions()` or `restoration()` reclaim eligible retired
  entity lifetimes after notification capture and ownership checks. This also
  covers ordinary removals when the installed transaction capability was never
  called. Pending work and retained history remain protected.
- Retirement preparation rejects active or absent lifetimes before enumerating
  their row metadata.
- Permanent lifetime removal clears its weak activation index, including
  carriers created internally by rollback validation. Old and late readers
  remain attached to their old lifetime rather than a replacement row.

Public exports, method spelling, framework ownership, transaction refusal and
settlement behavior, and supported peer ranges are unchanged in the runtime
scope. In particular, v15 retains `transaction()` and its documented
[failure policy](../../guides/transaction-failures-v15.md). This preparation does
not import v16 publication guarantees or change the supported v14 line.

The [projection record](../../../tools/v15-projection-lab/README.md) and
[reclamation record](../../../tools/reclamation-lab/README.md) preserve source
history, first failures, meaningful negative controls, full runtime checks,
exact artifacts and finite measurement limits. Those checks establish support
for this release scope; they are not qualification of newly versioned bytes.

## Version and artifact identity

Fresh npm metadata for the five public packages reports `latest: 15.4.8` and no
15.4.9 version. Remote v15.4 tags also stop at v15.4.8. The dated
[registry inspection](registry-inspection.json) binds each full registry response;
raw responses and remote tag output are preserved outside the source checkout.
An unused version is not evidence of publication authority.

Only the workspace and five canonical package versions, generated demo version
constants, development-version documentation and changelog are release metadata.
No dependency upgrade is intended. Package order remains the authority in
[`scripts/release-plan.mjs`](../../../scripts/release-plan.mjs).

The normal `release:patch` command signs and pushes a tag, so it is outside this
phase. Local metadata preparation uses the same version/changelog helpers and
version generator without executing those external actions. The final local
commit, restored-source hashes, generated package inventories, tarball SHA-512
integrities and canonical candidate journal must identify the actual successor.
Its archives must not be confused with published 15.4.8 archives that share the
runtime study's former package-version field.

## Numerical budget and measured cost

The canonical fixture and settings in
[`tools/check-bundle-budget.mjs`](../../../tools/check-bundle-budget.mjs) remain
unchanged. The preceding exact runtime build measured entity production and
development gzip at 25,333 and 28,273 bytes. Existing ceilings are 25,292.8 and
28,160 bytes: numerical excesses of 40.2 and 113 bytes. The prior raw failing
gate and exact-byte diagnostic are preserved in the reclamation record.

The central study accepted the small delivered-code cost for the demonstrated
projection benefit and corrected retention under the owner's cost/feasibility
instruction. That economic judgment is separate from numerical gate compliance.
This preparation does not raise a ceiling or describe the old red gate as green.
The versioned successor needs a fresh uncached build and exact measurement,
followed by an explicit release-owner budget disposition.

The changes do not promise faster sparse writes, uniformly faster startup, zero
additional heap, or a universal comparison win. The projection benefit depends
on repeated broad reads; demand for both IDs and values has a measured memory
cost. The retirement fixes address identified retained owners. Finite healthy
traces do not establish unlimited boundedness of every application.

## Qualification sequence

Use Node 24.15.0 and pnpm 10.17.0 from this checkout. Install the frozen lockfile
into this isolated checkout; its `node_modules` must not borrow workspace links
from a different worktree. Run the following serially in the allocated slot:

1. Reconcile the final source, metadata, release notes and numerical budget
   disposition, then make the local candidate commit. Preserve every earlier
   source snapshot and failing command receipt.
2. Run `node tools/verify-gates.mjs --release`. The executable registry defines
   the current checks; a focused historical pass is insufficient.
3. Run `node tools/verify-gates.mjs --self-test --release`. No concurrent edits,
   builds, tests or artifact readers are permitted during mutation proofs.
   Record unproven, indirect, vacuous, blind and error outcomes accurately.
4. Remove only this checkout's generated `dist/`, rebuild all packages without
   cache, then run strict tarball consumers and production Angular AOT. Compare
   source and built identities before and after artifact checks.
5. Build the unchanged production demo configuration and run its full route
   smoke suite. Check version claims, release state, changelog and final diff.
6. Use `node scripts/publish-candidate.mjs --prebuilt --prepare-only` to produce
   the canonical validated candidate journal and immutable package archives.
   Preserve that journal before any subsequent packaging command can replace it.
7. Obtain independent exact-source/artifact release review. Record remaining
   local or platform limitations; exact-tag CI, signed tag, registry and demo
   publication receipts belong to a separately authorized publication phase.

Commands, exit codes, logs and generated artifacts are retained under
`/private/tmp/st-v15-maintenance-release-prep`. They are not fresh merely because
this document names a generator. No completed successor gate or artifact result
is asserted until its corresponding receipt exists.
