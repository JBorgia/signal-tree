# Link provenance feasibility — bounded result

Production source remains `b7f93463cbdf439d74d33a2834f87fd58856dd39`
(runtime `87f6831fa60cafe87508f0ace84b7638698ca3b0`). No runtime, API,
adapter, budget or B changes. The safe hold remains active. No release freeze.

## Disposition

**No integrated solution established.** Instrumented value-revision labels model
useful conditional publication, but the experiment does not supply an automatic
boundary that separates independent writes from unobservable copies. The initial
model also failed synchronous nesting. Conservative frame composition repairs
those safety witnesses but fails a prior useful-progress assertion. Neither model
version satisfies all unchanged tests; neither is proposed for integration.

The strongest new executable production observation is narrower than a universal
impossibility claim: at the current notifier/active-write-context boundary, a later
constant write and a closure copy have identical normalized observed traces. That
boundary cannot justify treating one as independent and the other as dependent.
Different instrumentation or an explicit product boundary could change the facts.

## Preregistration and unchanged failures

SPEC.md was hashed before execution; its hash still matches
spec-before-execution.sha256. It declares model instrumentation and exclusions,
including trusted fresh input as a hypothesis, not an existing application API.

| Version / execution | Result | Interpretation |
| --- | --- | --- |
| Initial model, original cases | 15 pass | Conditional instrumentation only; not integrated Link qualification |
| Initial model plus independent review witnesses | 15 pass / 3 fail | Nested callback captures, returns and captured-local assignment lose pending dependencies |
| Conservative parent/child frame union, same tests | 17 pass / 1 fail | Nested leaks corrected, but independent outer constant retains nested q dependency after p confirms |
| Unchanged-kernel paired probe | Assertions pass | Constant and copied 7 produce identical observed metadata; safe hold blocks both until confirmation |

All original assertions remain. The final nested test fails before its later q
confirmation assertions execute; those trailing assertions are not a final pass.
The initial model is preserved as model-before-nested-fix.mjs. The conservative
alternative is model.mjs. No exceptions were added to recover favorable counts.

Concrete nested leak in the initial model:

```js
// x belongs to pending p; b belongs to pending q
m.deliver(x, value => m.deliver(b, () => m.write('y', value)));
m.settle(q, 'confirmed'); // y=7 becomes eligible although p is still pending
```

The revised frame rule inherits parent facts and returns child facts to the parent
in finally. It prevents that leak and the return/local witnesses. It cannot tell
whether a child changed a captured local or whether an outer constant ignores it.
The unchanged outer-constant control therefore stays held. Independent review
notes that its expected progress is stronger than fresh top-level input progress
and the specification's conservative constant-after-read policy. It remains a
failed model oracle; it is not established as a separate frozen public contract.
This is a conservative
false dependency, not lost authority or a reason to weaken the assertion.

## What the actual-kernel probe establishes

Both arms create pending x=7, observe its delivery, cross an await, then install
y=7. One uses the captured delivered value; the other uses literal 7. The installed
value, old value, mutation intent, delivery metadata and active context agree.
Only per-tree owner/transaction identifiers are normalized to names; every other
recorded field is retained. Both arms are deliberately exposed to x so an ambient
"ever saw pending data" bit cannot distinguish actual value use.

The source callback is not claimed to be a public notifier API. This is the
existing internal observation boundary used by the preserved supported reactive
controls. Probe tree/transaction/Link operations use the actual source; no runtime
instrumentation alters behavior. All loaded kernel source hashes are saved.

Pending endpoint payloads are [] in both arms. After confirmation both deliver [7].
The probe does not exercise rollback, pretend async capture is already supported,
or establish equality of all conceivable JavaScript instrumentation. Existing
write/delivery evidence is insufficient; the safe hold is functioning.

## Observability and lifecycle inventory

- **Notifier arguments:** observable source envelope can seed a synchronous frame;
  getter-only tracking would miss an argument copy. Metadata must follow each
  queued revision, including older delivery after a newer overwrite.
- **Portable reads:** kernel has a computation invalidation graph, but it is not a
  provenance tracker for arbitrary callbacks; peek and updater argument inputs
  need explicit handling. Preparation/publication hooks would be additional work.
- **Native cached values:** adapter cells/computeds may return cached values without
  calling kernel read/compute. Source review identifies missing consumption hooks.
  No four-framework cache instrumentation was executed or qualified here.
- **Current authored version:** model replacement releases old labels only for a
  separately trusted execution. Same-value replacement increments a model revision;
  production equality/no-op compatibility is unproven, not silently changed.
- **Discard:** a rejected-source copy remains ineligible until corrected. Token
  terminality alone does not authorize rejected payload. Model tests token outcome,
  not real compensation, failed rollback/retry or transactional capture atomicity.
- **Nested callbacks:** conservative two-way propagation prevents tested synchronous
  transfers but overholds an independent constant. An execution frame is exposure
  evidence, not exact JavaScript use analysis.
- **Errors:** model finally restores context while keeping already-installed facts.
  This is not proof of production observer-error recovery or allocation safety.
- **Cleanup:** diagnostic root enumeration reaches zero after overwrite/queue drain
  and destruction. It is not heap collectibility, reference counting, production
  reclamation, or safety for destruction during an active callback. External record
  handles and callback closures may still retain facts.
- **Unknown deferred work:** the model holds it explicitly. Calling unscoped writes
  clean leaks the copy; calling them unknown also holds unrelated direct writes.
  A hypothetical trusted-input entry point buys progress but needs an actual source
  of authority. It cannot be inferred from a missing ambient transaction context.

## Decision input

Three options remain distinct:

1. Automatic provenance with additional observable read/delivery boundaries could
   support a declared subset, but must define cached reads, nested exposure,
   unknown work and version/settlement lifecycle. This experiment does not establish
   full automatic independence or a compatible adapter implementation.
2. A reviewed explicit independently-publishable input boundary could provide the
   missing assertion. It needs a precise scope and misuse/error semantics; no API
   syntax or application obligation is selected here. It must not merely reset
   taint inside a dependent callback and thereby relabel a copied value as safe.
3. Conservative hold remains safe for the existing pending controls and leaves
   approved independent progress unmet. It is not a silent scope downgrade.

Recommendation: preserve the hold and evaluate the explicit-boundary product
contract before another runtime implementation. A narrower automatic contract is
also a product decision if it excludes previously promised independent work.
No broad architecture rewrite, repeated benchmark campaign or release verification
is justified by these model results. The two entity-budget failures are unchanged
separate blockers; previous approval does not cover them.

## Replay

Node 24.15.0, pnpm 10.17.0 repository dependencies. From this directory:

```sh
node --test model.test.mjs # expected exit 1, 17 pass / 1 fail
SIGNALTREE_ROOT=/absolute/path/to/checkpoint node kernel-probe.mjs
```

To reproduce initial three safety failures, copy model.test.mjs and
model-before-nested-fix.mjs into a disposable directory, naming the latter
model.mjs; node --test then reports 15 pass / 3 fail. The original 15-case result
is retained in model-first.log; the original cases are the first 15 tests.
No production suites rerun: no package source changed. Review reports distinguish
source inspection, reviewer executions and root executions.

## Independent review

[Premise review](PREMISE-REVIEW.md), [executed nested witnesses](MODEL-REVIEW.md),
and [final interpretation review](FINAL-REVIEW.md) preserve distinct questions.
The reviewer executed the initial nested witnesses; other results were inspected
as raw evidence, not independently rerun. The root reproduced all three failures.
