# Current-source characterization — CORRECTED after a source-selection error

> **RETRACTION.** The first version of this file claimed a rebaseline against
> `849c16f4` and drew two conclusions from it: a harness defect in the adapter's
> authority projection, and a "safe refusal" reading of the R8 failures.
> **Both were wrong, and so was the premise.** `current.mjs` does not bundle
> live source. It pins
>
>     export const baseline = '7ade0e3ecb25ff0d06da4355b5f7d67844e147b7';
>
> and its esbuild plugin — named `frozen-current-source` — loads every
> `packages/kernel/src/**/*.ts` through `git show ${baseline}:${path}`. That run
> measured 7ade0e3e. I read `esbuild`, `root` and `execFileSync` in the imports
> and concluded "bundles the live repo", never asking why a bundler needs a
> subprocess. The answer was `git show`.
>
> **The checkout's HEAD is not necessarily the code an experiment executes.**
>
> Everything below is re-measured with the revision explicitly selected, and the
> two runs are kept separate and labelled.

## Two runs, two revisions

| file | kernel source | result |
|---|---|---|
| `current-char-AT-7ade0e3e.json` | `7ade0e3e`, the frozen pin | 9 passed / 5 failed |
| `current-char-AT-6531851f.json` | `6531851f`, current HEAD | **10 passed / 4 failed** |

The current-source run used a COPY of the frozen experiment with `baseline`
repointed, placed in a gitignored sibling directory so the frozen experiment is
untouched. It records what it loaded:

    [source-selected] baseline=6531851f1b8d5be7607af19cdbb7f55ee3df1116
                      bundleSha256=c8eac5b8a8f1f94638d1751a6a2bc75bd59d01454bb26166a52fa3b3d1478764
                      bytes=511993

Runner self-test PASSED first, per the protocol's evidence gate.

## What actually changed between the two revisions

**One control moved outright.**

    R6-refused-rollback-retains-same-authority   failed -> PASSED

At 7ade0e3e it failed `false !== true` on `state(p).authority`: the old kernel
retired the turn on a refusal. Current source keeps it. **There is no adapter
harness defect.** I invented one by comparing an old-kernel adapter result
against a new-kernel probe and treating the disagreement as a projection bug.

**Three silent corruptions became safe refusals.**

Every remaining failure changed its FAILURE MODE, which a pass/fail column
cannot show:

    case                          at 7ade0e3e        at 6531851f
    R8-01-reject-accept           0 !== 2            'refused' !== 'settled'
    R8-01-reject-reject           0 !== 2            'refused' !== 'settled'
    same-tick-local-flush-false   0 !== 2            'refused' !== 'settled'
    same-tick-external-flush-false 0 !== 2           'refused' !== 'settled'

`0 !== 2` is a VALUE assertion reached AFTER `settled()` passed — the settlement
succeeded and destroyed a later write. `'refused' !== 'settled'` fails at
`settled()` itself — nothing was destroyed, the operation declined.

So the merged work turned three silent data losses into refusals, and fixed a
fourth case outright. That is a real improvement the totals row hides.

## The remaining four are the v16 target, stated precisely

All four now fail for ONE reason: **the control requires settlement and we
refuse.** They are the cases where containment is correct but insufficient.

    R8-01-reject-{accept,reject}     2 of the 8 R8 orders: surgical
                                     multi-writer settlement
    same-tick-*-flush-false          reversal must see a later write that the
                                     notifier has not yet delivered

No safety work turns these green. Only the ownership model does. This is the
"H1..H9 is a floor, not a success criterion" point with a number on it: **4 of
14 current-source controls demand settlement we decline.**

## Method notes worth keeping

- The frozen experiment was NOT modified. The revision-selected copy lives in a
  gitignored sibling; only its OUTPUT is committed here.
- Record the resolved SHA and a hash of the loaded bundle in any run whose
  source selection matters. Neither run would have been ambiguous if the first
  had done so.
- An unchanged verdict can conceal a changed behaviour, and a changed verdict
  can conceal a changed SOURCE. Both happened in this one investigation.

## Not yet done

The four candidate models have not been re-run. They are standalone and should
not move with the kernel — but "should not" is not "measured", and this file is
the record of what that assumption costs. The full 424-row comparison remains
outstanding and must not be narrowed to the reds.
