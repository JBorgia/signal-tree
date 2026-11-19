# Equal-whole C16 successor — stopped and frozen for independent review

**Do not compose this candidate.** The bounded data-property implementation makes Main's six original tests pass, but violates the explicitly reviewed getter/read/exception boundary. Runtime work stopped on that concrete recurrence; no eager staging, callback guard, Link change or input restriction was added to hide it.

Base: exact C16 manifest `611f7da2665e91f3c53a8aceeb32a2b878324d4db86ced489c2785e898d8e537`, all 3,061 paths checked before copying and again at freeze. Candidate `SNAPSHOT-WHOLE.json`: `8ed29ecbbd0cb8cefcecff4bda5cb6351dd9e59ed7590fb571d412cc0a182d0b`. Runtime patch SHA `f7203ac99e828c33020772683a34f5d1c859b55c1b121e3924307e95052005e8`. `FREEZE.json` records results and patch application verification. C16, Main's six-test source, and all foreign scratch directories remain unchanged.

## Implemented scope

Only `entity-signal.ts` runtime changed. Frame ordinary publication edits offer existing diff keys plus explicitly supplied own keys for whole replacement; shared per-change publication edits keep canonical/step metadata aligned and carry existing restored fields. Physical publication diffs, frame/value installation, native transaction selector, final-subject proposal semantics, per-edit restored precedence, Link, and terminal-owner handling are unchanged. The construction collects ordinary step edits before passing the packet, which also changes the placement/count of existing diff reads; this is part of the reviewed candidate, not an assumption of equivalent accessor behavior.

One existing test metadata expectation changed under explicit approval: `native-authored-footprint` now expects offered id/x/y keys for equal whole ordinary fields and additionally asserts physical fields remain empty. Original retained verbatim as `ORIGINAL-native-authored-footprint.spec.ts`. All writer-classification assertions remain. Main's six tests are byte-for-byte identical to its source.

## Executed results and first failures

All commands/raw logs/results are in `runs/` and `baseline/runs/`; pinned Node24.15.0/pnpm10.17.0, Nx, isolated cache/data/tmp, unset ST_PREPARED_REVIEW_OUTPUT. Runtime hashes remained unchanged during each run.

- Exact baseline prewritten getters plus Main six: **12 pass / 3 fail**. Nine getter first-error/early-reentry controls pass. Three expected unowned publication cases fail; all three pending-owner cases pass.
- Successor first proof: **45 pass in five files** — Main six unchanged, nine getter controls, reviewed footprint expectation, native-admission equal/inverse/net-zero controls, and packet-index adversarial controls including final-subject proposals, per-edit restored overrides, presence and reentry/refusal.
- Source types and spec types: **pass**, no ratchet update.
- Matched late-getter discriminator: baseline **3 pass**, candidate **3 fail**, across setAll/replaceOne/direct row. These failures block the candidate notwithstanding the preceding passes.

## Concrete getter recurrence

`whole-getters.json` versus `baseline/whole-getters.json` records stable equal whole input read counts **8 versus 6** on each route; the existing second-read reentry case performs **5 versus 3** reads while preserving stale-outer refusal and the inner write. Thus the initial nine passing assertions did not establish preserved getter calls. Counts describe only these matched workloads, not performance.

`whole-late-getter.spec.ts` supplies an equal row with an own enumerable getter that throws a fixed sentinel on read seven. The matched observer configuration is identical to the stable-count fixture:

- C16: six reads, no throw, no sentinel reached.
- Candidate: seven reads, the operation throws the exact sentinel; the source endpoint has already changed and the row is subsequently delivered. All three original assertions fail on the newly thrown error. `whole-late-getter.json` captures first-error identity, count, endpoint identity and actual output; raw first.log retains the stack.

This is a new user-code invocation and error outcome, not a harmless allocation difference. Source selection/egress now read equal offered getters; the candidate also reorganizes preexisting diff reads. No separate ablation was run, so this report does not assign every added read to one line or claim that all possible implementations of the approved rule are impossible. The approved review specifically required stopping rather than inventing staging semantics to resolve this condition.

## Fixture correction preserved explicitly

The first late-getter probe omitted the x subscription present in the calibration test, so its baseline executed five reads and failed the hardcoded six-count expectation. Its source remains `FIRST-LATE-GETTER.spec.ts`, both original logs under `runs/late-getter` and `baseline/runs/late-getter`, and measurements as `FIRST-late-getter.json` in each root. That first candidate probe reached the new seventh-read error through contained subscriber reporting (`ST2034`).

The only correction added the same x subscription/teardown used by the calibration fixture; both baseline and candidate received the identical correction. Expected six reads/no thrown error were not relaxed. The matched baseline passes all three; candidate throws the exact new sentinel on all three. The final fixture is `LATE-GETTER.spec.ts` and the frozen candidate test. No failing source or expectation was silently replaced.

## Not run / not claimed

Stopped before remaining mixed-owned/unowned-row, no-recipient, explicit-undefined/negative-field, real remove/readd lifetime, terminal-owner characterization, root reexposure, additional framework or combined acceptance controls. Existing packet tests do cover their narrower synthetic presence/lifetime/selection cases, but do not substitute for those product cases. No full suite, build, cost claim, activation or composition. C16's separate pending-value-work failure is untouched.

The owner-approved rule and selected-endpoint precedence remain intact as requirements. This candidate is evidence of the accessor boundary that needs review, not permission to weaken it. Plato is requested to independently review the frozen implementation and counterexample before any successor mechanism is attempted.
