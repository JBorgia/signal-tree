# v16 declaration receipts — integration guidance draft

This describes the approved behavior under qualification. It is not a release
announcement or a claim that the current production implementation supports it.
Promote this guidance into the package README, checked examples, demo and llms.txt
when the corresponding implementation is integrated, qualified and explicitly
authorized for activation/release.

A Link declaration describes the inputs used by one synchronous operation. It
does not transfer transaction ownership and does not acknowledge that an endpoint
has saved anything. Applications remain responsible for declaring hidden inputs
completely; runtime validation cannot discover every saved value or closure.

Use `independent` only when the operation is independent of speculative inputs.
Use `dependent` with every contributing transaction handle, including saved
values and inputs that determined which writes to make. Freshly supplied confirmed
handles still undergo validation; confirmation during a declaration does not erase
its captured dependencies. Use `unknown` when that information is unavailable; it
grants no early publication permission. A declaration cannot make an old saved
snapshot authoritative.

Callbacks must be synchronous and must not return a Promise or another thenable.
An asynchronous continuation needs a fresh declaration. Declaration failure is
not transaction rollback: installed writes can remain, and a throwing declaration
returns no receipt. Existing [owned-source restrictions](declare-api-scope-review/CURRENT-SPEC.md)
still apply; this does not admit arbitrary computed, custom or foreign sources.

The returned receipt reports that operation's publication status. In particular:

- `no-write` means the operation introduced no new effective publication work
  for that connection.
  It does not mean the endpoint has saved the current value or that earlier work
  has finished.
- An equal-value setter can still change publication obligations. Equality of the
  displayed value alone does not establish `no-write`.
- When value, current ownership, publication obligations and validation are
  unchanged, obsolete already-confirmed input history does not make a fresh
  declaration into a new operation. The earlier receipt continues to represent
  existing publication work; the fresh receipt remains `no-write`. This does not
  guarantee that the earlier operation will eventually be sent.
- Pending or rejected evidence and current validation still matter. A declaration
  does not bypass them merely because the final value equals an earlier value.
- Previously issued snapshots remain unchanged. Terminal receipts do not become
  active again because another declaration occurs.

`started` means endpoint invocation, not persistence acknowledgment. `settled()`
waits for delivery work to settle and can resolve after a transport failure;
handle reported failures through `onTreeError` and the qualified endpoint contract.
Neither receipt status nor `settled()` guarantees successful persistence or
automatic retry. Dispose connections and destroy owned trees at teardown.

## Promotion checks

Keep the public A/B confirmed-history examples, pending-owner counterweights,
validation/reentry failures, genuine no-ops, inspection adoption, entity sources,
retained snapshots and useful endpoint delivery under executable coverage.
Consumer examples must compile against the packed public package, not private
research helpers. Source review and isolated passing examples do not replace the
remaining full qualification, size, large-workload and lifecycle gates.

These are minimum checks, not activation authority. Apply the complete
[shipping qualification checklist](declare-api-scope-review/CURRENT-SPEC.md):
all included sources and framework facades, actual packed consumers, saved/control
inputs, fresh-confirmed and pending-during-call inputs, nested/thenable failures,
installed-write behavior, receipt retention/disposal, failed transport reporting,
and exact exports/source restrictions. Assert useful output and errors, not only
receipt labels.
