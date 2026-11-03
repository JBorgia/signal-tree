# Branch egress trace — Main handoff only

No runtime repair. `candidate/` is the unchanged oracle-alignment source; `instrumented/` differs only by passive console logging in four runtime files. Both exact preregistered test bodies are byte-identical in both copies. No publication methods, source writes, proof mutations, epoch changes, or extra live branch reads were added by instrumentation. Logs serialize already-computed plain fixture values and stored state; this is bounded diagnostic evidence, not a performance/timing qualification.

## Reproduction and evidence

Uninstrumented run in candidate: **2 failures / 42 skipped**, exit1. Same two assertion sites as previously recorded. `uninstrumented-first.log` is the actual new-copy first run.

Final instrumented run: **same 2 failures / 42 skipped**, exit1. `instrumented-proof.log` contains raw source/membership/scalar/projected events and unchanged test failures. `events.json` provides parsed events with original log line numbers. `logging-only.patch`, `BASELINE.json`, `IDENTITIES.json` pin source, instrumentation, unchanged tests and logs.

Command, cwd candidate or instrumented respectively:

    NX_DAEMON=false NX_ISOLATE_PLUGINS=false /Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/corepack pnpm nx test kernel --testFile=oracle-alignment-independent.spec.ts branch-omission-correctness.spec.ts --testNamePattern='branch supplied-name adoption|same-turn removal and reintroduction ends absent' --maxWorkers=1 --skip-nx-cache

First diagnostic startup failed to resolve dependency metadata/plugin before tests (`instrumented-trace-first.log`); the unchanged dependency symlink resolved on retry. Preserved, not counted as runtime failure. Two extra uninstrumented invocations caused by wrong cwd are accurately retained as `initial-old-cwd-uninstrumented-replay.log` and `extra-uninstrumented-replay.log`; neither is claimed as instrumented. `instrumented-trace-retry.log`, `instrumented-boundary.log`, `instrumented-final.log` preserve incremental observation passes. No failed assertion was edited.

## Failure 1: rejected branch adoption leaks Inspected

Native chronology in the trace:

1. Scalar forward unit revision7 carries ordinary Ada→Inspected, then age omission revision8 carries ordinary present42→absent. Source values/presence are correct. Reducer emits the pending projection `{name:'Inspected'}` while owner remains pending; endpoint hold succeeds.
2. Rollback `slot.frame.prepare` stages slot0→Ada with a changed scalar slot; age slot1→42 is already physically equal. The physical-restoration assertion passes.
3. Age source membership correctly stages absent→present42 (revision9). **No scalar `prepareScalar` restore unit for Ada exists in this trace.** The direct scalar realization frame changes storage outside the per-location mutation/publication preparer. The first coverage gap is here, before any endpoint decision.
4. A realized rollback notification carries name Ada. Link applies it locally, but `legacy.project` sees pending=1 (membership revision9) and returns without installing that value into native projection state. The queued notification has not repaired `b.valuePayload`, which remains `{name:'Inspected',age:42}`.
5. Membership revision9 completes and changes only age. Its ordinary after value42 is correct; it cannot restore name. It projects the stale Inspected aggregate and `link.refresh` replaces locally corrected `{name:'Ada'}` with that stale payload. The forbidden-value assertion fails after rollback.

Earliest wrong retained projection after physical restoration: native `b.valuePayload` still carries forward Inspected because scalar realization supplied no corresponding prepared publication update. The later membership completion makes that stale field externally selected.

Proof observation: at revision9 the combined effective proof logs unknown=true, invalid=false, terminalRejectedRoles=0, owner outcome rolled-back. This is not evidence that rejection was confirmed. The allowed fresh surviving evaluation is selecting the wrong retained payload. Merely holding all rolled-back owners forever would violate the separately approved wake contract and conceal the missing restore unit.

Relevant uninstrumented source: `internals/tree-scalar-slot-runtime.ts:191-216` installs staged scalar values/shadow plans; `internals/tree-scalar-leaf-runtime.ts:91-117` commits/publishes the frame without per-location intrinsic mutation preparation. `experimental-publication/private.ts:254-276` is the normal scalar publication-unit path; `private.ts:207-225` installs membership and its own supplied subtree only; `private.ts:407-427` refuses legacy projection while pending. `link.ts:822-825` applies notification payload before asking legacy projection; `link.ts:1035-1041` later consumes the native receipt.

## Failure 2: same-turn omit/re-add/omit retains age8

Source chronology is correct all the way through native reduction:

- revision8: age ordinary present42→absent; projected `{name:'Ada'}`.
- revision10: age scalar42→8 while member absent; masked projection still omits age.
- revision11: age ordinary absent→present8; projected age8.
- revision13: age ordinary present8→absent; completedPresence=false and projected `{name:'Ada'}`. `link.refresh` consumes that correct final projection.

**The first wrong selection is later:** queued scalar notification for the earlier 42→8 write reaches `link.ts:822`. It patches age8 into eligible despite the already completed later omission. `research.project` now sees pending=0/current13, replaces native current revision with a fallback unknown-support projection of `{name:'Ada',age:8}`, and stores that supplied payload directly. The remaining membership notifications only mark dirty; they do not reconstruct the superseded revision13 mask. Endpoint ends with age8.

Thus this failure is NOT incorrect source ordinary presence, incorrect final membership packet, or failure of maskPayload in ready. Those all show the correct final absence. The delayed notification becomes a second publication authority and defeats installed-unit chronology. See `link.ts:639-642,822-825`, `experimental-publication/private.ts:407-427`; the latter assigns payload directly rather than selecting completed ordinary membership.

## Supported shared correction boundary (not implemented)

Both expose incomplete separation between installed source publication and notification fallback. The required invariant is one coherent selected ordinary value/proof/presence chronology for enrolled plain-branch scalar descendants, including inverse realization.

Two obligations are needed together:

1. Scalar frame/point realization must prepare/install the selected restored scalar publication facts coherently with membership realization, before completion/delivery, using the authenticated inverse's ordinary endpoints. It must not reconstruct native authority from late notification metadata or a fresh physical aggregate read. Preserve atomic preparation/refusal and framework observation ordering. This addresses the missing Ada restore coverage, not collection array shape.
2. For sources covered by those native units, late scalar notifications must not republish an older value as a new projection or overwrite completed membership chronology. Keep notification as observation/wake where appropriate; fallback must remain explicit only for genuinely unmigrated source paths. Suppressing fallback alone would leave Failure1's native stale payload unchanged. Blanket reseeding from physical state would violate inspection isolation.

No one-line repair is qualified by this trace. Retain both exact failing controls, age42 inspection-only omission isolation, identity-derive no-op, adoption rollback, same-turn presence ABA, foreign-owner wake, and existing source-preparation fault/refusal controls when evaluating a successor.

Neither fixture contains an EntityMap; the collection branch of ready is not exercised. Helmholtz's natural-array overwrite work is separate evidence. These failures share a scalar/membership vs notification authority boundary with each other, but no conclusion about sharing the collection bug's cause or repair follows.

Only Main receives this file handoff. No worker messaging, runtime repair, test weakening, full qualification, or acceptance claim.
