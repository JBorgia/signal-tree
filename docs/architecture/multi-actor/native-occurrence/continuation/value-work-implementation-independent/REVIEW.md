# Independent frozen value-work implementation review

**Bounded accept of the handoff correction for composition. No supported-path blocker demonstrated.** The original exact C15 scalar-frame failure is fixed. The private monkeypatched author-reentry failure remains real evidence of a stronger model boundary, but does not establish a supported publication-contract regression. Keep it visible; this is not a claim that the full selected suite is green, nor acceptance of unrelated equal-whole/enrollment findings.

## Exact identities and scope

Author: /private/tmp/st-c17-value-work-correction. Final report and source freeze confirmed directly with author; no candidate edits. Base C17 manifest `893effd2a669e7658fa34f89aecd0d1633488465bb3c32ddea98dd7a9d87aa47` (3061 entries). Candidate SNAPSHOT-VALUE-WORK.json `e87715deeebe1392fb4d8996376b6cb2e2a9e9678d47e8dbcf864857560d8382` (3062). Full entries verified before copying and after execution. IDENTITY.json contains all changed source hashes.

Exactly two runtime files: experimental-publication/private.ts and link.ts; one new value-work-handoff.spec.ts; one comment-only recipient-window-independent.spec.ts change. Original scalar-frame file is byte-identical to exact C15. Independently verified the comment-only fixture emits identical JavaScript. Package barrels/exports, lint settings, discovery, original assertions and policies are unchanged. acknowledgeProjection is a private implementation-module export, not a new public package API.

Reviewed docs/review-contract.md and contributor ownership constraints; root HEAD 628d302dadb082a48c58528651c9088234d0a777 and unrelated dirty files preserved. Own scratch copies and tests only. No release activity, broad suite, historical rounds, or runtime repair.

## Mechanism findings

References below are candidate packages/kernel/src/lib paths.

- private.ts:28–47 shares the selected projection and produced/taken cursors in one delivery cell across existing shallow Binding clones. selectProjection advances production only on changed selection; support-only selection carries the accumulated epoch. Receipt ownership is a WeakMap keyed by issued immutable receipt, and acknowledgment uses max(taken, captured epoch) after verifying the live recipient cell. Old, foreign, disposed, or fabricated receipts cannot advance another recipient's cursor.
- selectedReceipt rejects an unfinished/reducing binding and a selected fact different from live current. refreshSource (:529) and projectScalarContribution (:553) re-fetch this live selection after draining. The shared reducing guard releases in finally. Recursive inspection cannot expose partial reduction or count work twice. There is no producer acknowledgment inside reduction, readiness, supersede, no-write, or operation retirement.
- link.ts:1046–1058 adopts fact and payload, ORs outstanding work into dirty, then acknowledges without a callback. Both receipt paths use this helper. Same-fact refresh still acknowledges; support-only refresh does not clear dirty. Existing fact-only legacy paths retain their prior dirty ownership until refresh. The existing held/queue/waiting-send chain then owns adopted work; no new retry/endpoint policy is introduced.
- Current support remains independent of the cursor. Admission, current-ticket allowed check after observable sending, operation retirement and native obligations are unchanged. Pending equal B cannot borrow A's declared permission. Public pending-q and already-delivered contrast assertions pass; the pending-q case also passes base and is safety coverage rather than a claimed regression fix.
- No new strong global delivery registry: receiptOwners is weak-keyed. Issued receipts can retain their cell while held, as their ownership record requires; ordinary Link adoption does not keep them in a new queue. Actual disposal/waiter and registry-baseline controls pass. This is bounded lifetime evidence, not a universal GC theorem; no GC campaign ran.

## Private reducer mutation: counterexample retained, boundary adjudicated

