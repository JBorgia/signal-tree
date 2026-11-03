# Executable declaration decisions and first falsifier

Source baseline 9b5aa72fee5fc9e7700a621ee04e42208b0d824d. Node 24.15.0.
Standalone scalar specification model, not actual kernel/Link or framework integration.
No production changes, new public API, budget changes or B work.

## Decisions represented

1. Rejection invalidates declared all-confirm early eligibility. Conservative release
   creates a NEW evaluation from the current coherent noninspection projection, not
   permission to send the old captured payload. Target restoration sends0 instead
   of old7; ordinary surviving7 may still send7 with a different evaluation basis.
   Known foreign pending obligations remain held. A new ordinary post-rejection write
   may declare independent truth under the approved rule.
2. Invalid declaration identity/form fails before callback execution. A contradiction
   discovered after installation denies early publication, retains the ordinary write
   conservatively and reports a declaration failure. An original callback-thrown value
   takes precedence, including primitive and frozen values. This does not assign
   rollback ownership or imply transactional installation. Model DeclarationError is
   explanatory internal notation, not a proposed public error class/export.
3. Synchronous validation includes nested/reentrant work and inspection of the return
   shape. Returning a Promise/thenable is misuse: installed prefix writes stay
   conservative. The original scope never reaches the continuation. JavaScript still
   runs that continuation; connection disposal prevents sends, not application writes.
   A fresh explicitly declared continuation is allowed under its own valid evidence.

## Results and preserved first failure

The first18 scenarios matched their expected results:17 positive controls plus one
intentional hidden-omission leak. The latter is a demonstrated application-risk
boundary, not a passing safety claim. All first source and output are retained.

An adversarial then-getter falsifier exposed a real implementation failure. Reading
`result.then` can invoke application code; the first model had already restored the
outer frame. A getter reentered an empty declaration and sent9 while the known outer
owner remained pending. Independent review reproduced the same mechanism. This is
NOT an unobservable input or application omission.

The first candidate was rejected and frozen as first-model.mjs. One bounded correction
keeps the frame through return-shape validation and restores it in finally. This
implements the existing synchronous validation-horizon rule; it does not add a new
eligibility heuristic or weaken any oracle. The unchanged then-getter falsifier now
sends nothing, retains installed9 and reports contradiction. Final original18 still
match. Three additional controls verify primitive/frozen error precedence under
contradiction and a throwing then getter. No further correction was made.

## Limits which prevent production acceptance

The harness is a single-destination model. It supplies owner identity/outcomes,
coherent installation and noninspection projection as explicit inputs. It does not
prove those seams are correctly obtainable from the native kernel, that publication
participates in real compensation/inspection, or that operation-wide multiple-field
validation works. `observe(owner)` is an explicit supplied lower-bound fact, not an
implemented automatic read tracker. The literal/copy distinction comes from the
application declaration; the false-empty saved-value witness leaks as expected.

Model conservative fallback scans every model owner and retains owner records. No
indexing, lifecycle reclamation, CPU or heap improvement is claimed. It is not the
rejected owner-window implementation restarted. Native entities, all four frameworks,
allocation failures, automatic-abort recovery and real in-flight transport remain
unqualified. Existing private delivery controls are preserved in prior records, not
rerun here or counted as model coverage. The model queue test is only a revision
preflight check, not an in-flight network qualification.

The contract's rejected-receipt behavior is now executable at the supplied projection
boundary. Production integration must demonstrate that boundary with ordinary writes,
restoration and inspection; it cannot substitute an unrestricted current-state read
or merely clear a dependency on rejection. API/error-surface selection remains open.

## Replay

With Node24.15.0:

    node examples.mjs
    node then-getter-falsifier.mjs
    node error-priority.mjs

To reproduce the first failure without overwriting current evidence, copy
first-model.mjs as model.mjs into a fresh directory with then-getter-falsifier.mjs,
then run the falsifier there. It exits1 and records speculative delivery. The fixed
falsifier exits0. first-results.json and final-results.json preserve all event traces.
No root bare Vitest or Nx test suite is involved: these are standalone executable
specification files, not package tests or release sign-off.

[Evidence archive](evidence.tar.gz), [checksum](SHA256SUMS),
[prewritten specification](SPEC.md) and [independent review](REVIEW.md).
Extract the archive into a fresh directory; run the replay commands inside
`link-declaration-examples`. All original assertions and the first failure remain.
