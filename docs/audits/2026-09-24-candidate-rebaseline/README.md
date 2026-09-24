# Current-source characterization rebaselined — same verdicts, only two still mean what they meant

Step 3, first half. The four architecture candidates and the `current` adapter
live in `tools/experiments/transaction-options/` (user-owned research, read but
not modified). `current.mjs` bundles the LIVE repo source with esbuild, so
re-running it is the rebaseline; the four candidate models are standalone and
do not move with the kernel.

Run against `849c16f4`, clean tree. Protocol's evidence gate honoured:
`runner-selftest.mjs` first (PASS — status separation, all-constructor-failure,
cleanup failure, strict unsupported exit).

    current-characterization.mjs   9 passed, 5 failed, 0 errors, 0 unsupported
    baseline (7ade0e3e worktree)   9 passed, 5 failed, 0 errors, 0 unsupported

Identical totals, and the SAME FIVE IDS. That is where a totals comparison
would stop, and it would be wrong: only two of the five still describe what the
baseline said they described.

## 1 — `R6-refused-rollback-retains-same-authority` is a HARNESS divergence

The control requires `reject()` to refuse, `x` to stay 1, and
`state(p).authority` to stay true. The adapter reports `authority: false`.

The kernel does NOT retire the turn. Verified at kernel level, by turn IDENTITY
rather than count, using the adapter's own `flushSync` timing rather than
microtasks:

    turn id created    [2]
    pending ids        [2]      after the later same-key add
    pending after      [2]      after the refusal
    SAME turn kept     true

`state().authority` is `runtime.getPendingTurnIds().includes(record.turnId)`,
and the adapter's projection disagrees with the kernel it is projecting. The
divergence is in the harness.

⚠️ Counting was not enough here either. The first kernel probe compared pending
COUNT, saw 1, and concluded agreement — a count cannot tell "the same turn" from
"a different turn". The identity check is what settles it.

## 2, 3 — `R8-01-reject-accept` and `R8-01-reject-reject` are the REAL target

These are the discriminator. The control wraps each settlement in
`settled(...)`, which asserts the result is `settled` — so a REFUSAL fails it by
construction. We refuse, correctly and safely, and still fail.

That is exactly the "H1..H9 is a floor, not a success criterion" point, now
quantified: **2 of the 8 R8 orders** demand surgical multi-writer settlement
that containment does not provide. This is what the ownership model has to buy
back, and no amount of safety work will turn these green.

## 4, 5 — `same-tick-{local,external}-flush-false`: BEHAVIOUR CHANGED, verdict did not

The baseline recorded: *"Same-tick rollback loses a later ordinary or external
write when the notifier has not flushed."* That is NO LONGER TRUE. Measured at
kernel level, all four cells:

    local    flush=false   ->  REFUSES later-confirmed-dependency   x = 2 (preserved)
    local    flush=true    ->  settles                              x = 2
    external flush=false   ->  REFUSES later-confirmed-dependency   x = 2 (preserved)
    external flush=true    ->  settles                              x = 2

The clobber is gone. The unflushed cells still fail the control because it
demands settlement, but "loses the write" became "refuses and preserves it".

## What this changes about the work list

Of the five current-source failures:

    1 is a harness defect                       R6 authority projection
    2 are the surgical-settlement target        R8-01-reject-{accept,reject}
    2 are safe refusals where settlement is
      required, improved from a clobber         same-tick-*-flush-false

So the honest summary is NOT "five behaviour failures, unchanged". It is: one
harness bug to fix in the experiment, two cases that define what 16 must
deliver, and two that got materially better while their verdict stood still.

This is the third time in this rebaseline that an unchanged verdict concealed a
changed behaviour. Compare traces and identities, never counts.

## Not yet done

The four candidate models have not been re-run against these scenarios. They
are standalone and their scores should not move, but "should not" is not
"measured". The full 424-row comparison — held stays held, unsupported becomes
genuinely exercised, publication/retention/integration correct — is still
outstanding, and must not be narrowed to the reds.
