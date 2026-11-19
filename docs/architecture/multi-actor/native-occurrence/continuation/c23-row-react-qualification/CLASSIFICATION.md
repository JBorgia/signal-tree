# C23 direct-row / React declaration qualification — first failures classified

**Stop expansion: React branch cases demonstrate an actual pending-owner publication safety failure.** No runtime repair, assertion weakening, extra variants or API/export edits were made. New owner approval for the existing-source public surface does not waive actual ownership safety. Kernel receipt failure is separately classified as an overly strong fixture oracle.

Exact C23 baseline manifest: bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b, 3067 entries verified before and after. Disposable source copy differs only by two new qualification specs, both unchanged since execution. Private method casts are expressly experimental, not shipping types. Sources are already admitted: direct EntityMap row (kernel) and ordinary marker-free branch (React). React uses the real facade plus mounted useSignalTree scalar selector and act. No source-admission bypass or public type patch.

## First outcomes and assertion classification

| Case | Result | Classification / reached evidence |
| --- | --- | --- |
| Kernel direct-row equal unowned / confirm | Pass | Exact row sends once before unrelated owner settles, zero equal leaf notices, unchanged owner, sticky immutable receipt across disposal and row removal/same-key reuse. |
| Kernel direct-row equal unowned / rollback | Pass | Same useful progress and ownership protections; unrelated rollback preserves row7, no duplicates. |
| Kernel direct-row actual owner / confirm | Pass | No early send, owner inspection unchanged, unresolved waiter while pending; exact row7 after confirmation; receipt/lifetime checks complete. |
| Kernel direct-row actual owner / rollback | **Fail** at line35 receipt started assertion | Before failure, no early send, owner unchanged, rollback restores row0, exact row0 sent once, waiter resolves. Receipt is superseded. This is NOT demonstrated stale/premature output. |
| Kernel no-write / after-dispose | Pass | Frozen no-write receipt; disposed call rejects before callback, no write/output. |
| Kernel held-dispose | Pass | Genuine held waiter resolves at disposal, owner unchanged until rollback, no post-dispose output, disposed receipt sticky. |
| React branch equal unowned / confirm | Pass | Complete branch payload before unrelated settlement, zero equal leaf notices, mounted selector current, no duplicate, receipt/disposal checks complete. |
| React branch equal unowned / rollback | Pass | Same, unrelated rollback preserves x7. |
| React branch actual owner / confirm | **Fail** at line31 `sent=[]` | Sends [{x:7,y:0}] while p remains pending; receipt started/declared. Confirm operation never reached. |
| React branch actual owner / rollback | **Fail** at line31 `sent=[]` | Same premature payload/receipt; rollback never reached. Not evidence about rollback output. |
| React no-write / after-dispose | Pass | No-write/disposed callback rejection assertions complete. |
| React held-dispose | **Fail** at line61 `sent=[]` | Same premature output after declaration; disposal/waiter assertions never reached. Not a separate demonstrated disposal bug. |

Kernel **5/6**, React **3/6**. React target's existing tsc spec phase passed before executing six tests. No independent kernel spec-type gate or full suite/build was run. All failed assertions and original first raw logs are retained unchanged. Do not report the invalid receipt oracle as passed or suppress it; it needs an explicit separately reviewed replacement before promotion.

## Contract interpretation

Kernel rollback receipt: the selected dynamic-enrollment AUTHORITY.md says: “Successful rejection invalidates the old ticket; a new surviving-basis evaluation may send the same surviving value, or the restored value. Rejection never confirms an old proof or revives a terminal receipt.” The247cf proposal also says a later authored revision can supersede an earlier receipt. Therefore equating a successful restored send with `started` on the old receipt is too strong. The observed superseded old receipt is compatible with fresh surviving publication. Later terminal-immutability/reuse assertions in THIS failed rollback case are unreached; do not borrow passes from its siblings to label them executed.

React pending-owner hold: EQUAL-WHOLE-AUTHORITY.md approves refreshing explicitly supplied **unowned** fields and states “Actual pending destination ownership is preserved; declaration permission never erases a transaction's claim.” Known native destination dependencies remain lower bounds. The fixture first authors source.x(7) inside tree.transact, verifies no send, and then makes an equal independent whole-branch replacement. Both original-owner cases verify same pending inspection, source7, zero equal leaf notices and mounted UI7 before failing on the premature exact payload. The scope is actual owned support, not an unrelated possible window; G4 changed-value complete replacement is not this equal case. No malformed owner input, marker-bearing source, async declaration or new public policy is needed to explain the failure. The held-dispose fixture shares the same failing prefix.

## Minimal raw cause hypothesis for independent replay

Same minimal sequence in both settlement variants, before any terminal operation:

1. Through React facade create enhanced {pair:{x:0,y:0}}, obtain link(tree.$.pair, endpoint), mount useSignalTree(tree,$=>$.pair.x()).
2. p=tree.transact(()=>tree.$.pair.x(7)); drain through act. Endpoint remains empty.
3. c.declare({kind:'independent'},()=>tree.$.pair({x:7,y:0})); drain.
4. Actual endpoint=[{x:7,y:0}], receipt={state:'started',basis:'declared'}, p.inspect unchanged, native equal-value notices=0. Required endpoint remains empty until actual owner resolves.

Source hypothesis only, not a traced causal proof: experimental-publication/private.ts:133–137 derives native authorship from the *current* write context. In the following independent declaration no transaction is active, so authored.known is empty. The native factory at :140–158 permits unchanged writes while validating, prepares a new requirement from this fresh authorship/consumed inputs, then replaces nativeValues and the existing native view requirement. It does not visibly merge the previous destination obligation in that preparation. This could relabel publication support while scalar transaction ownership remains unchanged. tree-scalar-leaf-runtime.ts:160+ passes the unchanged-preparation path into commitRecorded. React's index.ts re-exports kernel and adds only its observation hook, so the probable boundary is common scalar/branch publication, not a proven React-specific scheduler defect. Entity-row admission is a distinct path and its actual-owner hold passes here. No blanket cross-framework or scalar-only extrapolation is claimed.

Independent replay should start from the exact preserved React actual-owner test(s); tracing the selected native requirement before/after equality admission can falsify this hypothesis. Do not repair based only on this source inference. No additional experiment was run after the concrete safety failure.

## Reproduction, preservation and limits

Exact Nx commands/envs are runs/kernel/COMMAND.json and runs/react/COMMAND.json; both use pinned Node24.15.0/root installed dependencies and one worker. Source hashes before each run and unchanged results are recorded. External watchdog owns a fresh process group per command (PID/PGID recorded), 120s no-output/240s total caps; neither fired and no termination action was needed. OWNED-PROCESS-CHECK.json records groups absent at freeze. No global process kill.

FIRST-PREPARATION-ERROR.txt retains an early generator invocation before its destination existed; the unchanged generator was rerun after copy completion. It was not a runtime/test failure. Archived tsconfig warnings (and a React startup MaxListeners warning) are retained; actual selected tests executed. No semantic fixes, skips, xfails or new output-helper environment. tests.patch is research qualification evidence, NOT a green promotion patch.

The matrix leaves explicit dependent-owner input/recovery, arbitrary callback/thenable faults, React direct-row declaration, all other facades, receipt GC and complete shipping types unqualified. Direct row and React unowned useful progress are positive bounded evidence, not a substitute for the pending-owner blocker. Main should hand the preserved failure to independent replay before any runtime repair.
