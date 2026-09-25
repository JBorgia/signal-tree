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
untouched. Runner self-test PASSED first, per the protocol's evidence gate.

Provenance is INSIDE the report, not only in prose — the kernel is
revision-pinned while the adapter and scenarios come from the copy, so a reader
must be able to identify both without relying on a filename:

    resolvedKernelSha   6531851f1b8d5be7607af19cdbb7f55ee3df1116
    bundleSha256        c8eac5b8a8f1f946...  (511993 bytes)
    scenario            supplied by the ENTRY POINT, with its own hash
    adapterSha256_16 / runnerSha256_16 / assertionsSha256_16 / node

⚠️ The scenario identity was briefly hardcoded in the shared adapter, so the
companion report named `current-characterization.mjs` — a scenario it had not
run. Each entry point now passes `import.meta.url`, and the companion's source
is preserved here beside its output.

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

So the merged work fixed one case outright and turned **four** value
corruptions into refusals — across **two defect families**:

    overlapping writers       R8-01-reject-{accept,reject}
    unflushed later write     same-tick-{local,external}-flush-false

(An earlier draft said "three data losses". There are four cases and two
families; the number was simply wrong.)

⚠️ **The oracle alone does not prove the refusals are SAFE.** Those controls
stop at `settled(c.reject(p))`, and when that assertion throws every later value
assertion is skipped. The JSON therefore establishes only that the operation
refuses instead of reaching the old incorrect-value assertion. Safety is a
separate dimension and is measured separately — see below.

## The remaining four are the v16 target, stated precisely

All four now fail for ONE reason: **the control requires settlement and we
refuse.** They are the cases where containment is correct but insufficient.

    R8-01-reject-{accept,reject}     2 of the 8 R8 orders: surgical
                                     multi-writer settlement
    same-tick-*-flush-false          reversal must see a later write that the
                                     notifier has not yet delivered

This is the "H1..H9 is a floor, not a success criterion" point with a number on
it: **4 of 14 current-source controls demand a settlement the incumbent
declines.**

⚠️ What that does NOT establish is WHICH MECHANISM is required. An earlier draft
said "only the ownership model can fix this"; that is an outcome measurement
being read as a mechanism proof. These four cases may well need DIFFERENT
improvements — overlapping-writer settlement and unflushed-write visibility are
not obviously the same problem. The ownership direction stands as the chosen
product decision; the mechanism is for candidate evidence to decide.

## ⚠️ The refusal companion is INCUMBENT-ONLY. Candidates use the branching checker.

`refusal-safety-characterization.mjs` asserts `firstStatus === 'refused'`.
Applied unchanged to a competing architecture that is INCOHERENT — the
settlement suite would demand settlement, this would demand refusal, and a
candidate that correctly removes the contribution would be penalised for
succeeding. It is a regression characterization OF THE INCUMBENT and nothing
more.

`settlement-or-refusal-conformance.mjs` is what candidates are judged by. It
branches on the ACTUAL result, with the successful-settlement expectations
unchanged from the frozen scenarios:

    refused      state unchanged, same pending authority retained,
                 no forbidden publication
    settled      correct surviving state, targeted authority TERMINAL,
                 unrelated authority preserved, coherent publication
    unsupported  an explicit capability gap, recorded and not counted against
    error        its own failure, NEVER relabelled a refusal

Demonstrated to branch, not merely to pass:

    at 6531851f   outcomes all `refused`   -> refusal guarantees   -> 0 violations
    at 7ade0e3e   outcomes all `settled`   -> SETTLEMENT guarantees -> 4 violations,
                  each "settled with wrong surviving state"

The old implementation is judged on settlement and fails on STATE. It is not
penalised for failing to refuse. A candidate that settles correctly passes.

## Refusal safety, measured separately

`refusal-safety-AT-6531851f.json` records what survives each refusal, WITHOUT
weakening the successful-settlement oracle above — weakening it is what would
hide the gap:

    case                             refuses  state     refused   other     later write
                                              unchanged  keeps     keeps     preserved
                                                         authority authority
    R8-01-reject-accept              yes      yes       yes       yes       n/a
    R8-01-reject-reject              yes      yes       yes       yes       n/a
    same-tick-local-flush-false      yes      yes       yes       n/a       yes
    same-tick-external-flush-false   yes      yes       yes       n/a       yes

In both R8 cases the OTHER handle then settles cleanly.

**Publication IS isolated where the fixture allows it.** For R8 everything
earlier is already flushed, so the observation boundary can be taken
immediately before the rejection, and a flush after it attributes anything
delivered to the refusal:

    R8-01-reject-accept              publishedByRefusal = 0   verified
    R8-01-reject-reject              publishedByRefusal = 0   verified
    same-tick-local-flush-false      NOT MEASURED             unverified
    same-tick-external-flush-false   NOT MEASURED             unverified

The same-tick cases deliberately leave the earlier write unflushed, so a flush
after the refusal delivers that write AND anything the refusal did with nothing
to separate them. That needs a matched control running the identical scenario
WITHOUT the rejection. Until it runs, those two are explicitly `unverified`
rather than assumed clean — an earlier draft said isolation required an adapter
marker, which was wrong; it required a better fixture.

**These properties are REQUIRED, not merely recorded.** The companion exits
non-zero on any violation, which does not weaken the settlement oracle — both
results are meant to stand together:

    successful settlement required      -> FAIL  (4 of 14)
    refusal preserves state/authority   -> PASS  (0 violations)

A candidate that won the first by abandoning the second is caught by the second
rather than celebrated by the first.

Sensitive, proven against history rather than by injection — the adapter reads
committed source, so the mutation is a revision. Repointed at `7ade0e3e` the
same suite reports **16 violations, exit 1**
(`refusal-safety-AT-7ade0e3e.json`).

⚠️ That is a REGRESSION SENSITIVITY control, not an isolated mutation proof.
Switching revisions changes many things at once. It shows these checks detect
historical bad behaviour; it does NOT show that each individual assertion is
independently necessary.

⚠️ PUBLICATION SCOPE. `observe()` is flush-driven and filters unchanged
snapshots, so `publishedByRefusal = 0` means NO CHANGED SNAPSHOT WAS DELIVERED
THROUGH THAT PROJECTION. It is not a claim about native notification counts, nor
about intermediate states that never reached a flush boundary.

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
