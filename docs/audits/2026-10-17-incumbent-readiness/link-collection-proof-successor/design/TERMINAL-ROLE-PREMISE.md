# Uncertainty transfer and minimal terminal-role compaction

Read-only premise/design review, 2026-10-29. Source basis frozen75416029: experimental-publication lifecycle.ts, private.ts, entity.ts; entity held-node/field producers and native updater timing; UNCERTAINTY-RULE.md and RETIREMENT-MECHANISM.md. No runtime/test edits or execution. This proposal is for root coordination; it does not authorize edits to another worker's lifecycle files.

## Uncertainty rule: compatible, with an explicit consumption transfer

The rule preserves the two already-approved outcomes: newly consumed unavailable input acquires a current authorship window, while an inherited historical window never rebases. Contribution selection alone is not actual input consumption. The old unavailable source certificate must remain unchanged after a consumer authors a derived fact.

The root's proposed two-bit encoding is sufficient for U1–U6:

```
Proof.unavailableInput?: boolean
Proof.historicalWindow?: boolean
```

Retain existing unknown/invalid and exact possible-owner cells. Combine the provenance bits with OR. `unavailableRequirement` creates unavailableInput. When preparing an authored requirement, examine ONLY actual captured native inputs for unavailableInput. A positive result requests a fresh own window. The resulting authored proof consumes that input marker: it retains unknown, gains historicalWindow, and does not propagate that consumed unavailableInput as a fresh acquisition request. Inherited historicalWindow and its fixed possible members transport without rebasing. If some independently selected contributor is still raw unavailable, the aggregate selectedSupport may still contain unavailableInput; it must not feed back as authored native input.

An original raw unavailable input consumed twice in distinct operations can therefore capture two windows; the first derived result consumed later inherits only its own window. A combined raw-unavailable plus historical input captures a new window for the former without changing the latter. Empty acquired windows need provenance too, or a later consumer may recapture unrelated owners.

Do not infer unknown universally from historicalWindow: a normal undeclared write with no owner/uncertain input and an empty own window currently need not become unknown solely because acquisition occurred. Preserve the existing unknown rule, with unavailable-derived empty windows remaining unknown through their unavailable input. No new public receipt classification follows from the tag itself.

Closed historical window is historicalWindow plus no remaining blocking W cells after justified terminal compaction. This does not require a third enum state. A W member that is pending, abandoned, or unresolved after source disappearance cannot be dropped. A W-only uncertain component may be folded into a historical uncertainty marker only after all its members have confirmed or rolled back; an empty component must not manufacture uncertainty.

## Minimal terminal-role representation

For future current-source evidence only, add a compact terminal summary next to exact live identities:

```
TerminalSummary {
  rejectedRoles: bitset<D | I | V>;
  // Optional later extension; safest first implementation keeps abandoned
  // identities exact instead of compressing them.
  invalid: boolean;
  unknown: boolean;
  historicalWindow: boolean;
  unavailableInput: boolean;
}
```

Keep pending owners and unresolved validation horizons exact and indexed. Keep abandoned/unavailable identities exact for the minimal implementation: they still block, and disappearance does not establish terminal success. Authentic user-held owner handles remain associated with their actual cells. Do not rewrite issued snapshots, in-flight tickets, live recovery records or active declaration frames to this summary.

Summary meaning is role-preserving, not a new owner. D transport still gates delivery without becoming declaration input; actual consumption maps terminal rejected D/I/V into terminal rejected I. Confirmation before **new** input capture discharges actual owners as today; a previously issued capture of a pending owner retains its exact frozen owner list and cannot retroactively become a new compact capture.

The rejection bit is valid because a terminal rolled-back owner cannot be legally named in a newly entered complete declaration: runDeclaration rejects such handles before callback. Thus every valid complete declared set necessarily omits a consumed terminal rejected input, regardless of which rejected identity it was. A consumed rejected-I marker can install the same contradiction obligation in each active complete horizon without retaining the old owner ID. Unknown declarations do not acquire that complete-set contradiction merely from the marker; they retain the existing conservative behavior.

This needs a **dedicated terminal-required-input flag on validation frames**, not a fake OwnerCell or mutation of copied declared owner arrays. It participates in after-callback contradiction detection and enclosing-horizon propagation just like an unnameable required actual input. Presence of an old rejected D contributor in selectedSupport must not set it. It is introduced only by actual capture or an otherwise already-required declaration input boundary.

Inherited invalid proof remains invalid evidence; do not automatically convert every invalid bit into a new frame contradiction. Preserve the existing distinction between invalid source proof, incomplete declaration, and required-input omission. Existing lifecycle.prepareNativeRequirement does not simply turn every invalid input bit into invalidFrames. Receipt/error equivalence must follow the current paths precisely.

## Receipt, delivery and error equivalence

Both lifecycle and private delivery consumers must understand the terminal marker; updating only the receipt path is insufficient.

