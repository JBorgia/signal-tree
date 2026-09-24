# Remaining owner decisions — implementation work continues

These are externally observable choices, not permission requests for routine
repairs. Existing laws and release/public-disclosure holds remain unchanged.

| Boundary | Conservative option | Alternative | Evidence / consequence |
|---|---|---|---|
| ~~Confirmed transaction history~~ **SETTLED 2026-09-24 (95a60054)** — correctness-only is the default; diagnostics via `transactions({history:{retain:N}})`; the reader reports `truncated` from explicit metadata | Keep correctness records only while live obligations need them | Separate explicitly bounded diagnostic history | Existing reader exposes retained records; removing records without an explicit retention contract changes that observable history. Neither an arbitrary cap nor an unbounded active ledger is a solution. |
| Throwing callback plus refused compensation | Expose the same retained settlement handle on the existing error, preserving original failure evidence | Preserve the API and require prospective catch-inside-callback handling; an already-unreturned handle has no public recovery route | Public-only source and installed-v15 probes reproduce the gap. Catch-inside works for future calls, not retrospective recovery. An optional recovery member needs a public contract; disposal is cleanup, not rollback. See `/private/tmp/transaction-recovery-review/RESULTS.md`. |
| Hosted benchmark submissions | Require authenticated operator | Anonymous with real abuse controls, or remove POST | Source handlers currently create gists with server credentials. No deployment/token inspection or live attack was performed. |
| Bundle cost | Keep existing ceilings and reduce mandatory runtime cost without weakening semantics | Deliberately approve a measured budget increase after reviewing the identity/publication cost | Fresh own-property build is red: bare 10.35/10.25 KB prod, 12.48/12.45 dev; entities 23.01/22.60 prod, 25.60/25.25 dev. Bounded optimization spikes did not close the gap; no ceiling has changed. |
| Production diagnostics | Document and enforce explicit ngDevMode=false | Conditional production exports and a supported-bundler contract | Explicit define folds all five entry points without a process global. NODE_ENV-only automatic removal is not universally established. Mandatory error strings must remain readable. |
| Open-key Record topology | Dynamic descendant materialization | Whole dynamic value representation, or explicit authoring-boundary redirection | Existing types admit new keys, but runtime discards them; never-materialized descendants are absent. Prior silent type narrowing was rejected. Runtime representation and compatibility disposition require an explicit choice. |
| Proposal inspection paths | Restrict the documented path-to-value association to unambiguous application domains | A lossless structured public address or an explicit application mapping contract | Distinct literal/nested fields and entity paths can produce identical public paths and inspection statuses. Internal settlement remains distinct; a universal resolver cannot recover the target from these strings. See the dedicated path audit. |
| Independent outbound progress | Retain tree-wide hold | Source-local contribution authority, or explicit causal dependency tracking | y(1) and y(x()) have identical write evidence while x is pending. A write-location comparison cannot prove arbitrary JavaScript read independence. |

Independent progress options are materially different:

- Tree-wide hold preserves today's conservative semantics but violates the frozen
  independent-progress controls. Keeping it is containment, not L16 closure.
- Source-local authority can release an entire source that contains no pending
  contribution. It treats ordinary writes outside the operation as independently
  authoritative, including y(x()). It must never send a fabricated mixed snapshot.
- True dependency tracking requires an explicit semantic boundary; arbitrary
  JavaScript dataflow cannot be inferred from timing or write notifications.

The in-flight Link permission bypass is repaired under the existing hold. No new
progress policy was needed for that repair.

EntityMap snapshot typing no longer requires an admission decision: a type-only
source distinction permits truthful snapshot reads/writes while preserving the
existing Link admission restrictions. The unchanged negative admission tests and
new hydration typing tests pass. Supplemental packed-consumer tests then found six negative controls incorrectly
admitted by duplicate private declaration identities. That implementation defect
was repaired by sharing the declaration identity graph. Fresh packed consumers
now pass the unchanged negative controls under both bundler and node16 resolution;
independent positive/negative checks are recorded in the remediation ledger.
This does not authorize wider Link admission.

No answer to an outstanding question is inferred from elapsed time. Safe local
repairs, independent adversarial tests, and packed-artifact checks continue.
