# Bounded value-work implementation — frozen for independent review

Not composition-ready: a private injected reduction-reentry discriminator exposes stale completed payload beyond the reviewed handoff boundary. No additional runtime repair applied. McClintock was sent exact frozen identity for independent implementation and boundary review; verdict pending.

Exact base C17 manifest SHA256: 893effd2a669e7658fa34f89aecd0d1633488465bb3c32ddea98dd7a9d87aa47 (BASE-C17.json). Candidate SNAPSHOT-VALUE-WORK.json SHA256: e87715deeebe1392fb4d8996376b6cb2e2a9e9678d47e8dbcf864857560d8382. RUNTIME.patch changes private.ts and link.ts only. TESTS.patch adds 13 discriminators. TEST-COMMENT.patch changes only the intentional sink comment in the third preparePublicationMutations argument at recipient-window-independent.spec.ts:33. COMMENT-EMIT-CHECK.json verifies identical transpiled JavaScript with comments removed. Focused comment lint passes. Root and frozen inputs unchanged.

## Mechanism implemented

Recipient-shared delivery state retains produced/taken work epochs and selected projection across Binding clones. Support-only units retain outstanding work without rearming an already-taken prefix. Refresh is nonconsuming and rereads the live binding after guarded reduction. Both Link receipt paths assign fact/payload and OR dirty, then acknowledge the captured prefix without callbacks. Current support, admission, permission and endpoint policy remain unchanged. Same-fact legacy adoption no longer skips acknowledgment.

## Concrete remaining discriminator

value-work-handoff.spec.ts:45–49 injects a passthrough observer into private RecipientOccurrences.replace. During outer independent a(1) reduction it authors independent a(2). Candidate first sends {a:2,b:0}. A later independent b(3) leaves live state {a:2,b:3}, but sends {a:0,b:3}. Exact C17 instead fails the earlier assertion by sending nothing. Raw separate first failures: candidate-reduction-reentry-first.log and predecessor-reduction-reentry-first.log; commands alongside.

Source explanation: private.ts:297–298 calls installFact before assigning the reduced payload. The injected observer authors a new Binding via prepareScalar's shallow clone at :351, copying valuePayload before the old wrapper's update. Shared delivery selection allows the first latest projection to reach Link, but the new wrapper's completed payload remains stale for the later sibling fold. This is a private injected callback boundary, not evidence of a supported public callback route. No universal public regression claim. The mechanism review explicitly states “no full stale-payload repair is preapproved”; preserve and review this case before extending runtime scope. No source-identity redesign proposed here.

## Executed validation and first failures

All Nx commands, cwd, environment and exit codes are saved as NAME-command.json, NAME.log and NAME-exit.json. Node24.15.0/pnpm10.17.0; disposable copies use the working dependency symlink. No docs, broad suite, cost or release gates run.

- candidate-second: 12 new +26 unchanged scalar-frame tests, 38/38 pass. Includes public pending-q/support-only selection, already-delivered no duplicate, subsequent genuine change, endpoint reentry, held disposal; private cursor, recursive inspection, unfinished preparation, and completion contradiction controls.
- candidate-controls-corrected: 77 pass /8 fail across 85 cases. All26 scalar-frame, all17 recipient-window-independent, all8 enrollment-adjudicated pass. New tests12/13. Native certificate4/5. Old enrollment invariance10/16.
- predecessor-controls-final: same85 cases, 73 pass /12 fail. Candidate fixes original equal-sibling failure and three private handoff controls. The seven unchanged failures reproduce on exact C17: retained collection equal-whole delivery and six original enrollment-invariance nonmatching-recipient assertions. They are preserved, not silently promoted or edited. The private reentry case fails both at different assertions.
- candidate-source-types and candidate-spec-types both exit0. Spec baseline improvements reported, baseline unchanged.
- candidate-first preserves missed delivery initializer error; RUNTIME-FIRST-private.ts archived. predecessor-first and TEST-FIRST.spec.ts preserve initial fixture failures. Two fixture corrections isolate intended behavior: settle unrelated q before unfinished-clone case; explicitly assert contradiction when completion injects a dependent newer author into an outer independent declaration.
- candidate-bounded-final and candidate-native-controls preserve command-selection errors: comma-separated testFile passed as one filter, no files found. Corrected run uses repeated --testFile flags.

Public pending-q case passes both C17 and candidate; it is a safety/progress discriminator, not a claimed baseline falsifier. Private epoch-specific baseline failure is expected because that private acknowledgment protocol does not exist on C17. First original C15 equal-sibling failure is separately preserved as ORIGINAL-C15-FAILURE.log.
