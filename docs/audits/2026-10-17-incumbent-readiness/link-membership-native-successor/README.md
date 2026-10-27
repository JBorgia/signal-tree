# Bounded membership successor: rejected at fixed-window recurrence

Owner-authorized implementation under specification `392fcf46`. The scalar and
ordinary-membership lane has useful scoped passes, but a new ordinary-input
counterexample defeats its fixed authorship window. Stop dependent runtime work;
do not activate this implementation or infer failure of declared Link in general.

## Exact identities

- Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
- Frozen rejected predecessor: `2dacae7b9e9137018d05c4e00382ac9287bc76d4`.
- Prewritten test-only baseline: `2d24966cc457529f876b06d950dd181acb5bfb69`.
- Rejected scalar/membership implementation and new falsifier:
  `b9eef50de5cdded79792ac043ab99ce03d0144ee`.
- Final frozen checkout including separately committed, unconnected entity draft:
  `616892867796a1f0a185416b6be01331aaa7e9de`.
- Checkout `/private/tmp/link-membership-native-successor`, branch
  `codex/link-membership-native-successor`.

The two local commits preserve research, not accepted runtime. The final checkout
matches the tested working-source identities; no fix followed the final failure.
The entity draft adds unused methods/types but no writer/Link/factory hookup.
The audit ran with those draft files present; it is not entity-specific validation.

## Decisive unchanged falsifier

`native-window-preparation-audit.spec.ts`, fourth case, prewritten before run010:

```typescript
const q = source.transact(() => source.$.x(7));
const p = target.transact(() => target.$.x(source.$.x()));
const r = later.transact(() => later.$.x(9));
// Initial delivery is held.
p.confirm();
// Actual: target Link sends [7]. Required: [] while q remains pending.
q.confirm();
// Required later useful delivery while r remains pending; not reached in010.
```

This is ordinary public input, without injected failures or a false complete
declaration. The target value may remain ordinary authored truth. Its transaction
ownership does not prove that the value is independent of foreign pending inputs.
No new public semantics are needed to explain the expectation: SPEC admission3
and its raw-copy paragraph require possible-owner capture for unobserved,
undeclared authorship. Capturing at delivery would also incorrectly add later r.

Run010 records3 ordinary passes and1 failure at the assertion immediately after
p confirmation. The post-q liveness assertion did not execute. The earlier3
preparation controls pass in that same run. Original source/hash/log are retained.

## Cause and stopping boundary

`experimental-publication/lifecycle.ts:58` uses `known.length === 0` to decide
whether to acquire any possible-owner window. Native transaction p supplies a
known owner, so its write captures no possible foreign q. Confirmation drains p;
ordinary fallback sees no q obligation and sends7.

The005 result showed six receipt failures because known p was also represented
as uncertain possible p. The005-to006 correction removed every possible owner for
transaction-authored writes. That is broader than eliminating duplicate p.
The focused006 pass therefore did not establish foreign-owner completeness.
Run010 falsifies the purportedly corrected scalar authorship mechanism, satisfying
the approved covered-recurrence stop. It is not a missing entity writer.

Independent review checks both the contract premise and interpretation in
`independent-review/REVIEW.md`. The primary agent verified the exact predicate,
raw failure, test input, prior005/006 change and specification. No additional
replay was needed to agree with the observed first result.

## Results without double-counting

| Run | Result | Meaning |
| --- | --- | --- |
| 001/002 | Direct library TypeScript:11 TS4111 diagnostics | Not a clean typecheck; no final candidate type qualification |
| 003 | No matched tests | Runner path normalization error; tests not executed |
| 004 | 59 pass /19 fail | First executed membership/window run; wrong accessor/store domain key omitted absence evidence |
| 005 | 72 pass /6 fail | Domain correction; duplicate possible-self changed receipt basis |
| 006 | 78 pass |54 membership +19 window +2 original omission +3 registration |
| 007 |103 pass /2 fail | Two preserved historical oracle differences; not counted as passes |
| 008 |2 pass /4 skipped | Registration composition and preparation reentry; four entity cases deliberately filtered |
| 009 |3 pass | New scalar preparation-failure/reentry controls |
| 010 |3 pass /1 fail | Same3 plus cross-owner transaction falsifier |

These runs overlap and must not be summed as unique passing tests. The original
81-case baseline remains28 pass/53 fail on test-only2d24966c. It was not rerun.
No assertion was weakened or changed in this implementation.

The007 wider-root unknown-coverage case and known-native-input contradiction have
existing reviewed interpretations: `link-evidence-scope-design/DESIGN-REVIEW.md`
(sixth fallback) and `link-evidence-scope-successor/RUNTIME-REVIEW.md`
(known-input contradiction). They remain unchanged red assertions. Neither
interpretation excuses the new undeclared cross-owner leakage or grants automatic
independence to hidden foreign inputs.

## Incomplete gates and preserved draft

Entity source admission, field/collection provenance, mixed undo and restoration
chronology are unimplemented, not passed. See `entity-draft/STATUS.md`. Its scoped
claim of no executed verification means no draft-specific verification; run010
used the shared checkout but did not exercise the new unused draft methods.
The scalar/membership passes do not qualify those routes.

Independent review additionally identifies a source-only physical/ordinary snapshot
certificate concern: NativeView identity follows semantic `mutation.changed`,
which is not always physical change after inspection. The primary agent verified
the two flags are distinct in the scalar slot source. No executable cache failure
is claimed and no repair is authorized by that observation.

No new indexed-work, retirement/GC, retained-receipt, four-framework, combined
qualification, complete type/spec-types, full suite, lint, installed-artifact,
CPU/heap, bundle or demo result is claimed. Those gates were not executed after
the recurrence. Direct-library diagnostics and runner nonexecution are separate
from runtime assertion failures. There was no approval-review rejection here.

## Options and recommendation

Preserve the approved contract and production hold. A potential successor would
need to distinguish known authorship from remaining possible foreign inputs at
the same installation boundary. Capturing the current possible set without
duplicating already-known identities is one hypothesis, not a verified repair.
It must also handle declarations, nested native inputs, settlement during
preparation and fixed late-owner exclusion through one rule; the earlier receipt
controls cannot be waived. No such correction was made after this stop.

Alternatively the owner could change the contract to treat transaction callbacks
as complete dependency declarations, but that would change application burden
and permit this undeclared-copy example. It is neither authorized nor recommended.
This record rejects the implementation, not the bounded possible-owner policy.
Continue only under a concrete reviewed successor disposition, not another silent
predicate patch. B remains closed. No ceilings, public exports, activation,
merge, push, tag, publication or release changed.
