# Private new-key preparation: retention repaired, capture blocker remains

Parent rejected checkpoint: `cc20fcbe75a74a8d2f65a89a08d07a08068e0da7`.
Incumbent remains `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`.
Owner authorization for whole-value new keys remains valid. B stays closed.
This checkpoint is **not accepted**. Runtime changes stop at the newly reproduced
transaction-capture boundary; no release or architecture changes were made.

## Reachability trace and bounded correction

Canonical construction retains payloads before membership exposure:

1. `createTreeScalarSlotKernel.createSlot` appends to values/equalities and indexes
   the position. These are tree-lived strong owners.
2. `createTreeScalarLeafRuntime.createLeaf` retains the binding in
   `ScalarSlotPublication.bindings` and the leaf in `leafByPositionId`.
3. Position allocation/address registration retains identity topology. Active
   observation scopes can additionally retain enrolled leaves.

Deleting branch keys would not release these owners. Truncating allocations from
an attempt's start would also delete successful reentrant work. Independent review
proved the latter with an array getter that creates an inner key before throwing.

Preparation now holds only private descriptions and deferred construction closures.
It evaluates new-subtree getters, marker validation and development diagnostics
before registration. Terminal wrappers preserve the original opaque value identity;
plain branches contain private data properties. Canonical construction consumes
that validated description without repeating user-data classification/diagnostics,
and runs only when the member is actually installed. If reentry has already created
the key, the existing canonical identity is used instead. No cleanup, slot truncation,
public API, framework timing change or new allocator was introduced.

An independently found construction failure required the diagnostic step: merely
delaying construction would allocate `fresh.good` before inspecting a throwing
`fresh.bad[0]`. That pre-repair counterexample and the reentrant variant are preserved
as probes; permanent regression controls now cover both. Existing first failures and
assertions remain in the parent checkpoint and its archive.

## Unexpected failed-abort counterexample

On a transactions tree initially `{ trigger: [{ x: 0 }] }`:

```ts
tree.transact(() => tree.$({
  fresh: 123,
  trigger: [{ get x() { throw Error('equality failure'); } }],
}));
```

The call throws but `fresh: 123` remains live. The permanent ordinary regression
expects the initial snapshot after abort and fails. With `fresh: 0` initially
seeded, the same transaction restores it to 0 and passes.

`recursiveUpdate` prepares membership capture before its loop, installs the new
member during the loop, and invokes the returned `publishMembership` closure only
after the entire loop and membership reconciliation. The later equality throw
skips that closure. Automatic transaction compensation therefore never receives
the new membership contribution. This is not an assertion that every ordinary
whole write is globally atomic: it is the existing failed-transaction compensation
contract, demonstrated by the seeded control.

Independent reviewer `readiness_contract_review` found and executed this public
counterexample. The primary independently reproduced it in Nx. The private
preparation fix is insufficient for acceptance because installation still precedes
recorded responsibility at this boundary. No catch-and-publish/finally patch was
made: capture, original-error identity, observer delivery and reentry need coordinated
validation, not an assumption that a delayed callback is infallible.

Recommended next boundary: prepare membership responsibility before installation,
make it reachable with the installed membership, and separate diagnostic/observer
delivery from responsibility recording. This is a bounded mechanism to investigate,
not a new accepted architecture or an invitation to reopen B.

## Results and limits

- Original unchanged retention replay: exit 0, counts `[1,1,1,1,1]`.
- New construction-diagnostic and reentrant held-handle controls pass. Reentrant
  successful allocations remain present; subsequent rollback through a held handle
  works. No attempt-wide allocation truncation is used.
- Final focused Nx run: **22 ordinary passes, 1 failure**. The new failed-abort
  regression remains an ordinary failure; seeded control passes.
- Fresh five-project Nx run before adding the capture falsifier: kernel 5,772
  ordinary passes, 11 expected failures, 12 skips; Angular 75 passes; React 238
  passes/3 skips; Vue 105 passes; Solid 173 passes. Same runtime source, incomplete
  assertion set. These results do not qualify the now-demonstrated failing contract.
- Runtime typecheck passed. The first spec-types invocation used a nonexistent
  pnpm script and did not execute the gate. The actual gate then found three spec
  diagnostics: explicit single generic arguments prevented enhancer inference.
  Typed initial variables fixed inference without casts or assertion changes;
  the final actual spec-types gate passes with existing baseline-debt notices.
- No final artifact/demo build, lint, bundle/CPU measurement or installed-package
  qualification was attempted after the new blocker. No ceilings changed.
- Process OOM, deliberate mutation of internal objects and arbitrary failing custom
  adapters were not established as supported failure boundaries. The decisive
  inputs use ordinary public writes and throwing application getters.

## Replay and evidence

Node 24.15.0, pnpm 10.17.0; dependency symlink remains as documented in the parent.
From the dedicated worktree:

```sh
export PATH=/private/tmp/st-b-qualification-20261016/bin:/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
NX_DAEMON=false pnpm nx test kernel --testFile=src/lib/whole-value-new-keys.spec.ts --skip-nx-cache
node --import ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/loader.mjs docs/audits/2026-10-17-incumbent-readiness/new-key-candidate/replay.mts
NX_DAEMON=false node tools/check-spec-types.mjs
```

The first command must fail on the new failed-abort assertion; the second must pass
on the original retention assertion. Full suite command used was
`NX_DAEMON=false pnpm nx run-many -t test --projects=kernel,angular,react,vue,solid --skip-nx-cache`;
runtime typecheck used `pnpm run typecheck`.

`evidence.tar.xz` preserves full logs and independent probes, including failed
invocations and first-red records. `manifest.json` records file/archive hashes and
exact final runtime/spec source hashes. Historical standalone reviewer probes use
absolute source imports; the Nx regression is the durable typed reproduction.
