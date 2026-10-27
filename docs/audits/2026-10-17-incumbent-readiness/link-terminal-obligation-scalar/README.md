# Terminal-obligation correction: scoped acceptance

[Premise review](evidence/PREMISE-REVIEW.md),
[implementation review](evidence/independent/IMPLEMENTATION-REVIEW.md),
[exact source](evidence/FINAL-SOURCE.json), and
[full execution record](evidence/RESULT.md).

Base: `440ead9f1b4d45c63f7ec8cbf50fc15944f101b2`.
Final isolated candidate: `0135ef18567573fec627667fc58bc3e7819cc29e`.
Branch: `codex/link-terminal-obligation-scalar`.
Checkout: `/private/tmp/link-terminal-obligation-scalar`.

Accept the correction only within the tested scalar terminal-input scope.
Independent premise and implementation reviews found no remaining blocker for
this mechanism. Entity integration remains gated by the owner's current request.
Production87f6831f, conservative default, APIs, ceilings and B closure are unchanged.
No integration, release or whole-system qualification is claimed.

## Mechanism and timing

Historical proof retains owner identity and terminal outcome. A new native input
capture now stores a frozen list of outstanding actual owner identities, excluding
only owners already confirmed BEFORE the updater receives its input. This input
record also retains the original source requirement for uncertainty, possible-owner
windows and unfinished validation. Active enclosing validation is unchanged.

This separates retained history from an outstanding obligation without rewriting
source proofs, receipts or rollback authority. Confirmation inside an updater or
preparer cannot retroactively make an omitted pending input independent. Its
truthful dependent counterpart can still progress after confirmation. Rejection,
abandonment and disappearance are not treated as successful confirmation.

The source boundary is shared by leaf and branch native inputs, including negative
membership. nativeProof and installation-window normalization use the same frozen
actual-input identities. Horizon finalization releases input references as before;
no new registry, canonical state, collection scan or second settlement engine.
This source inspection is not a measured heap/CPU/bundle claim.

## Results and preserved failures

| Evidence | Result | Scope |
| --- | --- | --- |
|001 unchanged baseline |4 pass,5 fail out of9 |Original confirmed-input2, new terminal7; one new oracle defect separately corrected |
|002 first implementation |30 pass |Original14, role2, preparation4, validation1, confirmed2, initial terminal7 |
|003 extended terminal |11 pass |Adds optional-preparer, historical-V and invalid-source controls |
|004 combined scalar |225 pass,2 fail out of227 |Same two historical oracle conflicts; no new failure |
|Independent native controls |2 pass |Further input hop after recipient disposal; late source-horizon validation failure |
|008 four frameworks |8 pass,4 filtered entity skips |Two scalar cases each for Angular,React,Vue,Solid |
|011 registration |2 pass,4 filtered entity skips |Existing scalar registration/reentry controls |
|014 final terminal specs |13 pass |Final terminal11 plus independent2; not additional unique cases |
|009 final spec-types |Ratchet passes |No baseline update; not zero historical diagnostics |
|006 source types |11 existing TS4111 diagnostics |Byte-identical diagnostic log to preserved predecessor |
|012/013 lint |9 errors,27 warnings on both |Normalized diagnostic messages match; no new remaining lint diagnostic |

002/003/014 overlap004; do not sum repeated runs as distinct controls. The two
literal004 failures remain aggregate-installed-publication's wider-input fallback
expectation and aggregate-native-input-independent's prior no-contradiction
expectation. Their existing contract adjudications remain recorded with original
assertions. They are not counted as passes and are not new terminal regressions.

001 preserved a newly authored invalid-declaration oracle expecting send while an
installation-time possible owner q remained open. Premise review corrected only
that NEW row to hold, confirm q, then send. The valid dependent row still requires
send with q pending. All inherited assertions, including the two original
confirmed-input failures, are unchanged. Original test/log and the review are
archived, not replaced.

005 spec-types found the new fixture's Object.hasOwn unsupported by the configured
lib target. Equivalent hasOwnProperty.call preserves the own-membership assertion.
010 lint found five empty callbacks in the new fixtures; explanatory comments
clarify intentionally unused intermediate endpoints/completion callbacks. Original
logs remain. Runtime source never changed after the first implementation.
Final source and predecessor lint both retain9 errors/27 warnings in existing
runtime code; no lint rule was disabled. The source type log matches the prior
checkpoint exactly. These gates remain non-green for broader acceptance.

Framework runners emitted an archived-tsconfig resolution warning referring to
/private/tmp/st-unknown-access-candidate; their actual selected scalar tests ran
and each Nx command exited0. This is preserved as infrastructure noise, not a
runtime assertion failure or an excuse to count filtered entity cases as tested.

## Independent review and root verification

Premise review chose capture-time projection over live admission-time filtering:
a live filter could let updater/preparer confirmation erase a previously consumed
pending input. The private NativeInput pair preserves that temporal distinction
without freezing incomplete validation evidence.

Implementation review verifies source seams and both additional executable tests.
Root inspected its raw logs, tests, source mapping, and before/after hashes; all
runtime hashes match002.015-differential-verification.json independently reconciles
types and lint against the preserved predecessor. Reviewer test no-op comments
were added afterward for lint; executable statements/assertions remain unchanged
and final014 runs the exact final tests.

The earlier physical/ordinary cached-certificate concern remains source-only and
unresolved; this correction neither proves nor repairs it. Entity source coverage,
mixed undo, complete lifecycle/collectibility, broader suites, installed artifacts
and measured costs remain outside this acceptance. No policy concession or further
public API change was needed to close the confirmed-input counterexamples.

## Replay

Node24.15.0; pinned pnpm10.17.0. The wrapper in PATH delegates to Corepack so Nx
child commands do not select system pnpm11. Run in the frozen candidate checkout:

```sh
PATH=/private/tmp/link-membership-pinned-bin:$PATH COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm nx test kernel --skip-nx-cache -- src/lib/publication-confirmed-input-independent.spec.ts src/lib/publication-terminal-obligation.spec.ts src/lib/publication-terminal-horizon-independent.spec.ts
sh /private/tmp/link-terminal-obligation-evidence/run-combined.sh
PATH=/private/tmp/link-membership-pinned-bin:$PATH COREPACK_ENABLE_NETWORK=0 node tools/check-spec-types.mjs
```

The preserved run-combined.sh and full logs contain the complete227-case command.
Framework008 logs record source filter and scalar test-name selection. All source
and evidence files are hashed in the archive; prior rejected checkpoints remain.
