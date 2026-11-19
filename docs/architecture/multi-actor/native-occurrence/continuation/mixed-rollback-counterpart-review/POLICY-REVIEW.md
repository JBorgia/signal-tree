# Mixed rollback independent policy adjudication

Bounded verdict: **no equal-whole implementation blocker demonstrated by this failure; preserve the original failure as a stronger progress boundary.** The earlier declaration cannot authorize a new rollback fact. However, calling this a genuinely unobserved inverse input is unsupported: the selected native aggregate is complete in this fixture. The hold is introduced by operation-attribution classification, not by missing selected field support. Existing evidence does not establish that this extra hold is necessary.

## Exact evidence and scope

Test-only copy of `/private/tmp/st-equal-whole-c16-qualification/candidate`, whose manifest SHA-256 is `a95b716f10c7dc43efc0f60d13a31a947695affff153b376ba6232c6835a28e3`. All 3066 manifest entries verified before work and again after execution (IDENTITY.json). This is the frozen equal-whole successor on C16, not plain C16 or a later composition. No runtime or original test changed. Root HEAD inspected as `628d302dadb082a48c58528651c9088234d0a777`; unrelated root dirty files untouched.

Read Tesla's POLICY-AND-SELECTED-FACT.md as a claim, then checked exact source and independently recorded both sides of projection, numeric fact identities, receipts, native field support and actual admission basis. Passthrough spies record existing calls without changing their arguments/results; the prepareRevision wrapper calls its original finalizer. Raw run: `runs/bounded-trace/first.log`; observations: `runs/bounded-trace/rollback-policy.json`; exact command/environment: COMMAND.json in that directory.

## What the three discriminators show

All begin with local p owning x=7, unrelated foreign q pending, ordinary y=9 initially held, then an independent whole declaration explicitly supplying x=7/y=9. The whole declaration preserves actual p ownership and cannot yet send.

| Route | New fact and observed result before q settles | After q confirms |
| --- | --- | --- |
| Plain p.rollback() | Fact 6 selects x=0/y=9, no declaration, previous receipt superseded; held | Fact 6 starts with surviving basis and sends x=0/y=9 |
| Independent declaration around p.rollback() | Fact 12 selects x=0/y=9; declaration returns conservative/unknown, previous receipt superseded; held | Fact 12 starts with surviving basis and sends x=0/y=9 |
| Plain rollback, then fresh independent explicit whole x=0/y=9 | Rollback fact 18 held; fresh fact 19 has clean proof and starts with declared basis while q remains pending | No additional output |

For every rollback, id/x/y native endpoints are clean: no pending owner, unknown, invalid, unavailable input, input owner or validation owner. More decisively, the aggregate **entering** projectRevision is clean, with empty owner/possible/input/validation sets (historicalWindow remains true). The outgoing proof adds unknown=true and possible=[q]. This closes the prior inventory's observation gap: support is not disappearing in aggregate composition. The selected payload is the useful changed x=0/y=9, not a stale x=7 capture or lost value-work item.

The native packet proposal separately has unknown=true, with no captured NativeInput entries. Complete inverse endpoints bypass that proposal; empty packet inputs do not demonstrate absent inverse support. No genuinely hidden input to the restoration was found in this fixture. This does not certify arbitrary compensation callbacks or structural/lifetime inverses.

## Exact causal seams

Paths below are relative to this candidate's `packages/kernel/src`.

- `enhancers/transactions/transactions.ts:3763`: rollback installs origin/transactionId/ownerId but deliberately omits transactionOwner, to avoid reopening active transaction callback scope. This is an existing intentional boundary, not permission to stamp that token.
- `lib/experimental-publication/entity.ts:101–106`: the rollback metadata creates an unknown native proposal. At :128, restoredFields takes precedence over selected/proposed endpoints.
- `lib/experimental-publication/private.ts:303–325`: valid attribution requires transactionOwner; rollback therefore receives invalidAttribution=true and unobservedOrigin=true, but uncapturedUpdaterInput=false and recipientDomain=false. A new changed fact is prepared.
- `lib/experimental-publication/lifecycle.ts:260–301`: these flags independently make the operation incomplete, even with a native requirement or matching declaration. Finalization captures the fixed foreign pending window; recipientProof overlays it on the clean selected projection. Merely adding a declaration around settlement does not discharge it.
- `lib/experimental-publication/private.ts:440–460`: pending possible-owner support prevents admission; after settlement the new fact gets ordinary surviving admission. Numeric fact and started-basis observations above confirm this path.

## Authority adjudication

Read root `docs/architecture/multi-actor/native-occurrence/continuation/recipient-policy-review/authority/AUTHORITY.md`, `continuation/EQUAL-WHOLE-AUTHORITY.md`, and the frozen link-declared-contract README/SPEC and RELEASE-CURRENT.md:628–632.

The bounded possible-owner approval covers unobserved undeclared origin/inputs, retains progress for qualified complete declarations, and says native argument certification alone does not certify other callback inputs. It does not say every operation carrying an origin string genuinely has hidden inputs. The exact inverse here is known and its selected aggregate remains qualified at the source layer. Therefore metadata-derived unknown must not be reported as proven native dependence on q, nor as evidence the owner explicitly required this particular compensation hold.

Conversely, the equal-whole approval concerns fresh evidence for explicitly supplied unowned fields, preserves rollback/inverses, and does not turn restoration into new explicit authorship. The prior declaration selected x=7 with actual p responsibility; it cannot transfer declaration permission to x=0. The surviving-write approval explicitly does not establish independence while other owners remain pending. The enrollment correction deliberately preserved origin/attribution uncertainty. Thus the original immediate-send assertion is stronger than progress established for this new undeclared compensation fact; it is not a demonstrated equal-whole regression.

The declaration-around-settlement result is a concrete qualification boundary, not proof that arbitrary complete declarations can be ignored. A matching declaration exists but current metadata rules prevent it becoming qualified. No reviewed contract was found specifically promising that this settlement wrapper constitutes complete new reauthoring. The fresh explicit post-settlement write is within the approved authorship contract and demonstrably progresses. Do not install a settlement exception or erase the attribution overlay based on this report.

Tesla's selected-fact and surviving-basis account is confirmed by execution. Its conservative-treatment disposition is defensible within the currently preserved fallback boundary. Any stronger interpretation that the hold is intrinsically necessary, or that the rollback actually lacked native inverse support, is not established. Native support completeness and recipient declaration permission are separate; neither may substitute for the other.

## Falsifiers run and not run

Ran only `corepack pnpm nx test kernel --skip-nx-cache whole-rollback-policy-trace.spec.ts --maxWorkers=1` in the isolated copy: 3 tests passed. The controls assert installed inverse values, no thrown error, useful eventual output, and useful fresh-declaration progress while the foreign value remains pending. Hold and receipt distinctions are raw observations, not new passing-policy expectations. Node 24.15.0, pnpm pinned by package; own Nx/temp directories; ST_PREPARED_REVIEW_OUTPUT unset. Source unchanged after execution. Preserved unrelated stale audit-tsconfig warnings in first.log.

No full suite, build, source/spec type gate, new broad matrix, C18 run, or runtime repair. Original qualification's immediate-progress failure remains untouched; these three passes do not turn it into a passing test. Earlier plain-C16 field/whole comparison is inherited evidence, not rerun here. No release or composition acceptance.
