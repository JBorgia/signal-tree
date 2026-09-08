# INVALID — do not use as a control

These four fixtures were ruled **inadmissible** by independent adversarial
review before any investigation was run against them. They are retained only as
the record of the failure.

Judged "weaker than a competently instrumented NgRx application in 2026, and
weaker in ways that are specifically load-bearing rather than cosmetic."

The two disqualifying defects, both authored bias:

- **Pre-editorialized.** Backend `note` fields narrated the conclusion into the
  evidence.
- **Too easy and too hard at once.** A `warn` carrying `knownIssue: PRICE-441`
  fired at the exact millisecond of failure, making the answer greppable, while
  no invariant check existed anywhere, making the mechanism invisible.

Structurally not a DevTools export: 7 actions in 30 minutes, no
`@ngrx/store/init`, no `ROOT_EFFECTS_INIT`, no router actions, single-slice
diffs.

Superseded by [`../BUILD-SCOPE.md`](../BUILD-SCOPE.md).
