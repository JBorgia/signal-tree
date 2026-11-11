# Multi-actor application state: governing implementation plan

Owner selected October 29, 2026: “Make this the first order plan and implement it.”
This decision promotes the [reviewed product direction](../../audits/2026-10-29-multi-actor-product/README.md) from research recommendation to the governing product plan. Its historical evidence and limitations are unchanged.

## Objective

Make application changes accountable and safely settleable across humans, embedded agents, browser agents, machine agents and external services. Preserve simple framework-native state use without agent infrastructure. Unknown attribution remains unknown; write ownership is not proof of input independence.

Success means a developer can implement the complete dispatch workflow with truthful review, conflict, recovery and delivery behavior through supported APIs. Passing internal experiments alone does not complete this objective.

## Authority and existing work

This instruction authorizes implementation of this direction, its isolated operation prototype and executable reference workflow. Routine implementation/checks need no repeated permission. It does not publish packages, approve unspecified exports, expand bundle ceilings, waive failures, select alternative frozen semantics or reopen B.

The existing recurrence stop requires a reviewed mechanism before another native successor. This plan does not bypass that requirement. Work continues on independent operation integration and executable consumer evidence while the kernel design gate is resolved.

This root checkout (`fix/d1-d2-forward-port`, starting `628d302d`) owns the plan and initial isolated tooling. The active native readiness checkout is `/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree`, inspected at `5727cd8f`. Its retained runtime is `87f6831f`; rejected experiments are not merged here. Root source is not substituted for that runtime. Stable v15 and unrelated edits remain untouched.

## Architectural ownership

- Kernel: installed values, membership, lifetime, order, ordinary/display distinctions, responsibility, coherent publication and settlement.
- Facades: framework carriers, scheduling and lifecycle within the agreed native timing contract.
- Optional operation integration: immutable proposal/review identity, application-supplied actor context, async correlation and remote outcomes. No shadow native-effect ledger, second rollback engine or inference of hidden inputs.
- Existing protocols: thin translation for the selected integration. Transport data never grants authority by itself.
- Application/backend: permissions, domain validation, durable command identity, conditional execution, remote compensation.
- Private Studio: diagnostics, recording and investigation. Public correctness cannot depend on it.

Keep agent run, application operation, local transaction, delivery attempt and server command identities separate. Approval consumption validates evidence at the authoritative boundary; inspect-then-confirm is not automatically revision-bound acceptance.

## Implementation order and completion evidence

| Step | Concrete output | Completion condition |
| --- | --- | --- |
| P0 | This governing plan, controller routing and executable scenario ledger | Existing scope preserved; implemented/pending status explicit |
| P1 | Isolated operation coordinator and deterministic dispatch fixture | Immutable reviews, stale-input rejection, honest unknown actor, explicit async correlation, failed/uncertain delivery and idempotent retry tested; no native authority simulated as implemented |
| P2 | Public-API bridge against identified retained SignalTree artifacts | Actual state/transaction integration; concrete missing seams preserved; no private-import workaround or pretend atomic approval |
| P3 | Reviewed native source/evidence mechanism and integration | All preserved recurrence falsifiers plus complete supported writer/recipient/lifecycle coverage pass; first failures retained |
| P4 | One real framework reference workflow and one protocol adapter | Human/embedded/browser entry paths share operations; UI-only attribution remains unknown; approval enforced by backend; installed public consumers work |
| P5 | Matched existing-stack comparison | C0 ordinary commands, C1 SignalTree, C2 companion, C3 TanStack/proposals tested against common outcomes, separate from SignalTree-specific conformance |
| P6 | Final qualification, docs, demo and release disposition | Exact candidate passes required registry/mutations/types/framework/browser/consumer checks and approved populated costs; explicit release authority required |

P1/P2 can proceed without pretending P3 is complete. They are product work, not a substitute for native capture/publication repairs. No claim of whole-product completion until P3–P6 close. New public seams require exact proposed semantics and owner disposition; do not ask for a speculative surface before a concrete consumer demonstrates the need.

## Scenarios and fair comparison

The [acceptance ledger](../../audits/2026-10-29-multi-actor-product/ACCEPTANCE.md) defines 18 scenario families. Mark executed checks per implementation; missing capability is not passed. Its proposed companion requirements are now selected for the product implementation; existing native contracts remain unchanged. Backend enforcement is demonstrated in a test authority before claiming production authentication or durable storage.

For each outcome preserve source identity, command, actual observations and limits. Separate original failures, policy mismatches, expected failures and unexecuted cases. No external performance ranking before equivalent capability. Strong alternatives may win; account for application glue equally.

## Progress record

Current candidate identities and remaining execution gates live only in
[RELEASE-CURRENT.md](../../../RELEASE-CURRENT.md). This section summarizes product
scope rather than providing a second chronological work queue.

- Research and independent premise/interpretation reviews complete; no algorithm superiority established.
- P0 is recorded. P1/P2/P4/P5 have bounded operation, installed-consumer,
  Angular/HTTP and common-outcome evidence. They establish neither a production
  authentication/durability service nor a unique common-workflow speed advantage.
  See [implementation evidence](IMPLEMENTATION.md) for those limits.
- P3 native integration and P6 library qualification reached GO for the exact
  artifact in the [readiness audit](../../audits/2026-11-10-release-readiness/README.md).
  It binds semantics, resource collection, costs, installed consumers and browser
  checks. Accepted numerical size and economic costs remain explicit.
- The owner subsequently authorized v15 backports, wider aging/comparison work,
  targeted optimizations and application characterization. The current controller
  owns that follow-through. A successor must qualify its changed artifacts; the
  earlier GO does not establish every backend or application-platform objective.

Update this section and link executable results as work lands. Do not append an unbounded chain of optional research tasks. A concrete counterexample changes the relevant mechanism or produces an explicit disposition; it does not erase the product objective.
