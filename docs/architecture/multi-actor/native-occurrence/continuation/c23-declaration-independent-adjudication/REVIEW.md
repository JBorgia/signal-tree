# Independent C23 declaration adjudication

Bounded verdict: React ordinary-branch declaration has a reproduced public-operation safety failure. Do not qualify this included source kind or promote the combined declaration runtime as correct. Separately, the direct-row rollback receipt failure is an expectation mismatch on the supplied evidence: the old declaration revision may become superseded while a distinct rollback publication delivers the correct value. No runtime or assertion patch is supplied.

## Frozen input and scope

C23 manifest SHA256 `bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b`. Checkout reused read-only: `/private/tmp/st-c23-row-react-declaration-qualification/candidate`. Author Plato explicitly confirmed no active runs or planned mutations. Coordination exchanged availability only, not interpretations. `FULL-VERIFICATION-COMPLETED.json` records all3067 base files matching the manifest, plus fixture hashes. `VERIFIED-INPUT.json` separately records230 runtime/config/fixture hashes checked immediately before replay.

Original React fixture SHA256 `cd36a24864157eb9de9c805a45d46dd5b5f1ed985b0a9df58e1b3adece91b461`; direct-row fixture `b8c6ec372e915a1b1fbec181dcffb072e6c02607274d499177045e834ba1c841`. Original raw commands/results/logs are preserved in `original-raw/{react,kernel}`. Source identity is C23 plus these added tests; neither test nor runtime was edited in the reused checkout.

Initial full-copy preparation was stopped before any test launch. The partial `candidate/` is not an execution source. A supervisor preflight method-call error also occurred before any child spawn; its command is retained in `runs/react-preflight-failure`, with detail in `EXECUTION-LIMITS.md`. Corrected preflight launched exactly one React test invocation. These are preparation failures, not product failures or repeated test sampling.

## Actual independent replay

Pinned Node24.15.0 / pnpm10.17.0, root node_modules linkage as the author. Exact command:

`corepack pnpm nx test react branch-declaration-qualification.spec.tsx --skip-nx-cache --maxWorkers=1`

Cwd is the reused frozen checkout. Separate TMPDIR/Nx cache/data under this packet. The ordinary React target executes its tsc phase then Vitest with its existing jsdom config and source aliases. `runs/react/COMMAND.json` records full effective selected environment and external120s no-output/240s total bounds. Ownership monitor follows verified ancestry across detached groups. Result: **six actual tests, three passes and three assertion failures; exit1; no deadline; no remaining observed descendants**. No zero-test result or timeout is being counted as a counterexample. `runs/react/first.log:214–220` records the emitted values/status; lines229–280 identify failed assertions/counts. `RESULT.json`, `OWNERSHIP.json`, `ownership.jsonl` preserve process evidence. No timing claim.

## Reproduced safety counterexample

Fixture `packages/react/src/branch-declaration-qualification.spec.tsx`:

1. Real React facade tree with ordinary branch `{x:0,y:0}`, transactions enhancer, real Link endpoint, and mounted useSignalTree scalar selector (lines11–15).
2. `tree.transact(() => source.x(7))` remains pending. After draining, physical read and UI are7 and **sent is empty** (lines24–25).
3. Synchronous `declare({kind:'independent'}, () => source({x:7,y:0}))` performs equal whole replacement (line27).
4. The original assertions immediately before the failure confirm physical/UI values unchanged, **zero equal-value leaf notifications**, and **unchanged pending.inspect()** (line28). No confirmation/rollback has occurred.
5. The endpoint has already received `[{x:7,y:0}]`; receipt is `{state:'started',basis:'declared'}`. Both actual-owner terminal variants fail at line31. The held-dispose variant independently fails the analogous no-send assertion at line61.

This is a supported owned ordinary branch and real public-operation sequence. The capability cast only exposes the existing experimental method in C23's pre-public-typing state; it does not inject a callback, alter admission or replace internal code. Literal replacement data is not a getter/proxy/foreign-source artifact. React act/draining does not settle the transaction and does not authorize sending its pending contribution. Existing pre-declaration empty-send and unchanged-owner checks exclude a merely unprimed queue fixture explanation for the observed failure.

