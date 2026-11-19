# Opaque saved payload plus current holder: preregistered baseline

Four test-only controls. Preregistered before execution in PREREGISTRATION.md against the supplied CACHED-INPUT-ADJUDICATION.md. No R1 source inspected, no runtime or assertion edits, no retry. This is baseline evidence for the proposed conjunctive handoff, not R1 acceptance.

| Control | C27 | runtime-only C28 |
| --- | --- | --- |
| Name only payload owner r; current holder owner s must not disappear | FAIL: send after r confirms while s pending | same FAIL |
| Name only holder owner s; saved payload owner r must not disappear | PASS: contradiction; no send after s confirms; one 7 after r confirms | PASS |
| Name both r and s | PASS: no error; holds until both confirm, then one 7 and settled | PASS |
| Saved payload predates new q on original source | FAIL: contradiction/hold until q confirm | PASS: sends 7 before q confirm, no error or duplicate |

Exact first results: C27 2 pass / 2 fail, exit1; C28 3 pass / 1 fail, exit1. Both timeout=false. Logs and observations preserved under runs/{c27,c28}; no broad tests/spec-type gate run. Vitest execution alone is not type qualification.

## Sequence and useful assertions

r transaction changes source x from0 to7; save its root object while r pending. s transaction assigns that exact saved object into an existing opaque holder leaf initially containing a distinct `{x:0}`. Thus s is genuine changed current location ownership, not an equal historical-owner assumption. Public holder.updateAndReport callback receives the same saved identity and writes its x into linked target y, returning {} (no second holder admission). Three declarations name r, s, or both. Confirm the sole named owner first; the omitted owner remains pending. Confirm second, settle/drain, then dispose connection and write local8 to ensure cutoff.

All three variants on both baselines record callback count1, exact supplied payload identity, unchanged owner inspections before settlement, no initial send, final [7], and no post-disposal delivery. The r-only first failure is `opaque-current-input.spec.ts:45`, afterFirst expected[] received[7]. Its error was null in the pre-assert diagnostic. Assertions later in that failed test are blocked, so final/disposal [7] there are recorded observations, not claims that those later assertions ran. In the s-only and both cases, all assertions ran and passed.

This r-only case is an inherited safety gap relative to the approved conjunctive premise: the saved payload certificate preserves r but cannot substitute for current holder responsibility s. It is not a new C28 regression and not evidence to waive the requirement. Both declaration names explicitly contributing both holds proves useful progress and prevents a vacuous all-blocked success.

The fourth control saves source pair7 before q exists, holds it as opaque payload, then genuinely consumes pending q to author equal7 in the ORIGINAL source. A new holder updater intentionally consumes the OLD payload. It must not be recertified from current original source. C27 first failure at :80: before expected[7], observed[]; diagnostic records contradiction and final[7]. C28 passes all assertions. This is the separately requested saved-payload oracle, not a revision to the earlier fresh-input fixture whose saved contrast was observation-only. It distinguishes historical payload isolation from fresh source-current acquisition.

All operations use the public kernel facade, including leaf marker, transaction handles, real updaters and Link declarations. No private inspection/proof/comparator injection. Exact payload values and identity, callback counts, owner inspections, holds, terminal delivery, settlement and disposal are checked; no getter-based object probe or exhaustive reentry matrix claimed.

## Identities and reproduction

Own copies each reconstruct all3086 C27 manifest paths with only this test overlay and root node_modules symlink. C27 manifest SHA256 bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd. Runtime-only C28 manifest SHA256 00d6f0acb5d8c6cec6f5f9c8e8537194dd25cb6624516f2c211f47d11a441212. Only private.ts/lifecycle.ts differ from C27, verified against author FROZEN-IDENTITY.json uninstrumentedRuntime hashes before capture. No diagnostic author exports imported or added.

Runtime-only private.ts SHA256 5092a2070639e8c3805810997a33ab56dd51b2f400d57f1af6254520e8952a30; lifecycle.ts 8e3586ff65602c8e85eff2a7ce2621c1f396fcbf5ed8de5f73c8f422e995b796. Both copies verified unchanged before/after each run; fixture unchanged. Captured author identity and adjudication preserved. No author/root writes.

Pinned Node24.15.0 / pnpm10.17.0, per-run Nx cache/data/temp and observation sink:

```sh
corepack pnpm nx test kernel opaque-current-input --skip-nx-cache --maxWorkers=1
```

COMMAND.json/PROCESS.json/RESULT.json retain exact invocation, environment, process identity, exit and hash checks. First logs retain archived tsconfig diagnostic noise without suppression. TESTS.patch is the unchanged four-case packet; SNAPSHOT.json hashes evidence. Stop here: failed controls remain available to independently qualify R1 without changing expectations.
