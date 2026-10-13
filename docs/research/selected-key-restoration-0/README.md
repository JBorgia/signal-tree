# Selected-key restoration: separate dependency and disposition failures

Investigation starts at `9a09c4d1c652cad600bb54a74652dd1ef5a48837` on
`codex/atomic-capture-proof`. Exact runtime baseline:
`19a5bd034d5ebef262f637c397bb41fe50a6a1e3`. D2 and S1 patches and their prior
reviewed records are unchanged. This packet contains experiments, permanent
regressions, and counterexamples, not an accepted runtime integration.

## Established disposition

At the baseline, `entity-active-prepend-changeid.spec.ts` states:

> selecting a MISSING id is not an error — selection outlives the row

`removeOne` preserves the selected key; `clear` explicitly clears selection.
A live selected row follows rekeying. A selection resolves current membership
at its key; a held row reference remains bound to its original entity lifetime.
The omitted-collection README's reset concerns whole collection-path
reintroduction, not every ordinary row reinsertion. Commit `f2f34753` introduced
prepared subject-following selection for key handoff/permutation; its eight
structural-transition tests remain acceptance controls.

L13 at this checkpoint requires:

> Accept, reject, realization and failed settlement must not expose transient
> states that violate the semantic unit being settled.

The earlier publication packet records L13, grouped tap timing and history
`9cb94957`. No assertion here requires application-owned native computed values
to refresh inside a grouped callback. Observer execution phases, direct owned
reads, and callback writes are separate evidence.

## Physical selection loss, independently of invalidation

`selection-trace.mjs` does not read `activeEntity` or install a native observer.
It writes scalar 0→1 and removes selected A, then rolls back. The same script
also tests independently selecting missing B before rollback.

| Point | Baseline / S1 | D2 / D2+S1 | D2+M1+A1 (with or without S1) |
| --- | --- | --- | --- |
| Before removal | A; row and held value 0 | A; row and held value 0 | A; row and held value 0 |
| After removal | A; row/held absent | A; row/held absent | A; row/held absent |
| Restored physical row | A; row value 0 | A visible before selection publication; row value 0 | A; row value 0 |
| After rollback / restoration read | A; same held row restored | **undefined selection; same held row restored** | A; same held row restored |

With independent B selection the final expected key is B. Baseline and S1 retain
B; D2 and D2+S1 discard it. Adding M1 alone does not change this loss.

`prepareTransitionTarget` resolves the selected subject before installation.
After removal it is absent, so the old computation sets `activeIdAfter` to
undefined. Installation restores membership/value first. Later `publish()`
writes that undefined selection; neither cache invalidation nor native timing
can repair it. D2 reaches this existing prepared route for mixed settlement.
A1 preserves the current key when no target subject key exists, retaining the
existing subject-following behavior when one does.

The first trace called a hook `selection-published` while its native read was
still the old published A. That label was misleading. The preserved follow-up
trace records **requested physical selection-write** separately from
`nativeReadBeforeDelivery`: requested undefined, native read A, then delivered
undefined. Original logs were not overwritten. This is not proof that native
reads must refresh inside the group.

## Conditional dependency experiment

M1 adds the existing `idsSignal` dependency only when the selected key has no
live subject. Once present, `activeEntity` again observes only its subject;
native dependency cleanup drops the absent-membership edge. No old held node
is rebound. No blanket collection dependency or SDK argument is added.

Stable-key tokens remain a comparison option: narrower dependency while a key
is absent, but additional allocation, reclamation and lifetime bookkeeping.
They are not implemented or established necessary by these results. M1's
present-row memoization and switched/stopped observer controls pass; this is
bounded behavioral evidence, not a universal retention or cost proof.

Names are deliberately separate: `K1=M1+A1`; `SK1=S1+M1+A1`;
`DK1=D2+M1+A1`; `DSK1=D2+S1+M1+A1`. All start from the exact baseline.
A1 is a physical selection experiment, M1 a dependency experiment, S1 a native
publication experiment, and D2 a responsibility-capture experiment.

## Independent reentry counterexamples

The reviewer supplied an ordinary public-input counterexample, reproduced by
the primary unchanged:

1. Select A. A mixed transaction writes scalar 0→1, rekeys A→X, and adds D.
2. During rollback, `onRemove(D)` independently selects C.
3. Baseline and S1 preserve C. D2, D2+S1, DK1 and DSK1 overwrite it with A.

Prepared publication saves `activeIdBefore=X` / `activeIdAfter=A`, executes
replay taps, then writes the saved A. A1 fixes missing-key disposition but does
not validate later selection changes. The permanent mixed/nonmixed regression
also checks actual callback execution, restored scalar/membership and held
lifetime identity. The nonmixed companion is a useful successful control.

An isolated comparison A2 replaces the final write with physical `deriveLocation`
value comparison. It passes the C case but fails the reviewer's unchanged ABA
case: the callback selects C and then X, which is now an absent selected key.
Baseline keeps X; A2 writes A because the current key again equals saved X.
`deriveLocation` uses physical `peek`, so the failure is not a stale-native-read
artifact. Key equality does not identify an intervening selection decision.
`A2.patch` is evidence only, never applied to the working runtime.

| Exact variant | Simple restoration | Later missing selection | Callback selects C | Callback selects C then X |
| --- | --- | --- | --- | --- |
| Baseline | pass | pass | pass | pass |
| S1 only | pass | pass | pass | pass |
| D2 only | fail | fail | fail | fail |
| D2+S1 | fail | fail | fail | fail |
| M1+A1+S1 | pass | pass | pass | not separately replayed here |
| D2+M1+A1+S1 | pass | pass | fail | fail |
| Above + A2 value guard | not rerun | not rerun | pass | fail |

