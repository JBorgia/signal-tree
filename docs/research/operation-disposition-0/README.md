# Operation disposition and integration follow-through

**Outcome: no runtime integration.** CPR10 fixes the reproduced omitted-member
settlement fault but fails preserved point-work granularity. The ordinary-input
counterexample below is independently reviewed; it does not disprove atomic
responsibility capture or justify an unrelated architectural reset.

Research parent: `2c05f289ca1a1bdf315c65d8018b6d1a5fc3e962`.
Exact runtime baseline: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`.
Preserved publication checkpoint: `90738bbe8a77aaf4dacad988aa3274685fed27bf`.
Runtime candidates remain isolated patch overlays. No runtime integration,
API acceptance, ceiling change, merge, push, tag or publication is implied.

## Findings and attribution

The preceding packet's I1 eliminates the four unnecessary forward membership
scans without changing the zero-scan assertion. Its broader kernel run was
incomplete: 24 observed failures were subsequently reproduced on original D2
and D2+I1; all 24 passed the baseline. They were not publication-repair or I1
regressions. That incomplete run and its earlier approval rejection remain in
`../membership-point-work-0/`; neither is reclassified as a completed suite.

C1 retains plain-member presence facts independently of rich capture and uses
the established turn-end normalization rules. It freezes expected dispositions
at materialization rather than reading newer live truth during settlement.
Touched-key scratch preparation, linked operation records and indexed disposition
comparison replace copied prefixes and repeated searches. C2 preserves owner
coverage across reentry and clears those records when existing materialization
abandonment clears authority. P1 accounts for actual scalar equality/storage/
revision work; no assertion or budget changed.

R0 (restoring the old mixed application route) is rejected. The unchanged explicit
rollback publication-failure control again sees partial state with authority
retired. R1 is also rejected: its notification variables were out of scope and
raw per-effect validation rejected valid normalized or simultaneous operations.
First results remain in the raw evidence archive.

R2 uses existing normalized rollback planning for the newly prepared mixed route.
R3 shares the established singleton restoration placement policy, preserving
strict multiple-restoration, missing-anchor, handoff and order-delta cases.
R4 retains baseline simultaneous-target admission and applies the existing
`realized` notification metadata to target publications; callback write context
is unchanged. These are bounded compatibility corrections, not weakened tests.

CPR5 = OAP + I1 + C1 + P1 + R1 + C2 + R2 + R3 + R4.
The patches retain failed intermediate steps for reproducibility; acceptance
would require a cleaned implementation and regression tests together.

## Focused results

- CPR2: 13/24 previously failing Nx cases passed; 11 failed. Portable: 21/43
  processes passed, 22 failed. Scope and admission mistakes remain preserved.
- CPR3: 16/24 passed; 8 failed (six absent-link exposure, singleton placement,
  simultaneous key handoff). Its selected portable controls: 17 passed, singleton
  placement failed.
- CPR4 placement: unchanged reversed/before controls 2/2; new coexistence 5/5
  matching baseline; strict missing-anchor controls 8/8 matching baseline.
  The existing anchor matrix still failed two handoff cases until R4.
- CPR5: all 24 prior failures pass unchanged. Affected Nx runs: 284 passed,
  217 skipped across 18 invocations. Prior 39 portable processes pass; the exact
  D2 13 controls are an identified subset, not 13 additional independent runs.

Full verification is tracked separately in later results. These focused figures
are not release sign-off. Runtime overlays are restored byte-for-byte after Nx.

## Work measurements and limits

`operation-work.mjs` measures named source seams, not elapsed time or total work.
At 128 distinct writes, original OAPI copied 8,128 journal references and 8,128
prior scratch effects; C1 links 128 records and copies no prior distinct-key
scratch effects. Disposition searches decrease from 8,256 comparisons to 128
index entries plus 128 lookups. Fixed eight writes have the same named counts
at collection sizes 128, 1,024 and 8,192. Capture and settlement are reported
separately. Successful confirm/rollback and state assertions accompany counts.

`settlement-work.mjs` identifies another cost: one scalar plus one row update,
then rollback, processes two collection snapshots of N entries on OAPI and none
on baseline, for N=128, 1,024 and 8,192. Pure-row and confirmation controls do
not do these scans. This is an implementation regression of selecting the full
collection target, not proof that atomic installation requires collection-wide
work. A point preparation experiment remains separate from CPR5.

The first settlement-work fixture called a nonexistent `pendingCount`; it was
corrected to the existing internal reader. First fixture failures remain saved.
New placement controls also preserve their first mistaken oracle results and
subsequent baseline-grounded expectations. Existing acceptance tests are unchanged.

## Additional fault-model limit

`materialization-failure.mjs` injects a new throw immediately before authoritative
journal folding. It leaves scalar and row speculative, zero pending authority,
and no returned handle. This is a controlled counterexample to universal
exception-safe materialization. It is not the unchanged post-install rich-capture
fault, an ordinary input trigger, or itself corruption of an internal invariant.
Independent review distinguishes this added boundary from the original model.
The tested scalar/row fold has no reproduced fallible application callback;
member-image folding needs concrete supported-input analysis before any stronger
claim. No universal instruction/allocation failure guarantee is established.

## Replay

Use Node from `.nvmrc` and the pinned pnpm. Exact-baseline portable bundles:

```sh
ST_PROOF_OUTPUT=/private/tmp/st-operation-replay node docs/research/operation-disposition-0/run.mjs CPR5 mixed-no-inspect.mjs capture-error replay-1
ST_PROOF_OUTPUT=/private/tmp/st-operation-replay node docs/research/operation-disposition-0/run.mjs CPR5 settlement.mjs explicit-rollback-fault replay-1
ST_PROOF_OUTPUT=/private/tmp/st-operation-replay node docs/research/operation-disposition-0/run.mjs CPR5 omitted-leaf-replay.mjs suite replay-1
ST_PROOF_OUTPUT=/private/tmp/st-operation-replay node docs/research/operation-disposition-0/run.mjs CPR5 reversed-placement.mjs suite replay-1
ST_PROOF_OUTPUT=/private/tmp/st-operation-replay node docs/research/operation-disposition-0/run.mjs OAPI settlement-work.mjs suite replay-1
ST_PROOF_OUTPUT=/private/tmp/st-operation-replay node docs/research/operation-disposition-0/run.mjs base settlement-work.mjs suite replay-1
```

Use a fresh label; the runner refuses to overwrite results. Each run records
source and bundle hashes, baseline, lane, Node version, exit and input stability.
`first-evidence.json.gz` preserves raw logs/manifests/output under original paths.

## Final counterexamples and review disposition

CPR9 reuses the baseline structural planner and matches baseline inventory work
for scalar plus update/add/remove/rekey. Its point planner and row-shape correction
survive the prior 39 controls, 13 routes, ordinary array counterexample and four
inspection cases (54 processes). The D2 13 controls are a subset of the prior39.
No-turn 12-case output matches baseline exactly. Structural work 24-case output
matches baseline calls, lengths and phases (excluding diagnostic stack strings).

However, a collection under an omitted member reaches the existing per-effect
fallback. Under the ORIGINAL writable-token publication fault, scalar restoration
publishes before the remaining compensation: direct/held row stays speculative,
SignalTree `all()` is stale, pending authority is gone, and fault-disabled retry
succeeds without repair. Baseline also fails this injected case; no ordinary
trigger for the injected failure is claimed. CPR9 without the fault restores
correctly. The independent reviewer verified physical/public divergence, exact
first error and the stack through `planScalarFrame.commit`.

R9/CPR10 routes member-presence composition through complete installation. The
omitted-branch, omitted-collection and reactivation fault/control replays pass.
The guard is semantically motivated but too broad for preserved granularity:

```ts
// Seed N unrelated rows; meta.n is omitted before the transaction.
const pending = tree.transact(() => {
  tree.$.meta.n(1);
  tree.$.rows.updateOne('0', { n: 1 });
});
pending.rollback();
```

`optional-member-work.mjs` runs identical baseline/CPR10 operations at N=128,
1,024 and 8,192. Successful rollback, exact full restored rows, absent meta.n,
retired pending authority and successful retry are checked outside measurement.
Confirmation remains a zero-inventory useful-work control. Baseline performs no
settlement inventory calls. CPR10 rollback invokes `readTransitionSource` and
`prepareTransitionTarget`, both processing all N rows. The unchanged
`zero-inventory` assertion passes baseline and fails CPR10. This establishes
added whole-inventory work, not elapsed time/allocation totals or necessarily two
uncached linked-list walks. The original four forward scans remain fixed by I1.

Independent review accepted this as a concrete granularity blocker, not a proof
of impossibility. Its recommended bounded next mechanism is to compose prepared
member-presence, scalar and touched-row participants under one installation and
publication sequence, preserving existing admission. Further route guards are
not accepted as a complete integration. That mechanism was NOT implemented here.

R3's separate singleton-placement algorithm is excluded from CPR7 onward; the
existing structural planner preserves it. R7 adopts the existing rich-capture
whole-row predicate for arrays/primitives/Date/Map/Set instead of assuming records.
Seven shapes pass normal and injected-capture controls (14 cases). Prototype
preservation for class instances fails identically on baseline and remains an
existing limitation. R8 preserves baseline scalar no-turn admission without
changing baseline's deliberate entity footprint admission.

## Broader verification and remaining limits

CPR5 full kernel COMPLETED: 5,721 passed, 3 failed, 12 expected failures and
12 skipped. The three failures all pass baseline: two scalar no-turn inspection
cases and the production statistics guard. R8 corrects them; CPR9's unchanged
queued-inspection/statistics files pass 11/11. CPR9 typecheck and spec-types fail
one internal generic-view mismatch; lint runs for kernel and all four facades,
with two kernel unused-helper errors and existing/new warnings retained in logs.
CLEAN-unverified.patch proposes cleanup for those diagnostics, but has only a
syntax check and proof-hook insertion check. It is not a tested/accepted lane.

Full framework suites did not execute after the kernel failure. No full suite
was rerun on CPR9/CPR10; the later granularity falsifier blocks acceptance.
Package/demo builds and fresh size gates were not run. No ceiling was changed.
The earlier approval-review rejection and unexecuted runs stay in the preceding
packet separately from actual test failures; this turn's broader run was approved
and completed under its own command. No rejection was bypassed.

All runtime overlays were restored exactly. Production source remains at the
research parent; this packet is evidence, patches and replays only. The publication
repair and D2 remain separately identified in the runner's patch lists.

Exact final falsifier replay (fresh labels are mandatory):

```sh
ST_PROOF_OUTPUT=/private/tmp/st-final-base node docs/research/operation-disposition-0/run.mjs base optional-member-work.mjs zero-inventory replay-1
ST_PROOF_OUTPUT=/private/tmp/st-final-candidate node docs/research/operation-disposition-0/run.mjs CPR10 optional-member-work.mjs zero-inventory replay-1
ST_PROOF_OUTPUT=/private/tmp/st-final-fault node docs/research/operation-disposition-0/run.mjs CPR9 omitted-publisher.mjs inside replay-1
ST_PROOF_OUTPUT=/private/tmp/st-final-fix node docs/research/operation-disposition-0/run.mjs CPR10 omitted-publisher.mjs inside replay-1
```

Expected exits are 0, 1, 1, 0 respectively. `STATUS.json` gives the final compact
status; `first-evidence.json.gz` holds raw manifests, logs and outputs keyed by
original paths. Saved Nx scripts preserve exact executed commands and overlay
hashes; their absolute /tmp input paths are historical, not portable setup tools.
