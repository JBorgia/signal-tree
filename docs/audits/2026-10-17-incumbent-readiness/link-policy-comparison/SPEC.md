# Configurable Link publication comparison — review candidate

Baseline ffc50d3be5b19bd76c1cd4c20bc7d8144972b73b; production safe hold unchanged.
Owner retains automatic independent progress as unresolved, not a promise to infer
arbitrary asynchronous causality. Draft/outbox examples remain optional. No public
API syntax/export/implementation, B reopening, budgets or release work authorized.

## Fixed comparison, not a menu
A: dependency-aware automatic publication with conservative fallback.
B: identical engine plus explicit missing ownership at unobservable boundaries.
C: manual publication on selected connections, using the same eligibility checks.
Current tree-wide hold is control. No domains-only bypass, provisional publication,
generic unsafe flag, public SDK proposal or fourth candidate.

All arms use complete immutable payload revisions. Dependencies are publication
responsibility, not mutation/compensation ownership. No subscriber writes become
owned by a transaction merely because publication depends on it.

## Evidence the engine consumes (abstract/internal harness vocabulary)
Each proposed payload has a revision, finite owner set and unknown-input bit.
An empty known set means proven eligible inputs; unknown is not empty. Runtime
observed facts cannot be erased by a declaration. Current owner outcomes distinguish
pending, confirmed and rejected; unknown/destroyed ownership is held/cancelled per
lifetime, never promoted to confirmed by disappearance.

Automatic supported-observation hypothesis: delivery envelopes and portable tracked
reads can contribute known owners; callback argument delivery seeds the scope even
without a getter. Nested frames inherit parent facts and conservatively return child
facts, including throw paths. Old queued envelopes carry their original revision.
Native cached consumption, untracked closure variables and arbitrary deferred work
are unavailable to these hooks. Unscoped direct writes remain unknown absent a real
entry-boundary proof. No harness input() method may be counted as automatic production
independence simply because it starts a clean set.

Research must identify a REAL source for clean input evidence (e.g. an accepted
external inbound value under the current endpoint contract), or report automatic
progress unestablished. An application's declaration is not automatic evidence.
A narrow supported callback subset must explicitly forbid unobserved inputs and
show its bypass limitation; it cannot silently certify arbitrary callback code.

B supplies an explicit complete owner declaration for an unknown boundary. This is
an application assertion of all contributors, not a runtime discovery. Known
observed owner sets are a mandatory lower bound. A complete declaration missing any
observed owner contradicts evidence and is rejected before publication/authority
replacement; existing work stays intact. Non-complete declarations only add facts
and cannot clear unknown. A false complete assertion about hidden inputs is not
detectable; preserve a negative witness. Unknown/foreign owner tokens are invalid.
No declaration may reclassify a known pending or rejected owner as committed.

C captures a complete immutable snapshot only on explicit request. Automatic tree
updates alone do not publish. Explicit request is a scheduling decision, not proof
of eligibility. Known pending inputs still hold; unknown inputs require the same
complete declaration as B or remain held. Manual mode cannot silently authorize
speculation. No speculative transport is included.

## Lifecycle and ordering
A known independent later replacement supersedes only that connection's queued
revision. It does not repair earlier derived copies or retract started requests.
Confirmation permits its contribution; rejection cancels a snapshot depending on
it, not cleanses it. Multiple owners all must resolve eligible. Refusal keeps the
same responsibility. A subsequent eligible whole snapshot can usefully progress.
Reentrant admission rechecks revision/dependencies just before endpoint invocation.
Errors restore scopes; already-installed dependent writes retain labels. Throwing
endpoint has the existing report/retry policy; no silent discard or exactly-once.
In-flight bytes cannot be recalled. One connection serializes sends; different
connections may progress independently. Failure of one cannot classify another's
payload as clean. Destroy connection cancels queued local work, prevents new sends,
retains explicit in-flight uncertainty; destroy tree invalidates captured authority.
No GC/retention claim without measuring retained roots at drain/destruction.

## Prewritten discriminators and outcomes
1. Ordinary unrelated top-level write while p pending: require real proof for A;
   report held/unmet if unavailable. B can progress on explicit complete empty set;
   C only after explicit request+eligible evidence. Control holds.
2. Supported callback x→y and x→y→z: no pending payload escapes; known envelope
   arguments count even without getter. Confirm permits, reject prevents old send.
3. Two contributing owners: confirming one cannot release; refusing one leaves held.
4. Later independent overwrite: supersedes queued old revision and sends while p
   pending IF independence actually established; no value-equality shortcut.
5. Missing known owner, foreign owner or clean contradiction: rejected with existing
   revision/queue intact. Hidden-owner omission negative witness must leak or hold
   explicitly; never called proof of provenance safety.
6. Deferred unknown work: A holds; B/C complete declarations preserve all known
   lower-bound dependencies; rejection before callback/send never releases old input.
7. Full coherent object: no partial-safe-field send; collection/lifetime integration
   not inferred from scalar/record proof.
8. Nested callbacks/settlement and throws: preserve known dependencies in both
   directions. Keep prior independent-outer-constant failure as conservative progress
   limitation, not silently changed passing assertion.
9. In-flight old revision then replacement: old completion cannot erase queued new
   revision; endpoint eventually receives new whole snapshot. No remote recall claim.
10. Destroy queued versus started work; retry after failed endpoint; separate
    connection continues. Scope/authority changes during sending callback revalidated.

## Acceptance and limits
Review spec before implementing research policies. Prefer actual Link seam if a
bounded bridge can demonstrate these facts without weakening production safety or
inventing public API; otherwise report model-only limitations. No full suite or
cost campaign. Preserve first failures and prior tests. One finite implementation
per policy family, not repeated redesign until green. Independent final review
must assess missed boundaries, developer declaration burden, and exact authority.

Outcome is evidence whether Link could gain useful progress within an honest scope,
not a production acceptance or automatic approval to narrow the requirement.

## Reviewed refinement before implementation
Independent review: /private/tmp/link-policy-boundary-review.md. Use Link's actual
acquire(value, seq) authoritative external installation as the positive A entry,
not arbitrary clean callback frames. Two distinct connections on SAME tree/location
(incoming acquisition, outgoing publication) avoid echo-suppression vacuity. Keep
unrelated x pending and test y=42 then y=7 with x=7. Contractually authoritative
endpoint values are trusted exactly as today; delegated speculative computation
masquerading as an endpoint is a misuse witness, not automatically safe ingress.

An arbitrary callback receiving a clean value remains potentially unknown from
other inputs. Frames must account for BOTH delivered new and previous revisions.
No clean envelope can clear captured-local or cached pending inputs. Carry actual
input facts without broad suppression of ordinary mutation capture.

Use an esbuild source-loader/disposable-source research-private seam at BOTH Link
flush and send admission sites, retaining actual Link projection, queues, knownY,
settlement and disposal. No production file edit/public API. Engine tests may add
policy assertions but cannot stand in for actual Link send transcripts. No broader
integration or architecture competition. Preserve unsupported/unmet direct-write
cases instead of declaring the complete automatic requirement passed.
