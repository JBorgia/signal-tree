# Independent review: executable declaration rules

Scope: specification-level scalar model, not SignalTree integration or API approval.
Reviewed base declared-contract SPEC at 9b5aa72f and current commit-consequence.ts.

Frozen premises: the draft requires “Early publication waits until the bounded synchronous operation and its synchronous nested/reentrant work unwind.” It also states “A declaration describes PUBLICATION dependencies, not which transaction captures, compensates, confirms or rejects an ordinary write.” Owner approved complete declarations with application responsibility for hidden omissions. Current source releases ordinary held consequences after either outcome, separately from scope-owned consequences dropped on discard.

## First failure, independently reproduced

Original model hash 9981cf0b97acf85ab99adfa922c36bdd2045e410f4bb94a814ec060b7d361155 restored its ambient frame before inspecting the callback result's `then` property. A getter reentered a nested empty declaration, installed 7, and sent 7 while outer owner p remained pending. Events were installation, nested empty validation, send, outer validation. The required result was no send. This is not an application-hidden-input omission: p was explicitly known to the outer operation, then lost during runtime-invoked synchronous validation. The root independently found the same failure with value 9. Preserve both raw witnesses.

The original 18 scenarios replayed successfully, including an intentionally leaking hidden-omission negative witness. Their success did not cover the getter boundary.

## Correction verification

Corrected model hash 111b3d1f2b1999b0345038024565f2055fc98094092702cd619d96444b034fbc retains the ambient frame through return-shape inspection and restores it in finally. Independently replayed the scenario suite and unchanged getter falsifier. Getter result: no send; nested/outer validation reject; installed value remains; p remains pending. This corrects a violation of the prewritten validation horizon rather than changing policy.

An independent additional probe used an empty declaration, installed 7, observed p, then threw a frozen sentinel. It rethrew that exact sentinel, retained value 7, and held publication. Thus callback error precedence survives simultaneous observed contradiction in this model.

## Narrow interpretation

- Invalid identity/form is rejected before callback. Observed contradiction discovered after installation preserves ordinary installed writes conservatively and reports declaration failure. This does not assign rollback ownership.
- Rejection does not turn the old declaration into confirmation. Fallback freshly evaluates the current supplied projection behind a conservative drain; a numerically unchanged ordinary surviving value can consequently publish. A restored current value replaces the old captured payload. This fits current ordinary-consequence semantics.
- Authentic foreign owners work in the same model registry. Invalid foreign-registry tokens differ from cross-tree owners; documentation should not conflate them.
- Returned async work invalidates early certification; continuation is unscoped. New explicit declaration is separate. Suspension does not preserve ambient authority. The model does not cancel JavaScript work.
- Hidden saved inputs can leak under a false empty declaration. This is the approved application-responsibility boundary, not a passing safety claim. Runtime-observed contradictions can be checked; declaration completeness cannot be proven.

## Limits preventing production acceptance

The native coherent, noninspection projection and authentic terminal outcomes are supplied inputs. There is no proof that production can provide that seam under inspection, rollback error, framework scheduling or destruction. The all-owner fallback deliberately scans the entire model; it is conservative and does not qualify indexing or reclamation. One destination cannot prove multi-destination operation invalidation. This is not replay of the existing asynchronous delivery model and establishes no new endpoint retry, in-flight serialization or teardown result. Tree destruction is not modeled; connection disposal alone is tested. No public API syntax, wrapper error shape, async type restriction, package integration or performance approval follows.

Disposition: executable specification survives its bounded corrected tests; keep the first implementation failure. Suitable input to a separately reviewed implementation/API design, not production Link acceptance. Production hold stays unchanged.

Replay: `node /private/tmp/link-declaration-examples/examples.mjs` and `node /private/tmp/link-declaration-examples/then-getter-falsifier.mjs`. Independent outputs are /private/tmp/link-declaration-examples-independent-replay.json, /private/tmp/link-declaration-examples-independent-final.json and /private/tmp/link-declaration-examples-then-getter.json.
