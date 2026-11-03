# Preparation reader — independent implementation and interpretation review

**No runtime blocker demonstrated for this bounded replacement.** Reviewed candidate manifest `812a3ad5d6843e95a791aaf001927d54f67738626360a50afb9f7871fdfcd302` against retained composition `8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333`. Independently hashed all 3,127 manifest-listed candidate files: zero mismatches, exactly five changed/added paths (see IDENTITY-CHECK.json). Read review/contributor/support contracts, runtime diff, frozen specs, raw observations, logs and first-failure records. Root HEAD `628d302dadb082a48c58528651c9088234d0a777` and unrelated dirty work were inspected and untouched. This is not release verification or activation authority.

## Implementation obligations

At `packages/kernel/src/lib/entity-signal.ts:5415`, the closure remains collection-owned. The symbol module adds neither public barrel exports nor another state authority. It does not enumerate payloads, cache values, create field facades, or add a publication-input scope. The lookup sequence matches the relevant facade path: visibility/active-key check (including ids dependency on failure), initial subject epoch/backing read, subject resolution and lifetime acquisition, shared collection-owner initialization, activation read, handle resolution, then current-key epoch/backing read. A missing initial row throws; disappearance after acquisition returns undefined. Rekey follows the acquired lifetime rather than a replacement at the requested key. The ordinary error strings and handle check are retained.

The reader uses the existing `rowAbsent` physical-window rules, not a raw backing-store bypass: registry identity and tap depth still control visibility. The lazy owner call is important and present before activation. Cold fields do not own distinct PositionIds; their later bindings use the collection owner and subject. Removing their earlier construction does not remove the collection publication authority. The held public node still retains its activation carrier; the transient reader adds no held-node API. Source tracing plus the native comparison supports the dependency sequence for these calls, not a universal dependency-graph or GC theorem. Initial backing and activation reentry are explicitly exercised, including rekey, retirement and key reuse.

At `internals/causal-runtime/tree-realization-adapter.ts:2315`, present capability errors propagate and present undefined does not fall back. Only an absent capability uses the existing receiver-preserving callable-or-value fallback. A genuinely capability-absent double tests that branch; overriding a method on a real symbol-bearing collection is no longer an appropriate interception oracle.

I mechanically removed only the new import and two dispatch lines and obtained byte-identical adapter source to the base. Consequently the four caller boundaries remain exact:

| Caller | Preserved ownership |
| --- | --- |
| Point preparation, line 1017 | Deep clone before preparing row edits |
| Joint preparation, line 1275 | Deep clone before preparing row edits |
| Placement/rekey context, line 2417 | Deep clone when creating the prepared subject payload |
| Removal context, line 2464 | Live reference, no added clone; existing prepared payload takes precedence |

The P/R fixtures reach actual backing getters through those retained clone operations. P tests refusal before row installation and successful fresh preparation. R correctly distinguishes the first validation return from later stale-admission refusal. The removal comparison checks identity and prepared-clone preference. These private adapter fixtures are not public-route proofs.

## Interpretation and calibrations

Raw `runs/comparison-capture/observations.jsonl` and `runs/candidate-first/observations.jsonl` support the bounded cold-row conclusion: c/d start cold; baseline undo/redo and rollback materialize row/id/n facades; candidate leaves them cold. Inspection has four changes and leaves facades cold in both. Useful restored values, subject identities, publication arrays and subsequent field Link `[10,8]` agree. The separate lazy-owner case observes allocation before inventory; inventory itself can initialize ownership and cannot independently prove that initialization timing. The byId call counts include the later field exercise and are not allocation totals.

The retained first failures do not demonstrate a new reader defect:

- Cold rollback originally expected no emission. The pending assertion remains empty; phase receipts distinguish initial-settled=[], pending=[], then one restored-original rollback emission. The corrected expectation preserves the no-pending-leak obligation.
- Native undo initially restored empty physical state, not correct physical state with a stale observer. Kernel README:212 defines the synchronous authored turn and settlement boundary. Explicit notifier flushes separate prelude from the removal turn; the final test requires a new populated history entry, exact restored physical rows and redo availability before accepting observed equality. This calibration follows documented semantics. It does not settle every possible public scheduling route.
- Missing-backing retirement initially violated the private hook's tombstone precondition. The retained-tombstone fixture reaches the intended absence discriminator.
- No-enhancer diagnostic field metadata was the wrong owner oracle; the entity location binding is the relevant binding and is checked.
- R's initial throwing expectation contradicted unchanged `internals/utilities/deep-clone.ts`: structuredClone exceptions are caught and manual fallback preserves accessor descriptors. The revised stale-admission/fresh-recovery oracle tests useful behavior. It does not claim every getter exception propagates from the first validation.

The cold spec hash agrees across baseline capture and candidate. The final comparison spec hash agrees across baseline reference and candidate and with FROZEN-ORACLES.json. Candidate-only dispatch assertions were explicitly skipped on baseline, not counted as baseline successes. Historical spy/C failures remain separate evidence and are not retroactively converted into successful public-route proofs.

## Checks and remaining boundaries

**Run by this reviewer:** manifest/file hash verification; five-path scope check; adapter byte comparison; frozen-spec snapshot comparisons; direct raw observation and first-failure/log inspection. No runtime replay or source edit was needed. Raw candidate-first records confirm 11/11 tests, no skips, exit0; candidate-types confirms spec-type gate exit0 with unrelated improvements not ratcheted. These are verified recorded worker runs, not independent reruns. Main subsequently reported source typecheck passing and focused existing kernel/framework tests running; those results are not independently incorporated here.

**Composition caveat:** `cold-row-responsibility.spec.ts:17` and `preparation-reader-comparison.spec.ts:26` require receipt-output environment variables and throw without them. They are valid packet diagnostics under run.py, but should not be copied unchanged into an ordinary test suite without output handling/runner wiring. Cheapest falsifier: run either diagnostic through Nx without its ST_* output variable; not run because the unconditional source branch establishes the limitation. This is not a reader runtime blocker or a reason for a broad campaign. The displaced projection-seed comment is nonsemantic and does not change this verdict.

Not run: broad suites, framework campaign, build/package/declaration checks, production artifact or budget measurements, GC/performance/OOM experiments. Those claims are not inferred from these tests. The evidence supports proceeding with the bounded reader implementation subject to normal composition checks; it establishes no speed, allocation, memory, size or budget success.
