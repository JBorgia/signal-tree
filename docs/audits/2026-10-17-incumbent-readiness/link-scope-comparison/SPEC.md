# Link eligibility: execution scopes versus explicit ownership

Specification comparison only, at 2b1e80e8912fc9321af0d97818c1014317da4d84.
No proposed notation below is an existing or selected API. No implementation,
new benchmark, production policy change or B work is authorized by this record.

## Premises and discriminator

Owner direction: “Do not implement another lifecycle heuristic or infer dependencies
by comparing values.” Also: “It must also state what happens when the read occurred
before the tracked scope. Otherwise the ambiguity merely moves.”
The approved surviving-write choice is “Preserve surviving-write semantics”: a new
ordinary write after rejection does not automatically inherit a rejected causal origin.
That does not authorize immediate publication while other dependencies remain pending.

The unchanged executed pair at 2b1e80e8 has one pending x=7 owner: literal y(7) and
reactive y(x()) expose identical responsibility facts. Both hold and send after
confirmation. This comparison changes information supplied to admission, not how
terminal outcomes or value equality are interpreted. Earlier policy/adoption records
already identify the hidden-input problem; they are reused, not repeated experiments.

## A. Tracked execution scope

Proposed obligation: during one synchronous supported invocation, track consumed
SignalTree source revisions, including dependencies already attached to derived
revisions. Admission receives that set with each new destination revision. A scope
is not a transaction: it must not imply rollback of writes or new settlement authority.

Illustrative notation only:

```ts
tracked(() => y(7));   // no observed source reads
tracked(() => y(x())); // observe exact pending x revision
const saved = x();
tracked(() => y(saved)); // zero observed reads; completeness NOT established
```

The first two are distinguishable by read instrumentation. But zero observed reads
is not proof that the callback has no speculative inputs. JavaScript closures,
objects, globals, event arguments and native cached computations can carry them.
Merely wrapping an arbitrary callback cannot safely mark its read set complete.

Two honest variants exist within this option:
- Incomplete-input scopes: observed dependencies are a lower bound; unobserved inputs
  remain unknown. Safe, but the literal case cannot automatically earn a completeness
  certificate and the central progress requirement remains unproved.
- Complete-input scopes: all inputs and the trigger must belong to a supported
  instrumented domain, or the application must attest their provenance. Arbitrary
  JavaScript callbacks cannot be sandboxed by TypeScript types or a wrapper. Without
  a restricted evaluator, completeness is an application obligation. A restricted
  language/evaluator is outside this comparison, not a proposed implementation.

Before-scope reads must therefore be supplied with an authentic immutable provenance
receipt, reread within the scope when current-value semantics are acceptable, or
remain unknown. Rereading is not a semantics-preserving substitute for a historical
value. Unlabelled saved primitives cannot be recovered by value comparison. Never
silently call them committed. A false completeness assertion has the same risk as B.

Supported scope rules, conditional on a reviewed completeness contract:
- Include callback triggering event and captured input receipts at entry. A callback
  invoked by speculative x may depend on x even if it writes a constant. Do not treat
  this as the unconditional literal discriminator.
- Conservatively union observed reads/control inputs across the whole invocation;
  defer eligibility until return. This avoids publishing early writes before later
  reads or errors are known, but can over-hold genuinely independent writes in the
  same invocation. No promise of exact JavaScript data-flow analysis.
- Nested scopes inherit known context and merge dependencies outward; a nested
  “independent” label cannot clear the parent's known requirements. Reentrant observer
  delivery starts with its triggering revision, not a fresh untainted frame.
- After await/timer/event continuation, no ambient scope survives. The continuation
  needs carried receipts or a new complete declaration; otherwise unknown/held.
- A throw closes the scope in finally; already-installed writes keep their evidence.
  A complete captured read union is not invalid merely because the callback threw.
  An incomplete/unsupported capture leaves writes unknown/held, not falsely clean
  or silently rolled back. Existing callback/recovery behavior must remain intact.
- Cached native computed reads require dependency evidence from the adapter or are
  unknown. Observing only the final primitive does not expose its cached reads.
  No changes to native computed/effect timing or freshness guarantees are proposed.

## B. Explicit publication ownership

The application supplies a COMPLETE possible-dependency set for a specific operation,
including retained inputs and trigger dependencies. Empty means an explicit assertion
of independence, not absence of information. Omitting a declaration remains unknown.
Owners and payload/revision must be captured coherently; a declaration on a connection
or field cannot bless every later payload.

Illustrative notation only:

```ts
owned({ complete: true, owners: [] }, () => y(7));
owned({ complete: true, owners: [p] }, () => y(x()));
const saved = x(); // application must retain its real provenance too
owned({ complete: true, owners: [p] }, () => y(saved));
```

The discriminator is the declaration, not runtime proof. If the last callback
falsely declares [], it may leak speculative data. This cannot be described as an
automatic safety guarantee. Existing observed dependencies are mandatory lower bounds:
a conflicting complete declaration fails before publication and cannot replace prior
valid evidence. If no observed read evidence exists, hidden omissions are undetectable.
Partial declarations can add dependencies but cannot clear unknown. Foreign/invalid
owner tokens cannot become clean evidence; a live foreign owner needs verifiable
identity and outcomes or remains unknown.

Application burden includes keeping receipts/owners with saved values, recomputing
the set when a workflow changes, and carrying it across async boundaries. Declarations
must cover triggers and all contributors, not just the transaction that happens to
be open. This is distinct from assigning the write itself to a transaction: no new
compensation or rollback membership is implied.

