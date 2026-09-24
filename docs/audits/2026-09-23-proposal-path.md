# Proposal path ambiguity — public review boundary

`ProposalChange.path` can have the same spelling for different contributions.
The tested internal classifications and ordinary scalar rejection distinguish
those contributions correctly. The public `{ path, status }` projection does
not always identify which current value belongs beside the status.

This is a bounded qualification of AGENT-UX-REFERENCE-0, not an internal rollback
corruption finding. No path encoding, grammar, API, type or prototype was changed.
This concerns the current v16 Proposal surface; v15 has no Proposal API.

## Pure public two-history counterexample

The following uses only the public kernel facade and ordinary current-state
reads. It does not read internal effects, identities or notifier state.

```js
import { signalTree, transactions, external } from '@signal-tree/kernel';

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

async function observe(target) {
  const tree = signalTree(
    { 'a.b': 0, a: { b: 0 } },
    { enhancers: [transactions()] }
  );
  try {
    const proposal = tree.propose(() => {
      if (target === 'literal') tree.$['a.b'](1);
      else tree.$.a.b(2);
    });
    external(() => {
      if (target === 'literal') tree.$.a.b(2);
      else tree.$['a.b'](1);
    });
    await flush();
    const state = tree.$();
    const inspection = proposal.inspect();
    proposal.reject();
    await flush();
    return { state, inspection, afterReject: tree.$() };
  } finally {
    tree.destroy();
  }
}

console.log(await observe('literal'));
console.log(await observe('nested'));
```

Both histories have exactly the same pre-settlement public observations:

```js
state = { 'a.b': 1, a: { b: 2 } }
inspection = { changes: [{ path: 'a.b', status: 'current' }] }
```

The contribution's correct current value is **1** in the literal-key history and
**2** in the nested-key history. Rejection correctly restores only the owned
location: `{ 'a.b': 0, a: { b: 2 } }` versus
`{ 'a.b': 1, a: { b: 0 } }` respectively.

Thus neither status, list position nor the entire current snapshot resolves the
ambiguity. A review consuming only `inspect()` and current state cannot determine
which value to associate with this change. Extra application context would be
required; replacing the application's dot-split implementation alone cannot
recover information absent from these identical observations.

## Additional public controls

Three controls put both colliding targets in one proposal. Initially inspection
contains two identical `{ path, status: 'current' }` records. An external write
to only the first target changes only its classification to `superseded`; the
second remains `current`. Their current values are 9 and 2.

| First target | Second target | Shared public path |
|---|---|---|
| Literal `['a.b']` | Nested `.a.b` | `a.b` |
| Collection `rows`, ID `a.b`, field `name` | Collection `rows.a`, ID `b`, field `name` | `rows.a.b.name` |
| Collection `rows`, ID `a.b`, field `name` | Same collection, ID `a`, literal field `b.name` | `rows.a.b.name` |

These controls prove distinct internal classifications despite public spelling
collisions. They do not establish general settlement conformance. An initial
extra entity-rejection assertion encountered conservative refusal; its script
and error are preserved separately. The final entity controls assert inspection
only. Ordinary scalar rejection remains a successful ownership control.

## Documentation authority and product scope

[AGENT-UX-REFERENCE-0](../research/agent-ux-reference-0.md) deliberately calls path
behavioural API for associating status with application state. Commit
`644bb92b8ab7da65f934e4c1ca89f1772e7526e0` added that qualification while explicitly
disclaiming a universal path resolver. The historical seven-case result remains
evidence for its tested domain, not for every legal key vocabulary.

The public declaration in
`packages/kernel/src/enhancers/transactions/transactions.types.ts` deliberately
omits identity tokens and cites PROPOSAL-REVIEW-SURFACE-0. That proof distinguishes
same-path lifetime scenarios by different statuses; it does not cover the
identical-status, distinct-target histories above. The actual public projection
in `transactions.ts` emits only `effect.path` and its computed classification.

The demo reference's `readByPath` in
`apps/demo/src/app/agent-review-reference.spec.ts` splits dots and takes the first
segment after `orders` as the entity ID. Its seeded ID is `7841`, not a dotted ID.

The path-to-current-value product proof is therefore **domain-limited**: the
application must have unambiguous public path spellings or additional target
context beyond this public projection. With collisions, path can serve as a
display label but cannot be inferred to be a unique identity or value lookup key.
This is a limitation of the demonstrated proof, not a newly imposed restriction
on valid state keys. It would be inaccurate to claim that existing documentation
had always treated path as presentation-only.

## Exact evidence snapshot

The four scenarios passed against captured current source and the installed
16.0.0 tarball. Their JSON outputs were byte-identical; both executions exited 0.

- Source capture: `/private/tmp/proposal-path-audit/source`; 654 captured files,
  matching live files when checked. Source manifest
  `/private/tmp/proposal-path-audit/source-hashes.json` SHA256:
  `54783ba178857bd5d0be0eb013d1a5d62d3102674f2c3db4bb3da03b4972bff0`.
- Captured `transactions.ts` SHA256:
  `f16ce152e977965505ba853766eb62b1d15ae43b06eb8eeacdd7400f2d71eefe`.
- Captured `transactions.types.ts` SHA256:
  `00d348c59da85b72bc13051bef966f17720c65e0a5ffa31d0764d4e6dfaa9d83`.
- Captured `position-registry.ts` SHA256:
  `0f0270979ab11a1d0309c2ffefe9e87bb8eb456c49c061aafb299b962a871184`.
- Tested kernel tarball SHA256:
  `7f952abd757dc7a07b0621b8dd154c4e6e23be89a7f607e24785c25f9280bdb0`, from
  `st-consumer-tsc-pcFP6m/signal-tree-kernel-16.0.0.tgz` under the OS temporary
  directory. This is the declaration-build artifact, not a claim about later
  restoration-build bytes.
- Executable proof and outputs: `/private/tmp/proposal-path-audit/probe.mjs`,
  `packed-results.json`, `source-results.json`, and `evidence-sha256.json`.
- First extra settlement assertion: `probe-with-settlement-v1.mjs` and
  `settlement-first-error.log` in the same evidence directory.

No source or dist mutation was required for this audit. No v15 Proposal result,
general rollback failure, architecture selection or release clearance is claimed.
