# Prewritten precedence matrix

Exact predecessor manifest 4b48ad0640fa4b480c072f0f8c05a72898422a5c3067d90e7a9bc40ccb701e30. Written before source edit/tests. Execute identical private lifecycle seam cases on predecessor and successor. No public behavior change requested.

| Case | Expected synchronous outcome | Other obligations |
|---|---|---|
| normal callback | receipt | no-write status, stack empty, queued wake |
| callback throws object/string/undefined | exact thrown value (explicit caught flag) | stack empty, wake still runs |
| finish readiness observer throws object/undefined, no primary | exact observer error | all readiness observers run, stack empty, wake queued |
| finish observer throws, callback throws object/undefined | exact callback primary | observer error reported once |
| reporter throws during secondary finish reporting | callback primary | reporter failure swallowed, reporting guard reset |
| malformed input getter throws | validation-threw with exact cause | catch throw still executes finally |
| finish observer reenters declaration | nested receipt | active stack empty at observer; nested cleanup, outer receipt/error preserved |
| wake scheduling throws, success/primary/finish error | exact wake failure overrides pending outcome | stack popped before scheduling |
| queued wake callback reenters | nested receipt | cleanup completed before queued callback; finite reentry |

Actual finish observers use prepareNativeRequirement, installTerminalRecord, finalizeNativeRequirement, deliverNativeRequirementReady and onNativeRequirementReady. Wake scheduling error is bounded host queueMicrotask fault injection, not claimed ordinary product behavior; queued callbacks are drained manually and globals restored. Use flags to distinguish thrown undefined from success. No flattening of try/catch/finally, no suppression. Preserve first failures. Independent review must inspect source, raw results and this matrix before composition.
