# Frozen R3 selected-route fixture counterparts

**Test-only correction ready for independent review. First affected-four Nx run: 236 passed in4files. First unchanged spec-types gate: pass.** No runtime failure exposed by the corrected refusal seam; no repairs/retries/expectation weakening. Not composed into root, suite-overlay or author runtime candidate.

## Exact source and scope

Base is frozen `/private/tmp/st-c28-r3-comparator/candidate`, full manifest e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3, NOT the later suite correction. Own `candidate` copies all3095 manifested files/modes; all runtime/non-overlay hashes match base before/after both checks. Exactly four mapped test files differ. Originals are byte-preserved under originals/ and mapped in MAPPING.json. Copied original full-run first-failure inventory and its original hash record are also under originals/; this is preservation of prior evidence, not an additional original replay.

Only identified selected-route cases changed:

- restoration/restoration.spec.ts: first two applyAtomically success spies become transparent default vi spies on prepareSelectedUnit, restored in finally. Exact thrown callback message, restored left/right state, no recorded turn and preservation of unrelated confirmed b.y20 remain. Preparation call once plus exact restored public values establishes the selected path actually installed compensation. Every later fallback applyAtomically/validateEffects fixture remains byte-identical (tail equality independently checked).
- transaction-observer-failure.spec.ts: five known secondary refusal injections move from validateEffects replacement to real prepareSelectedUnit one-shot throw BEFORE calling the original. Typed receiver/argument forwarding is retained if an additional call occurs; assertions require exactly one call and zero returned plans before recovery. Existing callback recovery/Link settlement, distinct group-close callbackFailed=false, capture-release metadata, exact report payload and refusal-over-console precedence assertions/actions remain unchanged.
- opaque-leaf-restoration-v16-controls.spec.ts: one shared refusal fixture (three enhancer orders) uses mockImplementationOnce pre-install Error. Assert one call and exact thrown sentinel in spy results before restoration: no installable plan returned. Existing callbackFailed=true/callbackError=undefined, bounds/count whole-terminal inspection, retained bounds, recovery.rollback and exact restored bounds/count assertions remain.
- transaction-lifecycle-view.spec.ts: one refusal control now explicitly names injected pre-install failure. Marker structural-drift remains in the thrown Error only to preserve the original message assertion; it does NOT claim authentic structural drift. Reached-once/zero-plan and retained x1 assertions added; existing effect-validation-failed/pendingRetained/consequencesReleased flags, pending snapshot, confirm and empty list remain.

Seven refusal source locations produce nine cases (five observer, three opaque-order cases, one lifecycle), plus two success observers. No unrelated fallback rewrite, source-admission bypass, public-method replacement or fabricated lifecycle event. Generic pre-install preparation failure is the stage exercised. None of these is a post-install completion failure or new structural-drift policy oracle.

## No-installation witness and cleanup

Refusal happens before the real preparer is invoked, rather than after installation. Reached counters plus zero returned-plan counters (or exact throw result for opaque) prove that this compensation attempt produced no installable unit. Original public retained-state/recovery assertions then verify authority and useful outcome. This does not claim the transaction's initial writes never installed. Original methods are restored before real retry/confirmation and in existing finally paths. Success spies delegate exact arguments/receiver/result through vi.spyOn default implementation.

## Commands/results

Pinned Node v24.15.0 / pnpm10.17.0, root dependency symlink, run-owned Nx cache/data/TMPDIR. From own candidate:

```sh
corepack pnpm nx test kernel src/enhancers/restoration/restoration.spec.ts src/lib/transaction-observer-failure.spec.ts src/lib/opaque-leaf-restoration-v16-controls.spec.ts src/enhancers/transactions/transaction-lifecycle-view.spec.ts --skip-nx-cache --maxWorkers=1
node tools/check-spec-types.mjs
```

runs/affected-four-first:4files/236tests pass, exit0, timeoutfalse. runs/spec-types-first: exit0, timeoutfalse. Exact argv/environment/process/hashes in COMMAND/PROCESS/RESULT.json, raw outputs in first.log. Three existing spec-baseline improvements reported; no --update or allowlist change. Archived tsconfig warnings retained unsuppressed. No new type failure or test failure; no second invocation. No broad suite, performance, source-type or release claim.

Full-suite unrelated external ABA/structural/selected-authorship failures are outside this change and remain open. All source assertions and first failures remain reviewable; this packet requests independent review before composition, not self-approval.