These ordinary-input selection failures are independent of the original
controlled rich-capture fault. No ordinary-input trigger for that original
injected fault has been established.

## Verification and limits

First unchanged-runtime lifetime regressions: kernel 3 pass / 3 fail; Vue
2 pass / 4 fail. Initial SK1 runs: 6/6 in each. After adding the independent
reentry regressions, SK1 Vue is 9/9; dedicated projection suite is 13/13.
SK1's unchanged shared 4d matrix is 6/6 in each of the four frameworks (24 total),
and the key-handoff structural suite is 8/8.

DSK1 passes all 27 unchanged portable focused replays: six earlier publication
falsifiers, D2's thirteen capture/inspection/refusal/retry/reentry controls, and
eight shared-publication review controls. This does not erase its selection
counterexamples. DSK1's Nx Angular 4d is 6/6 and kernel lifetime suite 6/6.
React/Vue/Solid 4d and Vue lifetime Nx invocations stop **before Vitest** at
TS4104: D's `setAll` route assigns `planFreshSubjectIds(...)` (readonly array)
to mutable `addedSubjectIds: number[]`. Source attribution is D.patch line225;
M1/A1/S1 do not touch that route. This pre-existing experimental D-chain type
blocker is preserved, not repaired under selection scope.

The appended shared 4e matrix retains the original 4d tests unchanged and covers
six requested lifecycle/dependency scenarios with primed and unprimed owned
projections. Every actual observer frame is checked, not only the final read. Results:

| Runtime | Angular | React | Vue | Solid |
| --- | --- | --- | --- | --- |
| Baseline | 5 pass / 7 fail | 5 / 7 | 1 / 11 | 5 / 7 |
| S1 only | 5 / 7 | 5 / 7 | 5 / 7 | 5 / 7 |
| SK1 | 12 pass | 12 pass | 12 pass | 12 pass |
| D2 only | 5 / 7 | not rerun | not rerun | not rerun |
| DSK1 | 12 pass | not rerun | not rerun | not rerun |

The D-chain runs for the other three frameworks remain blocked by the recorded
pretest type error. All fourteen matrix invocations retain their command, runtime
hashes, immutable test hashes and raw output in `matrix-4e-logs.json`. Native
application computed timing is unchanged. Compatibility/full-suite acceptance,
package/demo measurements and broader verification remain gated; no ceilings
are changed.

## Review and disposition

Independent premise review checked the selection contract and history, accepted the
conditional absent-key dependency premise, and supplied both concrete reentry
failures without editing runtime. Primary exact-overlay replays verify those
claims. Independent interpretation review also verified the explicit projection
oracles, original 4d preservation, lane mapping and D-chain type-error attribution;
it identified no additional omitted owned projection in this bounded matrix.
The requested completion of the 4e record is incorporated above. No combined
candidate is accepted. Candidate patches remain separate
from D2 and S1. A future bounded correction must preserve the ordering of newer
selection decisions, either by moving selection disposition to an appropriate
installation/publication boundary or tracking a selection-change identity;
value equality alone is insufficient. Those alternatives are not implemented
or proven here, and do not authorize a new API.

## Replay

Use Node24.15.0 and pnpm10.17.0 with installed repository dependencies. From the
repository root, choose a fresh label (completed evidence cannot be overwritten):

```sh
node docs/research/selected-key-restoration-0/run.mjs base selection-trace.mjs restore replay
node docs/research/selected-key-restoration-0/run.mjs D2 selection-trace.mjs restore replay
node docs/research/selected-key-restoration-0/run.mjs DSK1 selection-trace.mjs restore replay
node docs/research/selected-key-restoration-0/run.mjs base review-selection-reentry-mixed.mjs suite replay
node docs/research/selected-key-restoration-0/run.mjs DSK1 review-selection-reentry-mixed.mjs suite replay
node docs/research/selected-key-restoration-0/run.mjs DSK2 review-selection-reentry-aba.mjs suite replay
```

Expected exits: `0,1,0,0,1,1`. The portable runner loads exact baseline Git
objects and separate patches into temporary source overlays, leaving the
checkout untouched. `selection-variants.json`, `selection-reentry-first.json`,
`selection-guard-first.json`, and `previous-controls.json` give all commands and
exits; `raw-replays.json` retains stdout/stderr, manifests and bundle hashes.
`source-inputs.json` indexes original and loaded source identities; raw bundles
remain at recorded temporary paths. `focused-logs.json` retains full Nx logs,
commands and before/after runtime hashes.

To replay the permanent focused matrix, start with this evidence checkout's
unchanged runtime for baseline. For SK1 in an isolated checkout apply only:

```sh
git apply docs/research/selected-key-restoration-0/M1.patch
git apply docs/research/selected-key-restoration-0/A1.patch
git apply docs/research/shared-projection-publication-0/S1.patch
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test angular transaction-realization.spec.ts --testNamePattern='4e selection lifetime' --maxWorkers=1
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test react transaction-realization.spec.tsx --testNamePattern='4e selection lifetime' --maxWorkers=1
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test vue transaction-realization.spec.ts --testNamePattern='4e selection lifetime' --maxWorkers=1
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test solid transaction-realization.spec.ts --testNamePattern='4e selection lifetime' --maxWorkers=1
```

Final disposition: runtime source restored byte-for-byte to the starting
checkpoint. Permanent tests intentionally expose baseline failures. Only tests
and research evidence are committed; no runtime integration, API acceptance,
v15 change, push, merge, tag or publication. Broader suites were not run. The
final evidence commit is identified by the delivery message and Git history.
