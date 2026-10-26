# Root verification and interpretation addendum

The final runtime review was checked against source and replayed, not accepted by
reviewer verdict alone. Source was frozen without a runtime patch after the
independent omission counterexample. Final conceptual checkpoint:
`2dacae7b9e9137018d05c4e00382ac9287bc76d4`.

## Native omission recurrence

Root inspected private.ts nativeInputs, member-membership's enumerability
contract, the immutable isolated fixture, and the native requirement installation.
The pending omission fact is recorded, but Object.keys(storage) skips its dormant
child. Independently overwriting the visible sibling removes incidental support;
the updater's explicit membership query then fails to carry the omitted fact.
The root replay ROOT-FALSIFIER.log reproduces sent [0], started/declared, while p
is pending. The truthful dependent control succeeds. This is an observable native
updater argument, not an application-hidden-input omission. The original test
and first failure remain unchanged. Covered input-domain recurrence blocks this
candidate; no further patch was applied.

## Fresh predecessor comparison corrects a qualification

DEFAULT-CONTROL.log is a fresh exact-runtime predecessor run at
`8212736242e1f85f7e3288dbb0ebda99a575e3b2`. It runs the unchanged
link-native-address.spec.ts. Result: nine pass, one fail. The predecessor satisfies
line151's no-send-before-confirmation assertion, then fails line154 because it
still sends nothing after confirmation. The successor fails line151 instead:
sent [7] before confirmation. Its later assertions are not reached.

Therefore the successor introduces premature publication relative to this control,
but the whole test was NOT green on this exact predecessor. Any historical or
review wording suggesting a wholly passing predecessor is superseded by this
fresh comparison. This is an early-publication regression plus an existing
progress failure, not two identical failures or a fully working baseline.

Root read admit/project and verified the missing causal input edge. The removed
pending blocker list had held this unobserved copy conservatively; it had not
proved its dependency. The adjudication for unrelated foreign activity cannot
be used to call an actual pending copy safe. The separate design/contract choice
is described in BOUNDARY-TRACE.md; no scope change is made here.

## Other qualifications

- Three private-hook tests stop at duplicate registration, before the relevant
  fault/payload assertions. Those assertions are unexecuted, not safety passes.
- Mixed-undo stale output (11 rather than callback-authored 777) is preserved
  broader failure, not newly attributed to this four-file successor.
- New native18 initially used an invalid unchanged-inspection-status assertion.
  Native ordinary replacement legitimately supersedes the pending field.
  Independent review and existing inspection controls support the corrected new
  fixture; original source and all eighteen first reds remain archived. No old
  regression was edited to hide this result.
- The owner explicitly authorized only enrollment16's passive-connection oracle
  correction: separate legitimate surviving fallback from borrowed declared
  permission. Every c1 useful-publication/declared-basis assertion is preserved.
  Original16 remains in source and was rerun unchanged. Original pass/fail totals
  have not been rewritten.
- The final source typecheck exits0. Spec-types passes its unchanged ratchet;
  that is not a claim of zero global spec diagnostics. First type failures remain.

No full kernel/framework suites, lint, artifacts, budgets, timings or heap/GC
qualification ran for this rejected successor. Native records are now installed
without recipients, so cold-writer cost and retention remain explicit unknowns.
