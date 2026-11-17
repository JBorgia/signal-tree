# v15 maintenance successor preparation

The **15.4.9 local preparation is complete**, with the specific numerical size
exception recorded in the current release controller. Candidate source is
`da2e92ccab46747471cae810fb9221f563d0a906`. This is not a publication receipt;
signed tagging, exact-tag Linux CI, registry publication and demo promotion belong
to a separately selected phase. Review-branch sharing remains authorized.

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

The November 11 npm metadata inspection for the five public packages reported `latest: 15.4.8` and no
15.4.9 version. Remote v15.4 tags also stopped at v15.4.8. The dated
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

The original commands used `/private/tmp/st-v15-maintenance-release-prep`.
Temporary-directory cleanup later removed their raw logs and consumers. The
following November 11 summaries remain historical records, not substitutes for
available raw evidence. The persistent fresh qualification below supersedes
them for current preparation sign-off.


## Historical November 11 qualification and disposition

The [qualification summary](qualification-summary.json) binds all 18 command
receipts, the source archive, five canonical tarballs and candidate journal.
Normal release checks passed 90/91, with only the unchanged bundle gate red.
The mutation harness reported 91/91 proofs, including 15 indirect proofs; source
was restored exactly. Its entity size proof begins from an already failing
baseline, so it does not independently demonstrate entity budget compliance.
A separate bare-fixture control establishes green, seeded oversized red, then
exact restoration without changing the entity ceiling.

Uncached five-package rebuild, strict tarball consumers, bundler and Node16 types,
production Angular AOT, production demo and all 146 browser checks passed.
Canonical `publish-candidate --prebuilt --prepare-only` produced five immutable
15.4.9 archives. All 158 packed files match qualified output. Four unexported
29-byte facade declaration forwarding files exist in built output but are excluded
by package files rules; this difference is explicitly accounted for. All 157
nonmanifest built files match the preceding qualified v15 runtime; manifest
changes are version and facade-to-kernel dependency normalization to 15.4.9.

[Independent verification](independent-verification.json) checks 1,766 archived
files against candidate Git blobs, restored/current source identities, 162 built
files, 158 packed payloads and all five tarball integrities. It also recomputes
112 raw projection children and verifies that their 108 nonmanifest measured
kernel payloads equal this prepared package. At 10,000 rows and 5,000 edits,
median CPU was 751.401 to 354.034 ms for broad projection, 993.190 to 549.815 ms
for inventory, and 788.306 to 366.141 ms for projection plus IDs. The latter
retains about 82 KB more at 10,000 rows. Sparse work and startup do not have an
established universal improvement. The existing reclamation study supplies the
finite repeated-lifetime evidence; it is not a proof of unlimited boundedness.

The release owner accepts the specific 40.2-byte production and 113-byte
development ceiling excess for this prepared artifact under the standing
cost/feasibility instruction. The numerical verdict stays failed and no ceiling
was raised. Removing the measured retirement protections is not an acceptable
size trade, and speculative gzip tricks or hot-path indirection were not adopted.

The source and artifact seals are `480b325993535f7949d9d62c8acc68171bfbe3f64002d86dbffac62e8b3c6475`
and `5446e18e81cd27aaa4ffc50159599533ece202f3f15d69b8ade631d20f6d4790`.
These identify the frozen candidate, not later audit-only commits.

One provenance limit is explicit: the conversation tool command records removal
of generated dist before the uncached rebuild, but no contemporaneous standalone
removal receipt or directory listing was saved. The later
[command transcription](dist-removal-evidence.json) distinguishes that evidence
from the independently verified uncached build and exact output identities.
No deletion or rebuild was repeated to manufacture historical evidence.

## Fresh persistent qualification, November 17 UTC

The [fresh result](requalification-result.json) records completion at unchanged
candidate HEAD `da2e92cca`. The source seal
`e31dab97acd9fe4d3a88e36a0d7f6b2ca68c23721c6abaf23872a2218e54fe0c`
also binds the audit/controller edits present during this run; it is not a claim
that every qualified source byte is the clean Git tree. Runtime and public
metadata remain the prepared candidate. Later report-only edits are separate.
The [fresh summary](qualification-summary-fresh.json) and
[independent qualification review](independent-qualification-fresh.json) bind
the raw commands, source snapshots, exact archives and consumer checks.

All 91 normal gates ran: 90 passed, with only the unchanged numerical bundle
failure. All 91 mutation proofs completed with exact source restoration and no
unproven, vacuous, blind or error result. The fresh run directly inventories
generated dist, records its removal and verifies absence before the uncached
five-package rebuild. Canonical prepare-only packaging reproduces the quick
refresh and preserved original archives exactly. Strict exact-tarball Angular
AOT, production demo, all 146 browser checks and release/documentation claims
checks pass. The independent bare-budget sequence is green, deliberately
oversized red, then exact restored green; entity ceilings stay numerically red.

The evidence root is now persistent:
`artifacts/agent-collaboration-2026-11-16/v15-requalification` in the main checkout.
External installed-consumer scratch files are copied with original-path/hash
manifests. The associated agent-collaboration study packages these receipts,
source snapshots, archives, logs, failures and controls. Its archive integrity
does not replace the behavioral or platform limits of each check.
The [shared evidence index](https://github.com/JBorgia/signal-tree/blob/codex/agent-collaboration-evaluation/docs/audits/2026-11-11-agent-collaboration/EVIDENCE.json)
identifies the split archive and standalone verification, including the fresh
qualification and independent review linked above.

This is complete local preparation under the specific accepted size exception.
It is not a signed tag, exact-tag Linux qualification, registry publication or
production demo promotion. Those actions remain a separately selected phase.

The [fresh registry inspection](registry-refresh.json), November 17 at 05:17 UTC,
finds all five latest tags still at 15.4.8, no 15.4.9 in any package's versions,
HTTP 404 at each exact-version endpoint, and no remote v15.4.9 Git tag. The first
Python TLS trust-store failure is retained; the successful retry uses curl with
normal system certificate verification. An unused version grants no publication
authority.
