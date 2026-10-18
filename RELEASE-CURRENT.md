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

1. Implement the authorized whole-write creation of new ordinary keys safely.
   The first candidate is rejected for uninstalled-allocation retention.
   Arbitrary unseen descendant handles remain a separate compatibility decision.
2. Repair the two composed-restoration requirements (six desired assertions),
   or obtain a justified explicit product disposition. Safe refusal alone is
   insufficient for these unambiguous ordinary undo cases.
3. Diagnose ten independent Link-progress matrix failures. Reconcile 57 stronger
   overlap-target failures and one authority-projection failure with documented
   consumer contracts. Keep 168 unsupported rows separately classified.
4. Freeze the resulting runtime and run fresh appropriate qualification. Existing
   verification does not discharge changed-runtime or unresolved product claims.

Owner authorized newly supplied keys for ordinary whole-value writes on October 17.
This replaces ST2010 discard for that ingress; internal inspection replay keeps
its existing unknown-key policy. Never-present descendant handles are separate. The experimental implementation is rejected after recurring retention of uninstalled
prepared payloads. Its ordinary regression remains failing; intermediate suite passes
are not final-source qualification. See [the candidate evidence](docs/audits/2026-10-17-incumbent-readiness/new-key-candidate/README.md).
The incumbent remains 8d, and no repaired runtime is accepted. Stable v15 remains untouched.

## Private-preparation follow-up

The [bounded follow-up](docs/audits/2026-10-17-incumbent-readiness/private-preparation/README.md)
passes the original retention and reentry controls, but remains unaccepted. A new
ordinary failed-transaction counterexample leaves an installed new member live
because later failure skips membership capture. Final focused result: 22 passes,
1 failure. No accepted runtime freeze; incumbent 8d and the remaining inventory
are unchanged.

## October 18 paired-membership correction

Runtime `89bfca6260cb3bc0993abb350f0f340b4e59581b` closes the tested new-key
failed-abort capture gap. [Exact verification and limitations](docs/audits/2026-10-17-incumbent-readiness/paired-membership/README.md)
record passing unchanged retention/capture controls, recovery, all four frameworks,
full suites and packed consumers. The cumulative new-key candidate remains
**unaccepted for release**: bare/entity production/development budgets fail.
No ceilings changed. The prior rejected checkpoints remain preserved; the other
readiness requirements and B's closed status are unchanged.
