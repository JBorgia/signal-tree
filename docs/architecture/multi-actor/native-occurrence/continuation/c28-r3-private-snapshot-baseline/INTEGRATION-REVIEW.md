# Independent interpretation of recovered private adapter controls

**The recovered evidence supports two passing private adapter baseline controls. No blocker demonstrated to that bounded interpretation. It does not qualify a raw-reader implementation, establish public route selection, or close the earlier unsupported-route/oracle failure.** No runtime edits or new test campaign were performed for this review.

## Identity and correction

Reviewed INTEGRATION-REPORT.md, both saved fixtures, integration-first/counterpart/spec-first commands, EXIT files, logs and observations, plus the relevant adapter source and the amended private-snapshot plan. The relevant spec-type run is `runs/integration-spec-first`, distinct from the packet's earlier `runs/spec-first`.

Independently hashed the composition manifest: `2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd`. All 3,102 composition-listed paths match the present baseline candidate. This supports unchanged baseline runtime; the extra test files are outside that composition manifest. The current candidate integration spec matches INTEGRATION-FINAL.spec.ts exactly.

- INTEGRATION-FIRST.spec.ts SHA-256: `137f80728d5e6fd8076990623de2dd2f43d910cdb4eac039847d51111b4d3854`.
- INTEGRATION-FINAL.spec.ts SHA-256: `274508080f18421eff0b209bfa03795e8b26181b094f6e195bdfcf2bd5590112` (matches INTEGRATION-IDENTITY.json).

The complete fixture diff changes only the string passed to `toThrow` at line 19: `preparation reentered installation` → `Stale scalar preparation`. No state, identity, reachability or later-write assertion changes. First Nx run exits 1 with one pass/one failure and reports exactly that mismatch; counterpart exits 0 with two passes. The spec-types receipt exits 0 under the existing ratchet; it is not a claim of zero pre-existing spec errors.

The correction has a source explanation: adapter point preparation calls `frame.prepareCommit` before its later physical-clock guard (`tree-realization-adapter.ts:1045–1049`). The scalar frame already checks revision and throws `Stale scalar preparation` (`tree-scalar-slot-runtime.ts:126`). Therefore the original fixture selected the wrong guard message; no runtime repair is evidenced. Vitest's string form asserts message inclusion, not whole-message equality. These saved files/logs establish the recovered sequence; they are not contemporaneous complete per-run source manifests, so present-day baseline identity should not be overstated as cryptographic proof of every historical process input.

## P: useful private preparation refusal, not public transaction route proof

Evidence: final fixture lines 11–23 and counterpart P-direct-point observation. It directly invokes private `preparePointRealization` with an entity field reversal on key `a.b`. A spy delegates the actual `byIdOrFail` read, then injects an ordinary scalar write x=7 when its stack contains the target snapshot helper. Recorded stack reaches `snapshotCollectionEntityValue:2318` from `preparePointRealization:1016`.

The successful counterpart asserts a refusal, x=7 survives, entity value remains 1, and membership remains `['a.b']`. After removing the spy, a **fresh** plan installs/publishes entity value 0 while x remains 7; the held row then accepts value 8. The observation contains that populated final row and finalX=7. This is nonvacuous baseline evidence of refusal before the tested entity installation plus useful fresh preparation and held-reference continuation. It is not retry of the same refused plan, a public rollback assertion, or a proof of all notification/cleanup effects.

Important optimization limit: the nested write is injected by a private test interception of `byIdOrFail`; it is not shown to arise from a supported payload getter or public observer at the proposed raw-reader boundary. A raw reader that bypasses facade construction also bypasses this spy. The current test would then lose its trigger/stack assertion; retaining an otherwise-unneeded facade call merely to satisfy the spy would defeat the proposed mechanism. Preserve this baseline evidence and explicitly review successor reentry coverage at a real supported callback boundary if one remains. Do not relabel disappearance of an artificial interception as either automatic compatibility success or a public regression.

**Cheapest falsifier/status:** the saved two-case Nx counterpart was inspected, not rerun. No optimized reader exists in these records; successor behavior and equivalent reentry stimulus are untested.

## R: private lowering/placement and lifetime preservation

Evidence: final fixture lines 24–41 and both runs' R-placement observations. Setup deliberately removes ordinary membership through `__prepareOrdinaryRealization(..., physical=[])` while retaining the physical row. It supplies private descriptors and a structural add, then verifies lowering to rekey with placement. Validation reaches `snapshotCollectionEntityValue:2318` from `updatePreparedRealizationContext:2414` and leaves visible ids `['a','b']` unchanged. Application yields `['b','z']`; key a disappears, key z resolves to the exact held row, payload id remains a, and a later held n write reaches z with n=8.

This establishes a useful private adapter route and the asserted order/lifetime/key-versus-payload behavior. It does not show a public API producing that ordinary/physical divergence or selecting this lowering route. It does not cover ABA reuse by a fresh occupant, retirement/incarnation rules, hidden collection visibility or nested tap windows. The held row is obtained before instrumentation; these tests do not measure avoided facade construction on an unheld row.

The raw stack also records `hasCollectionKey` before the snapshot read. That independently reinforces the plan's warning that other paths can materialize rows even if the snapshot helper changes. R's simple payload equality does not prove clone identity/getter semantics: the source retains deepClone at the rekey callsite, but this fixture does not independently falsify clone removal.

**Cheapest falsifier/status:** saved validation/application and identity assertions pass in the inspected counterpart. No allocation counter, optimized reader, ABA or clone/reference adversary was run in this review.

## Claims and remaining gates

The report's aggregate eleven passes plus one preserved failure is consistent with the separate six-pass baseline, additional three-pass/one-failure report, and these two controls. The new controls do not repair the earlier C failure or turn repeated execution into new unique coverage. This review does not independently requalify that entire earlier packet or promote its unsupported-route interpretation to a public contract.

Before accepting a raw-reader optimization, retain the amended plan's separate gates:

1. Review the exact private collection-owned binding; no public/SDK surface or alternate state authority. These controls do not select its design or authorize implementation.
2. Preserve exact-key lifetime acquisition, current active incarnation/backing resolution, absence/physical-window/tap-depth rules, missing-row refusal and error propagation. Do not substitute effect.subjectId for the requested key or broaden visibility.
3. Keep rekey cloning and removal's reference/prepared-value preference at their existing boundaries; preserve validation, installation, publication, tracking and cleanup semantics. Getter/reference and supported reentry controls remain distinct from the present byIdOrFail spy.
4. Retain capability-absent fallback with original receiver/callable-or-value behavior. A present capability's error must propagate rather than silently fall back; that is a successor-only falsifier, not baseline evidence.
5. Establish actual new-reader reach and targeted construction avoidance on an unheld, non-prewarmed route, with attribution separate from hasCollectionKey. Two held-row private integration successes establish neither allocation reduction nor a public route, OOM explanation, timing or bundle gain.

The cheapest next verification is a separately authorized, identified successor with these distinctions explicit, not a broad replay campaign. No such verification was performed here. Main can remove the report's pending interpretation-review wording while retaining these coverage boundaries and the original failures.
