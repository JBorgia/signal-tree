# Existing normalization feasibility, 2026-10-22

No runtime changes. Frozen rejected candidate untouched. This is a private-function diagnostic plus a native operation-sequence witness, not successor acceptance.

## Method

`build.cjs` extracts verbatim the live `rememberBaselineValue`, `effectKey`, `enqueueEffect`, and `toCausalEffect` closures from `packages/kernel/src/enhancers/transactions/transactions.ts`; exports only a harness feeding structural effects through those actual functions. It does not use the dead `greenfield-transactions` chain. It bundles the entire unchanged `pending-rollback.ts` with only an extra private export for `createPendingRollbackEffects`. Input structural records are handcrafted outputs required by the proposed Bind/Unbind compiler; that compiler does not yet exist. No substitute occupancy engine is implemented. The harness never exercises scalar branches (their unrelated closures are not supplied). `settleTurnMemberEffects` has no entity-structural composition branch and cannot recover an already discarded add.

Node v24.15.0. esbuild comes from frozen candidate node_modules. Original source SHA-256s in source-identities.json; all local artifact hashes in MANIFEST.sha256. No native test suite was run.

## First results

`probes.mjs`: 6 passes, 2 failures, retained verbatim in first-run.log.

Passes establish only inverse-fact preservation:
- displaced oldA remove plus B rekey retains both inverse facts;
- freshA replacing ordinary oldA retains old restore plus fresh removal (physical old active/retired is not tested by this pure folding function);
- repeated same-key fresh lifetimes cancel intermediate creation/removal;
- rekey then remove restores original key;
- repeated rekey preserves original/final key;
- round-trip rekey cancels.

Failures: same-lifetime remove then add at another/original key remains a removal. `enqueueEffect` handles add/remove, rekey/remove, add/rekey, rekey/rekey, but no remove/add. Its final `return` discards the later add. `createPendingRollbackEffects` faithfully converts the incorrect surviving removal into add; it cannot reconstruct the discarded final binding.

## Supported native sequence and proposed compilation

`native-sequence.ts` executes real native APIs with the established internal inspection participation harness:

1. ordinary oldA at a (n7), B at b (n8); hold both references;
2. inspection changeId(a,c);
3. one transaction changeId(b,a), then changeId(c,d);
4. inspect and reject.

The unchanged candidate admits these operations. After callback, IDs are d,a and d resolves to held oldA. Its current rollback restores IDs a,b, with a and b resolving to held oldA and B. There is no native failure claim for this sequence. The existing producer omits the first displacement, so it feeds two rekeys to normalization and happens to settle it correctly.

Under the proposed staged Bind compiler, step3 must first displace ordinary oldA at a, then bind B to a. The later Bind(oldA,d) sees ordinary oldA absent but still physically active at c; it must retain the new ordinary binding. The proposed stream is:

`remove(oldA,a), rekey(B,b,a), add(oldA,d)`.

`compiled-sequence.mjs` feeds exactly that stream to actual incumbent folding and rollback creation. Preserved first assertion fails: normalized output is `remove(oldA,a), rekey(B,b,a)`, rather than the required final oldA@d and B@a facts. Inverse is add(oldA,a), rekey(B,a,b), not a complete representation of the authored endpoints. Raw data and assertion are in compiled-sequence-first.log.

The assertion's particular normalized rekey representation follows this constant-payload sequence and the already-established original→final rekey fold. It is not a new public semantic decision. An alternative internal representation could be correct if it retains the same complete endpoints and payload distinctions; simply passing this compiled stream unchanged through today's fold is not sufficient.

## Implication

Bind/Unbind is not qualified merely because it fixes per-operation displacement. The compiler-to-transaction normalization boundary must preserve lifetime before/after occupancy across the whole capture interval. Fixing the physical add/relocate join alone leaves this forward authority gap. This finding does not mandate a new ownership engine; it identifies missing composition in the existing vocabulary consumer. A successor must specify the endpoint/lifecycle fold, including same-lifetime absence/reappearance and no-op cancellation, before runtime implementation. Payload changes, order participation and separate physical realization remain additional obligations, not proven by these structural probes.

## Replay

From any directory, with Node v24.15.0:

```sh
node /private/tmp/occupancy-successor-normalization/build.cjs
node /private/tmp/occupancy-successor-normalization/probes.mjs
node /private/tmp/occupancy-successor-normalization/build-native.cjs
node /private/tmp/occupancy-successor-normalization/native-sequence.mjs
node /private/tmp/occupancy-successor-normalization/compiled-sequence.mjs
```

The two diagnostic assertion programs intentionally exit 1; native sequence exits 0. Logs are separate and first outputs are not overwritten by build scripts. None is an Nx suite or release qualification result.