Unchanged new test value-work-handoff.spec.ts:45–49 monkeypatches RecipientOccurrences.prototype.replace. Immediately after the real replace returns, it runs a fresh independent a(2) declaration while outer a(1) reduction is still on the stack. Candidate sends {a:2,b:0}, then after b(3) sends stale {a:0,b:3}; physical state is {a:2,b:3}. Base C17 fails earlier with no first send. Independent replays reproduce both exact failures. It is NOT a pass, and base failure at an earlier assertion does not prove the later stale-payload effect harmless.

Causal source explanation: ready at private.ts:297 invokes installFact before :298 assigns its reduced valuePayload. The injected author installs a shallow clone capturing the prior scalar payload. The shared delivery cell correctly exposes the first newer selected receipt, but this deliberately interleaved wrapper retains the older completed payload for a later fold. This demonstrates that sharing the handoff slot alone is not general transactional protection for every mutable Binding member.

However, the injected call is outside the actual boundary contract:

1. installFact (:168–171) supplies onProof whose body only sets ownProofs/proofs WeakMaps.
2. RecipientOccurrences.replace / replaceEntry (:55–75 in recipient-occurrence.ts) updates internal maps/counts, calls that internal onProof, and registers an internal readiness callback if unresolved. Its release closures remove internal listeners. It does not call an endpoint, notifier subscriber, comparer, framework setter, or application observer at the injected return point.
3. Native requirement proof getters at lifecycle.ts:124–127 are source-owned combineProofs/nativeProof closures. Real ready requirements, frames and operation views here are kernel records, not publicly supplied arbitrary accessors. Readiness callback updates internal counts/proof and queues wakeChannel; it does not synchronously invoke an application author between replace returning and the following payload fold.
4. Following completedFields.set / initialized.add operations are on kernel-created collections. The monkeypatch adds a new author callback between existing internal operations. Neither the package API nor the private helper's actual caller contract supplies this callback slot.

**Disposition:** a limited stronger-boundary/model counterexample, not a supported user callback regression or justification for a broader completed-payload redesign. Retain test/source/raw failure. My earlier design requirement for reentry did not authorize arbitrary mutation injection into each internal step; real endpoint/completion callbacks and non-consuming recursive inspection remain meaningful controls. Their positive results must not be used to relabel this mutant as passing.

## Getter qualification: reduction is not universally callback-free

Do not generalize the preceding conclusion to every operation in ready. applyAtRelativePath uses recursive property reads/object spread (internals/source-mutation.ts:60–68), and maskPayload spreads objects (private.ts:86). JavaScript can execute getters there if such descriptors actually reach those containers.

For the reviewed native plain-branch path, ancestor payload containers are normalized data-property snapshots: utils.ts:366 onward builds a new result and assigns child values; ordinaryMemberSnapshot (internals/plain-branch-membership.ts:87–110) defines data properties recursively for recorded branch topology. Atomic leaf objects may contain arbitrary behavior but remain terminal; recorded branch paths do not descend into their object internals. Modifying the returned branch snapshot to install getters would violate the existing read-only snapshot contract (snapshot-aliasing.spec.ts:5–22). No such mutation is used by the reviewed witness.

Ordering matters even under an additional accessor premise: the applyAtRelativePath RHS at private.ts:298 is evaluated BEFORE assigning valuePayload, so a genuinely supported getter there could provide a distinct stale-clone witness. maskPayload at :318 is evaluated AFTER that unit's payload advance, while constructing the outgoing selection. These are different phases and cannot be substituted for the monkeypatched replace boundary. I found no supported accessor-bearing ancestor on the inspected normalized scalar path; I do not claim a global proof covering every possible foreign/custom marker or entity payload.

Added real-input phase probes (no runtime monkeypatch): initial branch getter and inbound nested branch getter normalize to data descriptors; later scalar reduction delivers the exact expected snapshot with no getter stack inside ready. Both pass on C17 and candidate. An inbound getter DOES run again through knownY/deepEqual in sendEligible after reduction/adoption; getter-later-stacks.json records deep-equal.ts:258/260 -> link.ts:866. Thus a real later getter boundary exists, but it is not the injected pre-payload replacement point.

