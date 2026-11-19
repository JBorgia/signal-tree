# Independent C19 positive-recipient counterpart review

**Accept the positive source/recipient interpretation and the additive test direction. Conditional promotion recommendation: close two bounded assertion gaps before claiming the twelve originals have fully evidenced replacements.** No runtime defect or newly reached terminal failure is demonstrated here. The original thirteen counterweights must remain live and unchanged. No test or runtime edit was performed by this reviewer.

## Exact reviewed input

Packet /private/tmp/st-c19-recipient-positive-counterparts; manifest `8ba966d5959cff736206db11dfacc4fe74d7f58aa508e5644061c43ca90bd775`; C19 baseline `b8eace4025ff735988dee88db512a2e9ceb5ac9e1302683d68d6900acea17576`; tests.patch `5df48b8788b33563148058083d1a114a1d2f2f6e4944063f982b35a5b92ba275`; added spec `f403ea1d3e618a90c13cf0a4d0b6f81fdb849680875e7a8bcccc5e540738124d`.

Verified all3066 candidate entries and unchanged equality of all3065 C19 entries; only recipient-positive-counterparts.spec.ts is added. Reconstructed that exact file from tests.patch. Both originals match frozen C19 byte-for-byte and remain executable. REPORT.md/MAPPING.md, original sources, original25 first failure, exact patch, and author commands/raw logs/results are copied alongside this review. Source review followed docs/review-contract.md and the approved enrollment/source-versus-recipient distinction in WINDOW-ADJUDICATION.md; no release policy reopened.

## Findings before promotion

### 1. No-declaration check observes retirement, not pre-send permission

Added spec lines45 and85 call hasDeclaration on a fact after normal life.started has executed. C19 lifecycle.ts:313–315 implements hasDeclaration solely by looking up the current operation. lifecycle.ts:332–336 deletes that operation during started. Therefore these expectations return false even if the operation had declared=true before the send. The mapping's assertion that this directly enforces absence of child declaration permission is stronger than the actual test evidence.

This does NOT invalidate the exactly-one output or surviving-basis assertions: those use recorded arguments and are meaningful. It also does not show the implementation grants permission incorrectly. It is a concrete blind spot in the claimed safety discriminator.

Cheapest correction: preserve the existing forwarding spy behavior but capture hasDeclaration(channel, revision) immediately BEFORE delegating to the original started function. Require exactly one captured secondary admission, false permission at that point, and the existing surviving basis. Do not mock the return or omit normal retirement. This is a test-only adjustment, not permission/API/runtime work. Falsifier not run (source-only review requested): a wrongly declared secondary operation retired normally would satisfy today's post-retirement false check; the proposed pre-retirement capture distinguishes it.

### 2. Final settled boundary lacks post-await duplicate/state assertions

Added spec lines51–55 and100–104 assert terminal state/output/start count, then lines56 and105 await the secondary settled promise and immediately enter teardown. Link.settled (link.ts:1207 onward) can wait for additional installed work, chain changes and notifier flushes. Thus the current tests establish exact counts after the fixed flush and settled resolution, but do not check that a duplicate or stale delivery did not appear DURING that final await. A late second delivery that settles would escape those count assertions.

Cheapest correction: after each final await, reassert exact primary/secondary arrays, secondary start count1, local state and foreign terminal value; retain the equal-repeat receipt no-write check there as well. It is also useful to assert unchanged pending-owner inspection/output after the pre-terminal await before invoking q/p's terminal action, so the claimed before-settlement checkpoint is explicit. No longer sleeps, permissive branches or new timing contract are needed.

This is an unexecuted test-coverage counterexample, not an observed late-send bug. The existing awaits are useful and nonvacuous: a permanently held secondary causes timeout, rather than a pass. They simply do not establish the entire advertised no-duplicate-through-settled interval yet.

## Obligation mapping and safety assessment

Eight omission controls (four kinds × confirm/rollback) preserve the original transaction/source setup. Their initial dependent write has real q support: both root and child must remain empty, with zero child starts. This strengthens the original first-phase check, which only asserted root hold. Later independent literal root omission selects current absence and no longer selects the removed contributor's q-dependent value. Exact root {other:1} and scalar/branch undefined or collection [] are checked; no stale row or branch wrapper is accepted. The surviving basis is required while q is still pending, its inspection unchanged, and foreign value remains7. Both legitimate terminal outcomes leave local absence and exactly-one output unchanged at the asserted checkpoint; rollback correctly changes only foreign z to0. The new tests do not infer that a root declaration directly grants the child declared permission.

