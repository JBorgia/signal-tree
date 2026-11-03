# Independent native declaration review

Base247cfec7. Review in progress; no acceptance conclusion or runtime tests claimed yet.

## Source-derived critical boundaries

1. transactions.ts decorateHandle(pending, turnId) receives pendingTurnId; lifecycle events carry transactionId. They are distinct identity namespaces. Normal return4282 and failed-abort recovery4267 both decorate. The map inspectionTransactionByTurn is deleted on confirmation/rejection. Native private enrollment must use the real transactionId captured at both return sites, including no-op transactions for which pendingTurnId is undefined. Authenticity must not depend on inspect().
2. transactions.ts3698–3710 explicitly documents settlement throwing AFTER terminal compensation due to observer delivery. Rollback4148–4200 installs compensation, records rolled-back lifecycle and then may rethrow observer error. Refusal before installation publishes refused and remains pending. Publication outcome must follow native lifecycle, not settle method return/throw.
3. link.ts303–363 defines eligible as the noninspection projection, deliberately not read()-based. sendEligible710–714 reads that projection. Inspection exclusion must survive rejection fallback; a fresh arbitrary source read is not equivalent.
4. link.ts720 and789 have distinct durable-consequence gates. Releasing only the outer queue does not authorize the actual endpoint invocation after async queue steps. Each invocation retains a final evidence/revision check; in-flight completion may require a corrective later send.

Initial falsifiers recommended: no-op/ordinary owner interleaving; authentic recovery handle after failed abort; terminal rollback that throws; scalar inspection followed by dependency rejection; input accessor and then-getter nested declaration; two connections with unknown outer scope; error-reporter reentry preserving primary error identity.

## First actual source review and reproduced blocker

Inspected private.ts, loader.mjs, witness.ts and first.log in /private/tmp/link-declared-native. Enrollment correctly wraps both decorateHandle callsites with real transactionId. First logged rejection fallback fails as stated; its pending-held arrays were serialized after mutation although pass was calculated earlier. Later snapshot-fixed output avoids that reporting defect; preserve original logs.

An independent replay was created in /private/tmp/link-native-independent-review by copying private.ts and changing only the loader output directory. No worker files were edited. Node24.15.0 executed the copied native bundle.

Sequence with p pending on x:

    c.declare(independent, () => {
      inner = d.declare(independent, () => y(9));
      return Promise.resolve();
    });

Observed: outer error async-callback; c sends []; d sends [9]; inner.read() says eligible/declared. Expected d sends [] because the explicitly shared synchronous validation horizon failed. This is neither a hidden-input omission nor speculative ownership inference. It is the proposed API's explicit async-misuse conservative fallback contract.

Root cause: permissions maps each Fact/channel to its individual Frame. Inner declare pops its Frame before outer return validation. Outer catch marks only frames still on stack invalid. Consequently the popped inner Frame remains valid, and declarationAllowed releases it once the stack is empty. The frame model does not represent shared-horizon validity beyond active nesting.

Evidence: /private/tmp/link-native-independent-review/{private.ts,loader.mjs,witness.ts,bundle.mjs,receipts.json,traces.json,run.log}. Reproduction command:

    /Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/link-native-independent-review/loader.mjs

This is a blocking safety result for the first native candidate. Do not count passing literal/dependent/ABA scenarios as qualification of this boundary.

Additional inspection-only gaps, not independently replayed in this pass: the original helper still grants unscoped window evidence when every globally captured owner confirms, rather than routing undeclared calls through the original production admission; receipts do not record endpoint-started state and can report eligible after delivery; secondary declaration errors are not yet sent through onTreeError. These are visible incompleteness in first source, not additional executed counterexamples.

## Final frozen fallback candidate: independent replay

The later source restores original native conservative admission for undeclared/fallback work and records started receipt status. Therefore the earlier source-only observations about owner-window default admission and missing started status apply ONLY to first source and are not current defects. The shared-horizon blocker persists in the later root replay (inner receipt now honestly says started, but forbidden delivery still occurs).

Independently executed the frozen /private/tmp/link-native-root-replay/bundle.mjs under Node24.15.0. Output saved /private/tmp/link-native-independent-review/final-root-bundle-replay.json. No-op identity, per-connection coverage and no-write controls pass. The inspection/rejection control reproduces the public-boundary defect: y's authored eligible value is7; an inspection-only write displays99; rejecting the declared owner results in both connections sending99, expected7.

Precise cause:

- Path notifier loader annotates every entry, including participation:inspection. annotate stores its raw payload in records and latest, even when fact.unknown is true.
- complete()/refresh() return that completed latest receipt without noninspection filtering.
- loader researchRefresh checks Object.is(receipt.payload, read()); because local inspected state is99, that check passes. It then explicitly assigns eligible = receipt.payload, overwriting the native noninspection projection with99.
- The later admit() does call native conservative admission as intended, but it cannot recover the projection already corrupted by the refresh hook. Once the transaction rejects, native hold releases the inspected99.

This is not a needed change to surviving-write policy and not an application omission. The caller intentionally used inspection participation; native Link's projection contract excludes it. The mechanism has conflated responsibility refresh with payload eligibility. No fix was attempted in this review.

Exact frozen identity SHA256:

- private.ts: 7d18a5274afbebf3440c14df9aab799061d79c86fc27ce004789598c8ecfa56c
- loader.mjs: 0447c898873d74f8bc9bca6d2305dd4e6594decae4ac590b6159a6dabeb6d98b
- independent-controls.ts: c789d1892b719066650ac7780d5f05185e0a255c91bf971e852ef70568b3549f
- bundle.mjs: d7913f9bf5b273116bd4445fb4c9532430e0ac925aa3343b7818f711fc81f8e0
- receipts.json: 5922b239d0250379395affa690dfed7cefa648996ecb717d6e292e7ef1ef907b
- independent replay JSON: 767e46befaae6e6da4f1b4fef7121a18a1150d1ab44b3fd54f516a09f36c3fd5

Final disposition: reject this native candidate. Immediate declared scalar progress is demonstrated, but shared-horizon invalidation and inspection-safe projection are not preserved. Freeze the successful controls and first failures; no runtime or public API production acceptance follows.