Contract: root continuation `EQUAL-WHOLE-AUTHORITY.md`, Selected contract: **“Actual pending destination ownership is preserved; declaration permission never erases a transaction's claim.”** The owner approved refreshing explicitly supplied **unowned** equal fields. `AUTHORSHIP-GUIDANCE.md` likewise says an equal replacement does not acquire another pending transaction's contribution. The newer `declare-api-scope-review/AUTHORITY.md` approves exposing existing owned source kinds and requires qualification; it does not waive ownership safety or authorize source widening/activation. The actual-owner branch fixture's hold expectation is therefore required, not an arbitrary stronger boundary.

The unowned-confirm, unowned-rollback and no-write/disposed tests pass. This preserves the distinction between useful fresh authorship and an actual destination obligation. The three failures do not establish three separate runtime causes. The two terminal-name variants fail before their terminal actions: this replay does **not** independently prove what a later rollback would do after the premature send, nor does the failing held-dispose arm reach its disposal assertions.

## Causal qualification

Established behavior: declaration over an equal whole branch permits endpoint entry despite a still-pending actual owner. That is sufficient to reject this bounded runtime behavior.

Source-grounded hypothesis, not uniquely traced root cause: `tree-scalar-slot-runtime.ts:205–228` prepares source publication for staged equal replacements. `experimental-publication/private.ts:133–151` derives destination authorship from current write metadata and prepares new native requirements. `private.ts:332–356` takes native destination support into prepareRevision; `private.ts:300–323` replaces field support, projects the selected result and supersedes predecessors. A declaration outside the original transaction has no current transaction metadata, so preservation of existing owned selection must happen somewhere beyond merely reading that metadata. This is a relevant handoff to inspect for lost destination support. We did not instrument these steps and do not assert that one particular assignment is the complete cause.

No neutral runtime counterpart was executed. Therefore do not label the defect React-specific, shared-kernel-wide, or a framework carrier defect from this replay. Neutral comparison was prepared but cancelled before launch at Main's stop instruction. No causality is inferred from host pressure or earlier startup delays.

## Direct-row receipt adjudication, separately

The original kernel run has five passes/one failure. Its actual-owner rollback case passes final source value, UI value, **exact sent `[{id:'a',x:0}]`**, resolved settled waiter and awaited settlement at lines33–34, then fails only `receipt.read().state === 'started'` at line35. Raw line173 records `{state:'superseded'}` with correct physical/restored value. This is author execution evidence independently interpreted here, not my replay.

The receipt identifies the declaration's selected revision, not every future delivery on the connection. `AUTHORSHIP-GUIDANCE.md` explicitly states **“Rollback creates a separate publication.”** C23 `experimental-publication/private.ts:310–323` keeps a changed projection and supersedes its predecessor; `lifecycle.ts:235,333–344` makes started/superseded sticky and starts only the selected operation; `link.ts:919` calls started on the selected researchTicket immediately before its endpoint invocation. Correct rollback delivery does not require falsely declaring that the older x7 operation started.

Recommendation: retain the original failure; for this exact actual-owner rollback fixture, a reviewed counterpart may require **superseded**, while preserving exact x0 delivery once, no stale x7, settled completion, receipt immutability/stickiness, disposal cutoff and entity lifetime reuse. Do not change other terminal cases wholesale or allow arbitrary status strings. Assertions after original line35 were unreached, so their qualification remains open until that useful counterpart runs. The prepared receipt-only companion was **not run**, and no patch for composition is offered. No direct-row safety defect is demonstrated by this one status mismatch; that is not complete direct-row/API qualification.

## Run / not run

Run: full base identity check; separate source/config identity check; original six-case React file via normal Nx target, no assertion changes; observed descendant census. Read: original direct-row raw failure and current source/authority. Not run: neutral companion, receipt counterpart, further builds, full suites, mutations, API tests or performance controls. The scratch specs were prepared before Main's execution stop and are explicitly unexecuted; they must not be promoted as passing controls. No subsequent test execution is requested by this report.

All runtime/authority/public-doc writes remain with Main. API typing review is separate. This counterexample blocks qualifying the ordinary-branch runtime; it does not authorize a semantic repair, activation, source restriction changes or broader API changes.
