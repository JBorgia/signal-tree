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

---

## OPEN — v15 dormant-transactions performance investigation (added 2026-09-25)

> **CORRECTION 2026-09-25 — the guarded spike cited below is UNSAFE and is
> withdrawn as a repair.** It gated notification EMISSION on "a transaction is
> live". Emission also feeds `link()`, restoration, devtools, provenance,
> write-observation and diagnostics, not only transactions. With that guard, an
> ordinary write in a dormant tree NEVER reaches a Link endpoint
> (`l19-guard-link-safety.mjs`: unguarded delivers `[7]`, guarded delivers `[]`).
> Its "-56% dormant" was partly bought by silencing every other consumer. The
> spike only ever checked rollback, so this went unseen. Any emission guard must
> be keyed on "some consumer needs this owner's notifications", not on
> transaction liveness.
>
> The observer-registration half is a SEPARATE, safe change and is already fixed
> on main in `45f4ed8e` -- the observer only builds a snapshot copy and never
> affects delivery.

**Decision:** whether to open a v15 investigation and likely PATCH RELEASE for
the cost of `transactions()` when installed but idle.

**Framing, deliberately narrow:**

- This is a possible v15 **performance** update. There is **no demonstrated v15
  correctness fix**, and nothing here claims a data-loss defect in shipped code.
- It does **not** warrant changing v15's public API.
- It is **conditional on reproduction** on the released v15 branch. Everything
  measured so far was on the workspace tree.

**What was measured (workspace, not the release branch):** installing
`transactions()` and never opening a transaction cost **+223%** on 200k ordinary
writes. `batching()` on the same write path costs ~0%, so this is specific to
the transactions implementation rather than to enhancers or the substrate.
Ablation attributes the largest share to notification EMISSION at
`owned-mutation.ts:206`, installed by `wrapOwnedWritableSignal` when the build
plan carries `mutation-capture`. A guarded spike measured, with trial spread now reported:

    level              BASELINE            GUARDED             delta
    dormant      72.3ms relIQR 14.6%   31.9ms relIQR 23.9%     -56%   ROBUST
    active-1%   101.6ms relIQR 26.3%   82.9ms relIQR 12.5%     -18%   within noise
    active-100%  985.5ms relIQR 8.2%  1007.3ms relIQR 13.8%     +2%   within noise

Comparing each arm's IQR against the between-arm delta is NOT a test of the
difference, so that comparison is withdrawn. The arms were measured in
alternating order within each trial and are therefore paired; the paired
per-trial differences are:

    level         paired delta (GUARDED - BASELINE)
    dormant       median  -39.0ms  range [ -53.3,  -30.6]  faster in 8/8 trials
    active-1%     median   -4.5ms  range [-287.5,  +23.6]  faster in 7/8
    active-100%   median  +12.9ms  range [-113.6, +271.1]  faster in 3/8

ESTABLISHED IN THIS RUN: the dormant improvement. All 8 measured pairs favour
the guard, by 30.6-53.3ms, and the entire range of paired differences is
negative.

The scope of that word is deliberate. Pairing by trial index accounts for drift
BETWEEN ARMS THAT SHARE THE SAME RUN CONDITIONS. It does not extend the claim to
other machines, other Node versions, or a fresh run, and it does not replace
replication. A production candidate must reproduce this independently.

NOT ESTABLISHED, in either direction: active-1% and active-100%. Their paired
differences change sign across trials, and active-100% favours the guard in only
3 of 8. These remain MEASURED MEDIAN DIFFERENCES that this run does not show to
be repeatable -- which is not the same as showing them to be zero. Establishing
them needs repeated independent runs, not a larger single run.

**Sequence, if taken up. Do NOT backport the experimental ablations — they are
semantics-breaking mutants built to answer cost questions.**

    1. reproduce the dormant benchmark on the RELEASED v15 branch. If the
       released write path differs, the rest does not apply.
    2. only then port a guarded implementation, and only if it
         - enables capture BEFORE the first causal write
         - keeps it enabled until every pending transaction AND consequence
           resolves
         - passes the existing transaction tests unchanged
         - improves dormant writes without unacceptable active cost
    3. patch release, if 1 and 2 hold

**L19 IS NOT CLOSED by this spike.** The guard is PROCESS-GLOBAL and raised
MANUALLY by the test. A production candidate additionally needs:

    tree-scoped activation AND deactivation, not a process flag
    tests for OVERLAPPING turns
    tests for pending CONSEQUENCES outliving their turn
    comparison against an UNENHANCED tree, not only against enhanced-baseline

**Why step 2's first two conditions are not boilerplate:** the guard spike
demonstrated the failure mode directly. Raised ONE STATEMENT too late, the
rollback still reported success while the value did not revert — causal evidence
lost silently, invisible to any timing benchmark.

To be unambiguous: that was a DELIBERATELY INCORRECT MUTANT. It is evidence
about how this repair could be implemented badly. It is NOT evidence that
released SignalTree silently loses rollback data, and must not be cited as
such.

Evidence: `docs/audits/2026-09-25-radical-alternatives/` —
`l19-dormant-cost`, `l19-ablation-0b`, `l19-ablation-2`, `l19-dormant-guard`,
`l19-profile-diff.md`.
