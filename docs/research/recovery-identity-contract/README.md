# Recovery identity and access: contract conflict

B remains the leading integration hypothesis. No model or production change is accepted by this record. The existing contract cannot satisfy the research fixture's literal demand that the original callback value remain the top-level throw while otherwise unreturned recovery authority remains publicly accessible for every thrown value.

## Existing contract versus fixture

At exact incumbent `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`:

- Successful automatic abort rethrows the callback value exactly.
- Failed automatic abort throws the existing `SignalTreeRollbackError`. Its `recovery.transaction` is a usable pending handle; `recovery.callbackFailed` is true and `recovery.callbackError` preserves the callback value exactly, including undefined.
- This does not mutate the callback value. A frozen callback Error, occupied recovery field, primitive, or null does not obstruct the supported mechanism.

Authority: owner-approved commit `475ee17b2835cefc43f093ae4c401d2258b5a2d5`; `packages/kernel/src/enhancers/transactions/recovery-handle-0.spec.ts` introduction and cases 1–3; `packages/kernel/src/lib/types.ts` SignalTreeRollbackRecovery and SignalTreeRollbackError; `transactions.ts` automatic-abort catch. These source decisions predate the research fixture. The phrase “existing error” in that decision refers to the rollback refusal, not the callback value.

The prior fixture's `CONTRACT.md` and unchanged case41 instead demand the callback value at top level after failed abort. That stronger rule was not derived from the incumbent. It remains an unchanged falsifier, not silently rewritten as an incumbent-contract test.

No supported alternative access path was found: TransactionMethods exposes transact(fn) returning a handle only on return; lifecycle readers expose IDs and observations without settlement authority; private __transactions exposes IDs/counts; onTreeError explicitly provides reporting, not recovery. An identity-preserving primitive throw cannot carry a property. An inaccessible internal side table would not solve access. Adding a retrieval API or out-of-band handle channel requires a public contract decision.

## Executed evidence

`probe.mjs` uses the exact built incumbent and the existing validateEffects structural-drift fault seam used by recovery-handle-0. This is controlled fault injection, not an ordinary application trigger.

Seven callback values: nonconfigurable occupied recovery property, frozen Error, undefined, null, string, number, symbol.

- Incumbent: 14 assertion controls pass (seven values × successful/failed abort).
- Failed-abort controls verify original callback evidence by Object.is, public inspection, pending authority and speculative state; two refused retries preserve pending authority and scalar state; removing the fault permits rollback that restores scalar/entity membership and retires authority; another retry is a successful no-op.
- Unchanged A and B: seven additional literal identity/access failures each. Occupied recovery replaces the original error with TypeError. The other six preserve the top-level value but expose no recovery handle. Responsibility and speculative value remain internally retained until test teardown.
- Unchanged original matrix replay: A 40 pass / 1 fail; B 40 pass / 1 fail. Case41 and all original assertions remain byte-identical.

The probe intentionally exits 1 for the preserved model failures. It is not a production test-suite failure count. It does not certify broader notification, held-reference or recovery atomicity behavior. Full suites and B production integration were not executed because the identity/access contract decision is unresolved. No API, model, production, v15 or budget edit occurred.

## Independent scrutiny

An independent reviewer inspected the exact baseline/current types, tests, history and alternate access surfaces without editing code. It confirmed the distinction between callback identity and rollback-refusal identity, then reviewed the raw probe and outputs. Root verified the cited public types, catch path, lifecycle/reporter limitations, and all baseline emitted-JS hashes against the prior frozen seal. The reviewer noted the probe does not assert entity membership at every failed retry nor notification/held-reference behavior; no such broader claim is made.

## Decision needed

Recommended reconciliation: retain the existing v16 error contract. Preserve callback identity in recovery.callbackError when automatic abort fails; retain exact top-level identity when abort succeeds. This uses the already supported refusal mechanism, not a new wrapper API. With explicit owner confirmation, a separate B candidate can implement that contract while case41 remains preserved as evidence of the superseded research requirement. A remains frozen as comparator.

If top-level callback identity must also hold after failed abort, a new publicly accessible recovery channel is necessary. Do not proceed with integration or invent that channel under the present authorization.

## Replay

Use Node 24.15.0 and the exact built baseline. From this directory:

```sh
SIGNAL_TREE_CONTROL_REPO=/path/to/built-8d220643 SLICE_DIR="$PWD/../authority-vertical-slice" node probe.mjs
node ../authority-vertical-slice/tests.mjs "$PWD/../authority-vertical-slice/arm-a.mjs" /private/tmp/recovery-a.json
node ../authority-vertical-slice/tests.mjs "$PWD/../authority-vertical-slice/arm-b.mjs" /private/tmp/recovery-b.json
```

Use an absolute SLICE_DIR path: the probe converts filesystem paths to file URLs. The saved invocation used `/private/tmp/st-sparse-integration-baseline-8d220643` and the existing isolated worktree's authority-vertical-slice directory. All three commands intentionally exit 1. Provenance identifies the unchanged models, baseline artifact files and source parent; raw JSONL and original matrix logs are alongside this record.
