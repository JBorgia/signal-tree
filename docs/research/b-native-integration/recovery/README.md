# B recovery alignment — owner-authorized v16 contract

Baseline: 8d220643e0d4e34cbdbc6e55e6ef692b25d5e023. Preserved comparison: 3a0d2d43f4579373cc7ea1c7ce6bcb108da6a82b. Contract analysis: 0936e62b3518f933f6794129a8c4c7b8bce761ec.

Owner explicitly corrected the top-level identity requirement. Successful abort rethrows the callback value exactly. Failed abort throws SignalTreeRollbackError with accessible recovery.transaction, callbackFailed=true, and exact original evidence in callbackError. This is the existing v16 contract, not a new public API or production semantic change.

Two prior assertions required correction, recorded in tests.mjs.diff. Their original source and outcomes remain unchanged in the comparison packet. The original top-level-identity assertion is a test-contract mismatch. The original attempt to define recovery on an occupied callback property is separately a real implementation failure: it threw unintended TypeError and lost recovery access. Neither fact is erased by the new green result.

B now allocates the established refusal error and attaches recovery to that owned object, never inspecting or mutating an arbitrary callback value. Its cause preserves the abort-preparation failure. This neutral model imports only the exact baseline error class; its transaction recovery exposes the model settlement subset (confirm/rollback), not a claim of complete production inspection/lifecycle integration. A remains unchanged.

## Results

- Corrected semantic matrix: 41 pass. Only the two explicitly conflicting error-contract cases changed; the other semantic assertions remain.
- Adversarial recovery: 14 pass, seven callback values under successful and failed abort. Values: occupied recovery, frozen Error, undefined, null, string, number, symbol. Failed-abort controls require two further failed retries, live authority and unchanged mixed scalar/entity state; then successful recovery, repeat no-op, and zero pending records.
- Independent review found a new boundary: a callback destroys the store then throws. The first revised model offered an unusable recovery handle after owners were cleared. arm-b-before-destroy-review.mjs and destroy-first.log preserve that failure. The existing destroyed-tree exclusion was added, with no replacement authority. destroy-review.mjs now passes; the 41 and 14 controls were rerun and pass.

All logs are model execution under Node24.15.0. No production or framework superiority is implied, and no new cost measurements replace the previous comparison. The production slice is recorded separately.

## Replay

Use Node24.15.0 and an exact built baseline8d220643 via SIGNAL_TREE_CONTROL_REPO (defaults to the preserved /private/tmp baseline). From this directory:

```sh
node tests.mjs "$PWD/arm-b.mjs" /private/tmp/b-semantic-replay.json
node adversarial.mjs
node destroy-review.mjs
node destroy-review.mjs "$PWD/arm-b-before-destroy-review.mjs"
```

First three commands pass. Last intentionally exits1, preserving the independent review counterexample. Original A/B and original assertions are retained in the earlier sealed packet, not overwritten here.
