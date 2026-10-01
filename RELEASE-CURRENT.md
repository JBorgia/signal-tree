# Current release work

Updated October 1, 2026. This is the active controller for the public
`fix/v15-link-settlement-diagnostics` worktree, currently **15.4.0 unreleased**.
It does not describe every branch or authorize publication.

## Scope and checkpoints

- Public packages and their order: `scripts/release-plan.mjs`.
- The ledger records v15.3.1 published from `40e668036290b43f9e389e97a35341ea9e5fea7d`.
  That is historical release evidence, not a fresh registry query.
- Current runtime checkpoint: `8fe2664faecbb72c22b14100a41b7060177b1b39`.
  Interceptor/selector reentry now refuses stale outer topology staging; removal
  observation samples demand after callbacks. Kernel: 3,220 passed. This is not
  an RC freeze or a full-release verdict.
- Read-only kernel observation APIs and full Studio coverage are owner-authorized.
  Studio implementation stays in its separate private workspace. Authorization
  does not substitute for integration/packed-consumer evidence.
- The `fix/15.3.2-backport` worktree is a separate candidate. Do not infer that
  it contains all 15.4 changes or reuse a different candidate's verification.
- v16/product-architecture work and old 1.0 derivation phases are separate from
  this release. No new architecture is authorized merely by an old unchecked box.

## Current work and blockers

1. Complete the current installed-artifact store comparison: ordinary and
   enhanced arms, footer on/off, throttle sensitivity, memory and bundle sizes.
   Preserve development/host-contention labels and first failures.
2. Resolve the **entity bundle budget failure** by measured, behavior-preserving
   changes or an independently justified owner decision. Ceilings are unchanged.
   Scratch ablations are opportunities, not validated production fixes.
3. **Complete:** owner-approved guidance consolidation. Historical bodies and
   semantic constraints preserved; branch-specific facts, links, skills, live
   examples and production demo builds checked. See the guidance audit for the
   preserved sandbox/native-build failures and successful host controls.
4. Reconcile full private Studio acceptance, public observation coverage, demo
   and consumer guidance against this candidate. Earlier handoffs are claims
   to check, not proof that every item is complete.
5. After source/artifact changes stop, select an exact candidate and run the full
   release registry and release-only mutation proofs. Rebuild after mutations;
   check strict packed consumers, Angular AOT, demo/browser behavior and clean
   checkout reproduction. Then obtain exact-SHA release-environment evidence.

No item here is waived by a smaller focused suite. Publication, tagging and push
remain separately authorized actions. A changed candidate needs corresponding
fresh verification; do not commit verification prose into a frozen RC.

## Execute

Follow [AGENTS.md](AGENTS.md), [validation](.github/VALIDATION_GUIDE.md) and
[release tooling](RELEASE_PROCESS.md). Continue within the authorized phase after
focused validation, required relevant gates, diff review and a conceptual local
commit. Do not stop for routine permission or open a new product phase by inertia.
Record exact exits, totals, artifact identity, skipped coverage and remaining
blockers. Use external logs while a candidate is frozen.

## Evidence and preserved obligations

Human comprehension sessions remain unchecked; automated tests cannot close
them. Source-comment hygiene is still listed without a closure record. Repository
cleanup, scalar construction-density investigation, restoration lifetime profiling
and additional transaction/staged-editing demo components retain their existing
deferred or separately scheduled scope; this consolidation does not promote them
all to release blockers. Solid memory characterization is explicitly absent.
The old `OWNERSHIP-CENSUS-GATE-0` and `KERNEL-TYPESCRIPT-PEER-POLICY-0` statuses
need reconciliation before being called current blockers. Earlier AI discoverability
and causal-representation queues have recorded closures; do not resurrect them.

- [October 1 takeover](docs/audits/2026-10-01-performance-takeover.md)
- [Guidance audit](docs/audits/2026-10-01-agent-guidance.md)
- [Decided outstanding work](TODO.md)
- [Original release ledger](RELEASE-1.0.md): old failures, commitments and
  checkpoints preserved at their original anchors. Its old “current phase” and
  “next” headings are historical. Relevant unresolved commitments are not deleted
  by this routing change; reconcile them before claiming release completion.
- [Contributor contracts](docs/contributor-contracts.md): current compatibility,
  framework ownership, product decisions and scoped architecture records.