## Shared constraints; not newly selected production semantics

- A revision with verified empty dependencies may publish while unrelated owners
  remain pending. Multiple dependencies require all relevant pending owners to resolve
  under the applicable policy. Refusal is not confirmation or loss of authority.
- Known rejected/abandoned evidence cannot be relabelled clean to release the same
  held receipt. Existing experimental hold remains conservative. No new permanent
  veto on current surviving production truth is selected. Any eventual fallback after
  rejection must preserve the approved existing surviving-write behavior; this
  specification does not authorize cancelling ordinary writes or changing that policy.
- A new write after rejection is a fresh authored revision under approved semantics;
  pending dependencies still need accounting. Earlier rejected origin is not a global
  taint that follows every later application use forever.
- Later replacement gets its own evidence, including ABA; no value-equality inference.
  Incomplete replacement cannot borrow an older clean ticket. Queued supersession
  doesn't retract started I/O or other derived copies.
- Refresh responsibility separately from value observation. Revalidate exact revision
  at endpoint invocation; retain proven serialized/corrective in-flight delivery.
- Dispose cancels unstarted connection work and detaches subscriptions; started I/O
  remains uncertain. Tree destruction is distinct. No new cancellation or lifetime
  contract is selected. Dependency indexes/retention need evidence if ever implemented;
  useful counts are affected sources/owners, not every registered tree.

## Developer experience and scope comparison

These are source-level burden estimates, not measured usability or runtime timings.
Existing Ticket review and Shipment command examples remain optional evidence, not
implementations of either proposed surface.

| Question | Tracked scope | Explicit ownership |
| --- | --- | --- |
| Literal versus fresh getter | Read set distinguishes; completeness still required | Different complete declarations distinguish |
| Saved value or event argument | Receipt or input-completeness attestation; otherwise held | Application retains and declares all dependencies |
| Cached computed | Adapter evidence or unknown | Application declaration; hidden omission can leak |
| Typical shipment calculation | Wrap calculation; instrument every supported input and trigger | Maintain complete truck/dock owner list per operation |
| Independent audit event | Trusted event boundary needed | Explicit empty assertion with application responsibility |
| Generic helper | Preserve input receipt/completeness contract across helper calls | Carry owner set through helper parameters/context |
| Four frameworks | Different getter/native-cache integration; cached reads hardest | Same conceptual declarations; facade write syntax differs |
| Backend | Ordinary endpoint; no exactly-once claim | Same; declarations do not add durability |
| Primary developer risk | Assuming an empty observed set proves no hidden input | Omitting an owner or wrongly declaring independence |
| Runtime work, unmeasured | Read instrumentation, dependency union and scope cleanup | Token validation, exact revision mapping and lifecycle cleanup |

Angular/Solid `.set`, Vue `.value`, React/kernel callable writes remain unchanged.
A framework-neutral contract must own eligibility; adapters can expose supported
read evidence, not independently decide truth. No speculative promise that arbitrary
Angular/Vue/Solid computed caches or React closures become tracked through a wrapper.

## Specification acceptance cases (not executed)

1. Literal write with certified complete inputs publishes while p remains pending.
2. Fresh getter consumes pending p; hold. Multi-hop and two owners retain dependencies.
3. Saved speculative primitive before scope: unknown/held absent carried evidence;
   an empty observed set alone must not authorize it.
4. Intentional false empty declaration with hidden saved input: demonstrate limitation,
   never call it safe. Contradiction with observed evidence must prevent publication.
5. Triggered literal, nested callbacks, read-after-write and throws cannot escape known
   dependencies. Async continuation with missing receipt remains unknown.
6. Fresh overwrite after rejected origin preserves approved surviving-write semantics;
   another pending owner still blocks if relevant. No permanent inherited taint.
7. Retain unchanged ABA, reentry, inflight, rejection and disposal delivery controls.
8. Foreign runtime/cached input with unavailable evidence remains unknown. Do not
   extrapolate single-registry safety into a universal domain.

## Decision boundary

Neither a plain tracked wrapper nor explicit declarations supplies automatic proof
for arbitrary ordinary JavaScript. Tracking can reduce owner-list maintenance for
supported fresh reads; explicit ownership states the residual application responsibility
more visibly. They offer conditional independence; neither establishes the tested ordinary-write
requirement without an additional input contract. This does not reinterpret that
requirement as a promise to infer arbitrary asynchronous causality.

Before any API selection or implementation, the owner must decide whether an explicit
complete-input/ownership responsibility is acceptable for immediate publication, with
all unannotated or unverifiable paths retaining conservative hold. If not, this finite
comparison provides no qualified immediate-progress solution; conservative scope with
optional independent workflows requires a separate owner-approved requirement change.
Neither alternative is silently selected by the research. Production hold remains.

## Recommendation and review status

Do not select a plain tracked-callback API as a solution to this requirement. If the
owner accepts application responsibility for complete inputs, explicit publication
ownership is the clearer specification starting point; tracked reads may later
reduce declaration work but cannot remove that responsibility at hidden boundaries.
This is a recommendation for contract selection, not permission to implement either.
If that burden is unacceptable for v16, request the conservative automatic-scope
decision rather than another lifecycle heuristic. Neither performance nor usability
has been measured for these proposed APIs.

Independent review of premise and draft found no blocking issue for this comparison.
Its throw/capture-completeness clarification is incorporated above; raw review is
preserved alongside this specification. No acceptance case here was executed anew.
