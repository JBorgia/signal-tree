# Owner selection: bounded possible-owner hold

Selected on 2026-10-26 against specification checkpoint
`7f2def3d3318f36e05724fee8ec13f01d4d9261b`.

The owner answered **"Approve bounded possible-owner hold"** to:

> May the specification conservatively hold undeclared writes with unobserved inputs against the instrumented owners already pending when the write is authored—even if some owners are unrelated? Their settlement would wake fresh ordinary-state evaluation; qualified complete declarations retain conditional progress. I recommend this bounded option. It qualifies the existing tree-local liveness contract, so owner selection is required. This approves a specification direction only, not implementation or activation.

## Selected rule

- Unobserved undeclared origin has a revision-specific conservative obligation
  against the instrumented owners pending at authorship. Possible blockers are
  not represented as proven native dependencies. Some unrelated literal writes
  therefore wait; that is the expressly accepted specification tradeoff.
- The captured window is fixed. Later unrelated owners do not extend it; current
  local gates, actual structural dependencies and a new authored revision remain
  separately applicable.
- Qualified complete declarations retain conditional progress. Native argument
  certification alone does not establish completeness of other callback inputs.
  Recipient-only uncertainty retains its adjudicated fallback and cannot impose
  another connection's hold. Known native dependencies remain lower bounds.
- Settlement wakes revision-bound eligibility without requiring a value event.
  Once actual gates clear, evaluate coherent current ordinary truth. Successful
  rejection invalidates the old ticket; a new surviving-basis evaluation may send
  the same surviving value, or the restored value. Rejection never confirms an
  old proof or revives a terminal receipt.
- Unavailable/abandoned authority and source-registry disappearance do not count
  as confirmation or successful rejection. Existing recovery, source-destruction
  and explicit-disposal distinctions remain intact.

[The selected policy specification](POLICY-DECISION.md) retains the event table,
limits, costs and alternative considered. This record supersedes the historical
"owner selection pending" wording in the unchanged reviewed design/review files.
Their hashes and first interpretations are preserved; no review is retroactively
represented as having owner authority.

## Authority limit

This selects the specification direction only. It does not authorize a runtime
successor, activation, public API acceptance, release, merge, push, publication,
budget increases or any broader tracked-read mechanism. The recurrence stop on
rejected `2dacae7b` remains active. Membership-input implementation, certificate/cache
correspondence, registration composition, mixed-undo chronology, lifecycle and
production cost remain unqualified. Production `87f6831f` and B closure are unchanged.
