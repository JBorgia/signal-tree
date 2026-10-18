# Current work — incumbent v16 readiness

Updated October 17, 2026. Dedicated branch `codex/v16-incumbent-readiness`.
Incumbent baseline: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`,
version **16.0.0-dev**. No repaired runtime is frozen yet.

The previous integration controller is preserved in baseline Git history.
Original checkouts and research specs remain untouched. B's replacement track
is closed at `17e1a76f`; its evidence is not an active repair queue.

## Authorized work

Establish a finite release contract: supported behavior, known limitations,
required repairs and exact acceptance checks. Start with open-key public
contracts, then restoration limitations and semantic-matrix scope. No release,
merge, push, activation, tag, publication or unrelated architecture/API change.

See [the readiness inventory](docs/audits/2026-10-17-incumbent-readiness/README.md)
and its complete row-level matrix classification. Public compatibility decisions
remain owner decisions; current implementation behavior does not define scope.

## Completed evidence

[Exact-8d verification and costs](docs/research/v16-candidate-acceptance-0/RESULT.md)
are retained byte-for-byte from evidence-only `774dfd7f`. The 84/84 registry,
84/84 mutation proofs, rebuilt installed-artifact checks and 136/136 browser
results apply to 8d, not future runtime changes. Approved size ceilings pass;
measured transaction and heap overhead remain explicit tradeoffs.

A clean isolated baseline is established. Read-only investigations and raw-record
checks classify the matrix without changing assertions. The prior focused run
reported 35 ordinary passes and 8 expected failures. No broad suite was rerun
for this documentation-only readiness inventory.

## Remaining acceptance work

1. Resolve open-key compatibility: types promise whole Record replacement and
   arbitrary descendants; runtime drops new keys and returns undefined for
   unseen descendants. ST2010 behavior and protocol keys need explicit treatment.
2. Repair the two composed-restoration requirements (six desired assertions),
   or obtain a justified explicit product disposition. Safe refusal alone is
   insufficient for these unambiguous ordinary undo cases.
3. Diagnose ten independent Link-progress matrix failures. Reconcile 57 stronger
   overlap-target failures and one authority-projection failure with documented
   consumer contracts. Keep 168 unsupported rows separately classified.
4. Freeze the resulting runtime and run fresh appropriate qualification. Existing
   verification does not discharge changed-runtime or unresolved product claims.

The open-key whole-write decision is pending. No runtime/types/test assertions
have been changed to make the inventory pass. Stable v15 remains untouched.
