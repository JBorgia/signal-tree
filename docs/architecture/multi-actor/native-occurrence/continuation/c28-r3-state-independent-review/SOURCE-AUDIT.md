# Pre-freeze independent classification audit

No implementation disposition yet. Frozen R3 source examined independently of forthcoming author's verdict. No tests or source writes. Author McClintock was sent exact-freeze request through send_message_to_thread (tool returned threadId01a19d19-14a4-7a21-8e6c-6e098099cd55 without error). Final review requires candidate/base/patch identity and raw focused controls.

R2/R3 differential raw reference: both96pass6fail on same102case four-file set; matching failures establishes inheritance only. External ABA unbatched and inner adapter B are substantive state losses, not receipt/call-count oracle issues. Neither this reading nor differential establishes earlier introducing revision or a default-scheduler public ABA failure.

## Actual effects of classification before frame installation

- tree-scalar-slot-runtime.ts:205–230 performs equality, obtains inspection baseline, prepares terminal records and publication units while prepareCommit runs. Terminal capture is called before native publication and passes preparedTerminal into source publication. installTerminalRecord is deferred until installer (:257 onward); that later phase installs already-prepared authority. Labeling notify() as realized afterward cannot reverse that earlier decision.
- transactions.ts:4240 terminalRecord skips restoration/inspection/realized, otherwise builds transaction scalar admission from owner/id. Scalar selection near2873 independently skips realized before binding changed endpoint ownership and requiring prepared scalar admission. Both must see the intended context at preparation; clearing all ambient metadata would be a different semantic change.
- external.ts:120+ intentionally retains ambient owner/id while marking realized. captureIntoBucket near2855 resolves that id and suppresses a position already in installedOperations. Realized notifier branch near4115 invokes this same capture routine for later-evidence probe; authored suppression must not eat realized evidence. Authored observation paths near4154 and4346 still need suppression after prepared terminal install.
- Preserve the existing early exits for inspection/restoration and foreign owner tokens, and all other capture/effect logic. A narrow guard distinction should not add a second effect stream or disable installed authored dedup globally. Count positive authored controls and repeated same-position authored writes/rollback provide the counterweight.
- Adapter scalar plan (:1825) and heterogeneous scalar plan (:1610) both prepare under ambient context in baseline. Per-effect fallback already scopes realized writes. Candidate must cover the actual affected preparation sites; don't infer a broad wrapper over all publication/completion callbacks is harmless.

## Context/lifetime boundaries to verify in candidate

Use existing withWriteContext's synchronous try/finally restoration (write-context.ts:50–62). Preserve transactionId, transactionOwner, origin and other ambient fields; only intended participation/intent override belongs to realization. Outer authored A before and C after inner B must retain their ownership; B must survive outer rollback. Context identity/value after normal return and thrown equality/preparer/finalizer must be restored. Nested realization and reentrant authored operations need scoped classification, not a leaked realized flag or a cleared owner token.

PublicationPreparation seal/validate and completion can run after initial prepare returns; inspect whether they capture needed facts or read ambient later. Don't extend a preparation-only context over external callbacks without checking their preexisting policy. Returned prepared plans install later; returning a plan must not retain an active global context. A throwing completion must drain/restore under existing first-error rules.

Realized is not inspection and is not absence of all publication responsibility. Native publication code can preserve ambient owner/possible/input dependencies independently of authored transaction capture; suppressing terminal authorship does not authorize dropping pending evidence, changing owner outcomes or bypassing source admission. Exact intended native effects require existing controls, not inference from one passing physical-value case.

Final bounded review will compare only frozen changed paths, preserve genuine own-write dedup, inspect scalar/heterogeneous preparation coverage, and verify raw A/B/C/throw/reentry cleanup checks. No API/receipt/comparator/foreign-authority policy change is inferred or requested.