- Early permission requires no invalidity/unknown, no terminal rejected actual role and all remaining actual owners confirmed.
- Pending remains true for pending/abandoned exact roles and incomplete horizons. Terminal rejected actual role alone is not pending; it permits only the existing fresh surviving fallback, never declared permission.
- Receipt precedence stays: validating; then invalid-declaration/unknown; then rejected-dependency; then pending-dependency; then declared eligibility. `started` basis comes from the actual selected delivery route.
- A complete declaration actually consuming rejected input runs its callback, retains installed writes under existing rules and fails after callback with contradiction. Supplying an explicitly rolled-back handle still fails before callback with unavailable-owner through the authentic-handle path.
- If callback throws and contradiction also arises, return the exact callback-thrown value as primary and report the secondary declaration error through the existing reporter. Do not add a throw from compaction/preparation that changes this ordering.
- Confirmation/rejection state and live receipt terminality do not change. Existing tickets keep their original evidence; compaction only changes the source reference used by a later capture.

No new public policy is required for this extension if these observations remain identical. It is a private protocol change requiring mechanism review and differential discriminators before integration.

## Bounded storage and the subtraction limitation

Use the retirement proposal's reader domains: active/recoverable numeric index, broad collection absence summary, weak token for each already-issued held lifetime, and independently owned immutable issued requirements. Current broad collection input cannot substitute for old x.n's lifetime-specific certificate. A weak-key map must have no strong numeric-subject-to-token back edge after forget.

For irreversible retired components with no supported individual replacement operation, terminal summary bits combine by OR: arbitrary many historical W-only/rejected terminal components need constant-size terminal state. Pending role identities remain O(distinct live blockers); active/recoverable facts and user-held/captured roots remain proportional to those actual obligations. Report these dimensions separately. Arbitrarily many retained user inputs cannot honestly have globally constant storage.

**Important bound:** OR aggregation supports addition, not selective removal. If an existing authored operation can supersede one retired component while preserving another, preserve a current address/contribution token with subtractable counts until that replacement opportunity ends. Dropping that identity first cannot be repaired by a bitset. Example: negative x carries rejected p; negative y carries pending q; an authorized addressed replacement supersedes only x. The system must remove p's current contribution while keeping q, without touching held old-x evidence. A summary with only a rejected bit and q has no way to know whether the x contribution was its sole rejected reason.

This is not proof that all retired keys need permanent storage: the current public byId-style absent getter is not a native supplied key-input port, and fresh lifetime creation does not automatically supersede every old-lifetime absence. It is a concrete design condition: document which current facts remain individually supersedable under the producer contract before merging them irreversibly. If the intended exact semantics allow arbitrary future per-retired-key replacement, keyless O(1) storage for arbitrary N such distinguishable obligations is impossible without additional source information. Do not claim that stronger bound from the current proposal. No policy selection is made here.

## Differential discriminator vector (before/after compaction)

1. **U1–U6 unchanged**, plus direct raw unavailable input consumed twice versus a consumer of the first derived result. Only direct raw consumption captures the later owner. Include an empty original window and mixed raw/historical inputs.
2. **Terminal W confirm/reject:** compact after q settles, open r, consume absence in independent declaration; same conservative unknown and useful surviving delivery, r untouched. Prior captured input behaves identically.
3. **Rejected D transport versus consumption:** untouched rejected-D contributor holds a valid unrelated declaration without a false input contradiction; actual supplied consumption creates the same after-callback contradiction before and after compaction.
4. **Error precedence:** previous case with callback-thrown sentinel, secondary reporter throwing, and enclosing complete/unknown scopes. Preserve exact primary value, secondary stage/reason and retained writes.
5. **Confirmed actual timing:** capture after confirmation versus capture pending and confirm inside updater. The latter cannot become the former through source compaction.
6. **Invalid versus unknown precedence:** invalid horizon, unknown input, rejected actual input and combinations. Compare receipt state/reason, callback execution, throw stage/reason, and fresh fallback—not just endpoint output.
7. **Abandoned/unavailable:** remains held/unavailable; compaction cannot treat it as rolled back W or a successful outcome.
8. **Held x/y lifetime precision:** x removed with q, y with t; forget both; old x field updater's side effect consumes only x's evidence before its own write refuses. Root snapshot consumes the broad domain. Fresh same-key x never inherits old token/proof.
9. **Subtractive replacement:** exercise the actual supported producer if it can supersede one current negative contribution; preserve other negative facts and old issued proofs. Otherwise document the unsupported operation rather than inventing a clearing API.
10. **Churn:** N distinct settled W-only and separately terminal rejected-actual removals with no retained handles/recovery/inputs. Measure numeric records, terminal-summary fields, live owner indexes, weak held roots and issued-proof roots. Then repeat with fixed live blockers and staggered recovery. Zero numeric entries alone is not acceptance.

These are proposed tests, not execution results. Root must coordinate the terminal-summary lifecycle interface with the core worker; no competing runtime edits were made.