Four pair controls (two operations × confirm/rollback) retain independent literal writes rather than manufacture dependent inputs. Equal-repeat explicitly supplies/asserts y:0; making y optional only in the shared TypeScript fixture does not weaken runtime shape. Membership omission asserts exact {x:1}, including absent y. Both recipients must receive one correct current payload while the unrelated foreign owner is still pending. The second equal declaration retains a no-write receipt before and after terminal transition. Exact state, arrays, surviving basis, start counts, unchanged pre-terminal owner inspection/value and terminal foreign value are positive assertions, not diagnostic recordings.

The approved source/recipient contract supports changing the twelve old interim [] expectations: unrelated ambient pending work must not become a recipient-only dependency for an otherwise complete current source selection. Missing a matching recipient declaration still prohibits declared early admission; ordinary surviving admission remains distinct. Actual source/input/possible-owner obligations must still hold. These counterparts do not excuse native uncertainty, reverse ingress, input consumption, readiness or failed preparation.

No existing useful source assertion is deleted by this additive packet. No skips/xfails, lint relaxations, public API changes or runtime policy edits. REPORT/MAPPING should qualify their stronger no-permission and settled claims until the two gaps above are closed.

## Exact permissible future archival scope

After the assertion fixes and bounded replay, recommend promoting the positive file and archiving ONLY these original parameterized bodies, preserving their exact bodies and first failures:

1. occurrence-successor.spec.ts: `first omission ${kind}: undeclared child waits then delivers after ${outcome}` — scalar, empty, collection, mixed × confirm, rollback =8.
2. recipient-window-review.spec.ts: `equal undeclared recipient proof does not discard held useful revision: ${outcome}` — confirm/rollback =2.
3. recipient-window-review.spec.ts: `membership omission retains recipient window through terminal ${outcome}` — confirm/rollback =2.

Do NOT archive either entire original file: the remaining13 are outside this replacement and must remain ordinary live assertions. Exact retained obligations:

- occurrence-successor: consumed-q support survives omission; independent replacement does not acquire q; exact slot cancellation/disposal; nonzero bounded finalization work across sibling counts; two reverse-ingress permission variants; hidden unresolved support/reappearance; fresh lifetime at reused key. Eight cases total.
- recipient-window-review: two equal-unknown/no-write/pending predecessor cases; two actual-native-input versus recipient-only uncertainty cases; finalizer-abort atomicity/no installation/no completion. Five cases total.

Do not exclude other unknown-window, recipient-source-permission, enrollment, native-support, teardown or readiness suites. Do not use the counterpart's positive sends to waive genuine pending input holds. Do not claim the old twelve assertions passed; their interim hold premise is superseded, while their useful final obligations are retained/strengthened here subject to the identified gaps.

This recommendation excludes full-suite acceptance, arbitrary omission/lifetime or terminal policies beyond these fixtures, GC/scaling claims, primary Link settled coverage (only the secondary is awaited), and production activation.

## Reviewed execution evidence and limits

Author logs/exit records show positive-first12/12, original-counterweights13 passed/12 name-filtered, spec-types exit0; sources unchanged. The original25 failures are separately preserved. The negative-lookahead filter excludes precisely the three named groups above; it is not a claim of25 green tests. The preload redirects only one hardcoded fs.appendFileSync diagnostic destination and forwards all other calls; it does not alter lifecycle modules/assertions or suppress failures. The positive controls rely on direct assertions, not that diagnostic. No novel terminal product failure appears in the supplied execution record, but execution cannot repair the two observation gaps.

Independent execution this turn: only `python3 /private/tmp/st-parent-freshness-implementation-independent/c19-recipient-positive-review/audit.py > /private/tmp/st-parent-freshness-implementation-independent/c19-recipient-positive-review/audit.log`, plus read-only source/log inspection. No tests, mutations, types, broad suite, root edits or external submission. Both proposed narrow test falsifiers are not run; they are derived from the exact observed assertion order and lifecycle/settled code. IDENTITY.json and EVIDENCE-SHA256.json preserve reviewed identities and raw evidence.
