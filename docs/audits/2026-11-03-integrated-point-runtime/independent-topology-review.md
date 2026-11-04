# Independent unchanged-topology review

Disposition: no concrete topology blocker demonstrated within the current guarded source-point path.

Baseline: `f165d28e55dce241ff6466a58c9b850f1bbc20f3`. Checkout: `/Users/jonathanborgia/code/signaltree/.worktrees/v16-sparse-responsibility-0`. This is source inspection only. No tests, builds, measurements or runtime reproduction were executed by this reviewer. No repository files were modified. Only this requested review artifact was written.

## Exact inspected source

- `packages/kernel/src/lib/physical/entity-ordinary-topology.ts` SHA256 `63972d6220bb231272e3555a78db81400e6972eaf69d38d04e93e69761c52755`
- `packages/kernel/src/lib/entity-signal.ts` SHA256 `a8d4e6f119fb429ce3a3a455959ede58a3f6547b843c726af9105acbc792e799`


The diff compared current working source against f165d28. The review is limited to the `isAligned()` / `prepareUnchanged()` eligibility and unchanged topology behavior; it does not certify the other entity publication, compact fact, owner-window or lazy observation changes in that diff.

## Reasoning

`EntityOrdinaryTopology.isAligned()` requires both exception indexes empty and both endpoint overrides absent (current lines43–45). `commitExistingSubjectValue` calls the shortcut only after that positive source-wide check, matching present physical/ordinary lifetime and key, no active write context, non-null explicit fields and no restored-field selection (entity-signal current2555–2558). Local subject presence alone was insufficient; the added global guard closes that premise gap.

Under these eligible facts, the baseline generic point preparation's ordinary placement is the physical placement fallback for every subject. Its nonstructural present-subject branch emits the same ordinary before/after mutation; its transient `write()` changes neither membership, key nor adjacency. Both placement patches stay empty. `prepareInstall` therefore computes no per-subject updates, an unchanged continuity interval, and undefined head/tail overrides. Those overrides are already undefined by `isAligned()`. Skipping the assignments leaves the same source topology state.

`prepareUnchanged()` retains the exact current continuity token as both before and after, with frozen empty pairs; it does not mint a new topology frontier. The enclosing completed topology unit still has its own fresh operation identity. Its ordinary interval remains distinct from the physical interval even when both are unchanged.

The generic point branch's ordinary payload comes from `valueStore.ordinaryForSubject`; the shortcut likewise uses that source-owned payload. It does not substitute the physical row. `valueStore.installValueTransition` remains the payload authority. Source placement preparation no longer constructs temporary stages, but no installed value authority moves into topology.

Responsibility capture and committed observer preparation still receive the ordinary change array and completed topology unit. The source path still samples the initial physical commit revision, rejects preparation reentry, finalizes and validates publication before installing the value, installs native publication records, advances installed-read and physical revision state, and drains observation/native completion with original first-error handling (current2591–2614). The topology shortcut itself neither grants responsibility nor changes those boundaries.

## Earlier normalization concern

The baseline generic installer assigns head/tail overrides even when its patch union is empty. An already-present redundant override equal to the physical endpoint could be cleared by that installer; an unrestricted no-op would preserve it. The current source-wide guard excludes every override, redundant or otherwise, so the shortcut does not need to rely on a global proof that redundant overrides are unreachable.

Earlier source inspection found paired ordinary normalization after physical frame installs, identity fallback, ordinary realization and whole-target restoration. That observation was not treated as universal proof. The new conservative guard is sufficient without promoting that broader observation into an invariant.

## Relevant falsifiers inspected, not executed here

- `entity-update-one-equivalence.spec.ts`: subject identity, projection refresh, undo/rollback, realized versus authored classification.
- `entity-semantic-point-recurrence.spec.ts`: physical inspection divergence and untouched ordinary payload baseline through rollback.
- `entity-inspection-egress.spec.ts`: inspection-created subject adoption and inspection rekey followed by authored update; these must remain outside any invalid local-only admission.
- `link-order-audit-regression.spec.ts`: an inspection reorder must not ride out on a later point edit. Any topology override forces the generic fallback now.
- `complete-structural-sequence.spec.ts`: ordinary versus physical occupancy, key reuse and stale prepared structure.
- `entity-occupancy-steps.spec.ts` / `rich-unit-source-group.spec.ts`: committed capture patterns retained by the enclosing producer.

## Limits

`prepareUnchanged()` is not a standalone authority to call on arbitrary topology. Its safety is established only for the single guarded source-point producer inspected here. The class method has no internal freshness guard; source/physical revision validation remains the enclosing installation protocol's responsibility. A future caller or relocation across callback-capable preparation must re-establish these premises.

No executable coverage, CPU/heap benefit, numerical point-work pass, general source-point pipeline correctness, release qualification or adoption decision follows from this review. Current code was read during an active implementation; the hashes above bind the reviewed files, and later changes require checking whether this narrow reasoning still applies.