The first scratch getter probe incorrectly expected no later getter call at all; it failed (3 versus 2 reads). GETTER-FIRST.spec.ts and candidate-getter-boundary raw failure are retained. The corrected probe asserts the actual phase, positive accessor invocation, normalized data descriptors, exact delivered value and absence of ready on the captured getter stacks. This is correction of our diagnostic premise, not an original product oracle change.

## Independent execution and evidence

Pinned Node24.15.0 / pnpm10.17.0; own manifest copies with existing isolated copied-dependency symlink. All tests ran through Nx, sequentially, cache skipped, one worker. No comma-separated filter was used. Each run directory stores exact COMMAND.json, first.log and RESULT.json.

| Own run | Result | Meaning |
|---|---|---|
| predecessor-core: value-work-handoff + scalar-frame-publication | 34 pass /5 fail, 39 executed | Original equal-sibling plus protocol/inspection probes and injected author failure preserved |
| candidate-core: same two files | 38 pass /1 fail, 39 executed | All26 original scalar frames and12/13 new controls pass; injected author failure remains |
| candidate-independent-safety: own controls + scalar-native-support + parent-proof-safety-falsifier + publication-evidence-scope-controls | 18/18, four files | Real existing Link observation callback reentry blocks old ticket until current q settles; cross-recipient/disposed ack isolation; held settled resolves and publication diagnostics return to baseline; unchanged scalar safety controls |
| candidate-getter-boundary | 1 pass /1 fail | Preserved overstrong diagnostic no-repeat-getter expectation |
| candidate-getter-phase / predecessor-getter-phase | 2/2 each | Same phase assertions on both trees |
| candidate-getter-stack-artifact | 2/2 | Same candidate assertions with stack persisted to own file |
| candidate-spec-types and candidate-spec-types-final | exit0 | Scratch controls typed; existing baseline unchanged, three existing improvements |

Main generating commands, with this directory as script cwd:

```
python3 prepare.py > prepare.log
python3 run.py predecessor-core predecessor corepack pnpm nx test kernel value-work-handoff scalar-frame-publication --skip-nx-cache --maxWorkers=1
python3 run.py candidate-core candidate corepack pnpm nx test kernel value-work-handoff scalar-frame-publication --skip-nx-cache --maxWorkers=1
python3 run.py candidate-independent-safety candidate corepack pnpm nx test kernel independent-value-work-controls scalar-native-support parent-proof-safety-falsifier publication-evidence-scope-controls --skip-nx-cache --maxWorkers=1
python3 run.py candidate-getter-stack-artifact candidate corepack pnpm nx test kernel independent-value-work-getter --skip-nx-cache --maxWorkers=1
python3 run.py candidate-spec-types-final candidate /Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node tools/check-spec-types.mjs
python3 final-audit.py > final-audit.log
```

Author's finalized matching85-case runs were inspected, not independently repeated wholesale: candidate77/85 versus C17 73/85. Seven unchanged failures concern the retained-collection equal-whole assertion and six enrollment-invariance expectations. They remain outside this correction; no revised oracle is accepted here. Author source/spec types exit0 inspected. Comment-only emitted equivalence was independently run. Author candidate-bounded-final/native-controls comma-filter commands found NO tests; those runs supply no runtime evidence and no product-failure evidence. Their errors, initial missing delivery initializer, initial fixture mistakes, and all final logs are archived under author-evidence, not overwritten.

Existing archived tsconfig-paths warnings remain in raw Nx logs; tests actually executed. Supplemental tests use the existing internal Link observation subscription seam, not a newly claimed root package export. No public surface changed.

No independent full85 replay, broad suite, source typecheck rerun, GC/performance or final combined-candidate validation. Existing source typecheck is author evidence; own final spec gate includes added diagnostics. Recommend composing the frozen handoff delta with this bounded boundary disposition, then Main's combined replay. Preserve the injected failure explicitly as a limited model finding; do not silently delete it, weaken its success assertions, or claim all85 tests passed.
