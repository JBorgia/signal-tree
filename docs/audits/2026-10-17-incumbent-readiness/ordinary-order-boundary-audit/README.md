# Ordinary-order boundary audit — slice 1 qualified; traversal duplication identified

October 24, 2026. Read-only runtime audit following `a55050e47bc517082f643978797bebb07f8a5f16`.
Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`. No runtime/test assertion
changes, optimization, broad qualification or later-slice restart. B remains closed.

## Disposition

The blanket slice-1 acceptance is **withdrawn for W2 derive-footprint and genuine
identity-updater no-op behavior**. These are existing-lifetime, unchanged-key/order
operations explicitly included by the approved plan at
`f80645c8e73e3a958b43b4214ffb6b6333ea332d`. They are not deferred structural migration.
The recorded 143 unique passing controls and reviewed realization-edit handoff
remain valid finite evidence; they did not cover these inspection/updater cases.
No historical passing result is rewritten as a failed execution.

The second original failure combines explicit same-display whole replacement with
an identity updater. Its no-publication expectation conflicts with the already
approved replacement-adoption rule. Preserve that original assertion and red result;
do not change replacement semantics to satisfy it. An identity updater **alone**
also wrongly adopts inspection, independently confirming the W2 defect. Correcting
this classification does not qualify the candidate.

The `6N` prepend snapshot cost includes avoidable duplication. Separate physical
and ordinary endpoints are necessary under the current capture contract, but they
do not justify every repeated walk. No optimized source/count or CPU result is
claimed. Integration and slices 2–5 remain gated.

## Exact source and reproduced behavior

Slice-1 checkpoint `91058393308faadbd8f5cdd2e0a3271c4e56ee22` was reconstructed from
its archived overlay plus exact `f80645c8` base. All 748 TypeScript source hashes
match its archived manifest before and after execution. Current isolated source
matches all 781 files in manifest
`d13c33b1a515c65e4ca008df5caab0ac4976ed4db0cc166b922998fd2b7f6cb6`.
The predecessor/current source archives remain in the
[prior evidence record](../ordinary-order-indexed/README.md) and the slice-1 checkpoint.
No Git SHA is claimed for an isolated source directory.

Starting ordinary `{id:'r',x:0,y:0}`, inspection displays `x=99`:

| Operation | Approved ordinary outcome | Exact slice 1 and current observations |
| --- | --- | --- |
| `row(c => ({...c,y:2}))` | x0/y2; authors y only | Prepares x99/y2, captures/notifies x+y, confirms outbound x99/y2 |
| `row(c => c)` alone | No authored change or send | Prepares x99/y0, captures/notifies x, confirms outbound x99/y0 |
| `row(row())` | Explicit replacement adopts displayed x99 | Adopts and sends x99, as approved |
| Replacement then identity updater | Replacement adoption survives | Sends x99; original combined empty-send assertion is incompatible |
| Partial update `{y:2}` | x0/y2 | Preserves x0, captures y, sends x0/y2 |

The same passive source/notification probe ran on both checkpoints. These five-case
traces are diagnostics, not ten assertion-test passes. The unchanged original
`entity-egress-footprint.spec.ts` was also replayed through Nx on exact slice 1:
**13 passes / 2 failures**. Its SHA256 remains
`19536a3160a4458b7b3cd85d97fb04c092c63bc64c22d675346788d5dbf84a2a`.
The prior current-source focused union remains **350 passes / 2 failures**; it was
not rerun here. Its two failures now have the distinct classifications above.

Initial bundle resolution and the first Nx attempt could not resolve the archive's
absolute experimental import. Neither executed tests. A resolver mapping for the
probe and a symlink for Nx restored the archived path without editing source.
Both infrastructure failures and the subsequent meaningful run are preserved.

## Where authorship is lost

`createEntityNode` preserves displayed updater inputs and marks callable intent as
`derive`. `replaceOne` receives that distinction, but stages a
`PreparedValueReplacement` without `authoredFields` for both derive and replacement.
`EntityValueStore.prepareValueTransition` defaults ordinary-after to physical-after
unless an explicit field footprint exists. Thus inspected x99 becomes ordinary
truth **during preparation, before installation or Link delivery**.

The notifier still receives derive `undefined` versus replacement `null`, but
`PathNotifier.notify` derives missing field keys from the prepared ordinary pair.
That pair already contains the erroneous x0→99 adoption, so capture, inspection
and publication agree on the wrong authored transition. Ambient participation is
still authored; the missing information is the derive/full **authored footprint**.
Partial updates supply their keys and preserve the distinction. This locates a
source preparation defect, not a reason for downstream Link filtering.

## Six prepend traversals

Instrumented frozen bundles overwrite-prepend the last existing row after seeding
N members. At N16/256/1024, current snapshot entries are 96/1536/6144; comparator
entries are 32/512/2048. Current = 3 physical + 3 ordinary traversals. Instrumentation
records stage identity/version, immutable array identity, subject IDs and call stacks.
Versions are diagnostic mutator counts, not a production revision mechanism.

| Walk | Consumer | Disposition |
| --- | --- | --- |
| P-before | Physical capture before endpoint | Distinct required evidence under current delta contract |
| P-after-prefix | Authored order domain | Needed data; same private stage/version as next walk on this route |
| P-after | Physical capture after endpoint | Exact duplicate snapshot on prefix-only route; any reuse must account for optional finalOrder mutation |
| O-before | Ordinary inverse before endpoint | Distinct from physical under inspection |
| O-current | `orderDomain` permutation input | Duplicates O-before only when intervening preparation has not changed placement; not generally true for compound membership/adoption |
| O-after | Ordinary inverse after endpoint | Distinct endpoint, but rewalks the exact permutation array already constructed by `orderDomain` |

Two narrow reductions are supported by source evidence: share the immutable
P-after array at the callback-free preparation boundary, and consume the generated
O permutation as the after endpoint. Conditional O-before reuse needs a genuine
no-placement-change proof. Do not share P/O based on matching keys, sizes or values;
do not introduce a long-lived/global cache. Reentry invalidates the whole prepared
unit, and later live reads cannot replace frozen endpoints. Other linear work
(domain filtering, sets, mapping, installation and capture) remains. No constant-work,
CPU, heap or artifact superiority follows from eliminating a snapshot.

The control's two snapshots describe genuinely different live physical endpoints.
It lacks this ordinary-order preservation, so 2N is a useful cost comparator, not
an equivalent correctness implementation. The measured increase remains a regression;
its avoidable portion should not be accepted as an unavoidable semantic tradeoff.

## Independent review and limits

A scope reviewer read the frozen plan, source, tests and raw traces. Its initial
source-only belief that old egress still preserved x0 missed PathNotifier's default
ordinary-pair derivation. Root's exact-checkpoint execution disproved that inference;
the reviewer corrected it and preserved the initial report verbatim. An independent
traversal reviewer examined source before seeing the instrumenting investigator's
verdict. Both agree on the duplicate P-after walk and the ordinary reuse constraints.
Root inspected the actual call sites and the raw counts, rather than treating review
as proof. Full reports and the initial review are in the archive.

This audit does not implement a derive repair, alter the conflicting original test,
accept a traversal budget or reopen later slices. Original four ordering falsifiers
and indexed cleanup results retain their bounded validity. Full framework composition,
collectibility, artifacts and release verification remain unqualified.

## Evidence and replay

[Evidence archive](evidence.tar.xz), [archive hash](ARCHIVE.sha256), and
[44 member hashes](MEMBERS.sha256) preserve prewritten expectations, probes, bundles,
input/source hashes, first failures, exact outputs, source excerpts and both reviews.
Archive SHA256: `889ed8d6ae7e8bddec7a3c6bc563d9f29fa1a51669eeea622262d6bfaf4cfcd9`.
Node 24.15.0 and pinned Corepack pnpm 10.17.0 were used. From the extracted archive,
the saved bundles replay the original compiled inputs directly:

```sh
node current-probe.mjs
node slice1-probe.mjs
node --enable-source-maps raw/candidate.mjs
node --enable-source-maps raw/control.mjs
```

To rebuild, `build.cjs` and `raw/build.cjs` record exact source roots, resolver and
instrumentation. `raw/COMMANDS.txt` records the measured executions. The root probe
build commands were `node build.cjs current` and `node build.cjs slice1`. The exact
slice-1 fixture command, from its reconstructed root, was:

```sh
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=src/lib/entity-egress-footprint.spec.ts --skip-nx-cache
```

Reconstruction uses the slice-1 archive's `candidate-overlay` over `git archive
f80645c8` plus that revision's root Nx/tool configuration, with the local dependency
installation. Its archived absolute candidate path points to the reconstruction.
`SOURCE-AFTER.json` verifies no runtime/test source drift in either arm.

Record validation: archive and all 44 member hashes verified; `git diff --check`
passes. Documentation gate: 741/741 relative links resolve across 183 live surfaces,
using the existing isolated loader. These checks validate the record, not runtime
acceptance. Unrelated guidance and measurement-contract edits are excluded.
