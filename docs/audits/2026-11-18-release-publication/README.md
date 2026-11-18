# 16.0.0-rc.0 publication preparation

**Historical preparation; not published.** Signed source
`adf3937459f88260c276c1486357d94ab886cd07` subsequently failed exact-tag Linux
qualification in `test:all`. The local receipts below retain their original
scope. The [rc.1 portability successor](../2026-11-18-rc-portability/README.md)
preserves the failed tag and repairs the GC test launcher before publication.

The owner authorized builds, pushes, publication and a provisional v16 test
release on November 18, 2026. This phase selects 16.0.0-rc.0; stable v15 uses
`latest`, while the v16 prerelease uses `rc` and must not replace `latest`.
Local qualification is complete as recorded below. Publication is pending
exact-tag CI, registry verification and hosted deployment verification.

## Accepted cost policy

The prior startup/economics controller accepted a specific candidate while
retaining failing historical numeric ceilings. This phase explicitly supersedes
that disposition for this release line with a deliberate, measured budget
baseline. It does not turn the historical runs into passes. The original
[qualification and costs](../2026-11-18-startup-economics/README.md) remain intact.
The user directed that cost and feasibility be weighed and authorized releases.
Independent premise and interpretation reviews found the memory/correctness
benefits sufficient to support this policy, subject to the checks below.

Only previously failing fixture rows may change: v15 entity production and
development, or v16 bare/entity production and development. Fresh finalized
version measurements determine minimal rounded headroom. Workload, externals,
production defines and measurement behavior remain unchanged. No generic
allow-failure path is added. Growth/restoration controls must return 0/1/0.
Wrong artifacts are rejected by source/event/tag identity and build seals, not
inferred from equal compressed size.

## Artifact continuity and release path

The runtime qualification source is `f8cf26e50193ca8aa5580da15b739129313f256e`. Fresh JavaScript and declaration
payloads must match that source's preserved candidate; versioned manifests,
guidance and demos have separate release validation. Earlier timings and heap
findings remain historical observations, not reruns on renamed artifacts.

Publication uses the same exact-tag publisher on both lines. Every normal gate
must preserve a sealed fresh build; mutation checks run separately; an uncached
post-mutation build must match the original seal before packing. Archive hashes
are checked again around registry operations. The supported pinned Playwright
container is shared by release CI. Full diagnostics have a bounded 20 MiB gate
buffer to avoid the previously observed Node default-buffer truncation.

## Release checklist

- [x] Fresh package bytes, old-ceiling results, chosen ceilings and growth controls.
- [x] Publisher wrong-input, wrong-artifact and tamper controls.
- [x] Full normal registry with recorded corrections, mutation proofs, exact
  restoration and fresh installed consumers.
- [x] Production demo, changed interactions and full route/browser checks.
- [x] Independent local release closure.
- [ ] Signed tag and exact-tag Linux qualification.
- [ ] Five registry archives matching publication journal, channel verification,
  provenance/signatures and fresh registry consumer checks.
- [ ] Successful deployments and hosted journeys, with stable and prerelease channels
  clearly distinguished.

## Fresh budget baseline

Production/development gzip bytes come from the fresh production package build
and `node tools/check-bundle-budget.mjs`. The output now prints integer bytes
alongside the existing rounded KiB; measurement behavior is unchanged.

| Fixture | Prod bytes | Dev bytes | Old prod/dev KiB | New prod/dev KiB |
| --- | ---: | ---: | --- | --- |
| bare | 18,385 | 20,763 | 12.41 / 14.79 | 17.96 / 20.28 |
| entities | 45,837 | 49,556 | 26.16 / 28.98 | 44.77 / 48.40 |

The old gate still returned exit 1. Only the stated ceilings change, leaving
less than 10.24 bytes of rounding headroom in each raised row. The completed
checks below establish growth/restoration and final local artifact qualification.

## First complete local run

`node tools/verify-gates.mjs --release` completed with 85/87 passing gates,
two failures and zero known-red exclusions. The first failure log is retained.
Ordinary behavior, installed consumer/type/AOT checks, memory and performance
harnesses, package budgets and publisher controls passed. The remaining failures
were one lint error and the documentation index's missing explicit
`Publication status` label. The lint diagnostic identified the external browser
harness importing executable app routes across an Nx project boundary. It now
reads the explicit route declaration through TypeScript's parser, rejects
unsupported declarations and preserves the complete route inventory assertion.
No lint rule was suppressed. The label correction and full lint budget pass in
a fresh two-gate run. The actual inventory assertion passes, rejects a planted
missing-route change, and passes again after exact source restoration (0/1/0).
These corrections complete normal-gate coverage. They do not relabel the first
run as an 87/87 pass. Exact-tag Linux verification must run the full registry
again before publication.

## Completed local qualification

The [receipt index](RECEIPTS.json) binds commands, logs and SHA256 hashes.
Logs are losslessly gzipped with stored and decompressed hashes. These are
working-tree checks before the final release commit, not exact-tag CI evidence.

All 87 mutation proofs pass, including 13 indirect companion proofs, with zero
unproven, vacuous, blind or errored results. All 3,915 captured files restore
exactly; a separate post-run read also matches the before snapshot. The original
logs and before/after hashes are retained. The package-budget control is passing
normal / planted growth rejected / restored fresh build passing (0/1/0).

After deleting generated output, the uncached production build, package budgets,
fresh installed export resolution, strict bundler/node16 consumer types and
production Angular AOT/browser consumer all pass. The strict production demo
build passes, followed by all 160 browser checks with retries disabled. Publisher
controls pass 60/60, including wrong identity, bypass attempts, artifact drift,
rebuild mismatch and tarball tampering, plus the existing callable-surface controls.

Every one of the 168 shipped JavaScript/declaration payloads matches the
integrity-verified frozen runtime archives after the clean post-mutation rebuild:
139 kernel, 11 Angular, 4 React, 7 Vue and 7 Solid. The selection uses actual
`npm pack --dry-run --json` payloads. Versioned manifests, packaged guidance and
demo content have their own checks; earlier timing/heap studies remain historical
observations rather than measurements rerun by changing a version string.

Independent closure review finds no demonstrated blocker to freezing the release
commit and proceeding to signed-tag qualification. It verified all 29 indexed
receipts against stored/decompressed hashes and originals, both complete snapshots
and their tracked-file coverage, all five frozen archive integrities and the 168
manifest-selected runtime/type payloads. The only post-snapshot source differences
were the two closure documents. Review inspected source/logs and performed read-only
integrity comparisons; it did not rerun the tests. Signed-tag CI, registry
archives/channels and hosted deployment verification remain pending.
