# Configurable Link policies: bounded comparison

Automatic independent progress remains an unresolved v16 requirement. The owner
rejected substituting draft/outbox workflows for that requirement. This experiment
demonstrates one useful automatic boundary, but does not qualify a public policy
API or an integration candidate. Production retains its conservative hold.

Source baseline: `ffc50d3be5b19bd76c1cd4c20bc7d8144972b73b`; runtime checkpoint:
`87f6831fa60cafe87508f0ace84b7638698ca3b0`. No package, API, budget or B changes.
The [specification](SPEC.md) was reviewed before private implementation; see
[premise review](premise-review.md) and [implementation review](implementation-review.md).

## What was compared

| Policy | Demonstrated behavior | Developer responsibility | Qualification limit |
| --- | --- | --- | --- |
| A: automatic with conservative fallback | Actual incoming Link acquisition can reach a separate outgoing Link while unrelated x remains pending | Endpoint must genuinely provide authoritative input | Only scalar ingress; ordinary direct writes remain unknown and held even after confirmation |
| B: same eligibility rules plus declarations | Model accepts complete declarations covering every observed owner; rejects contradictions and foreign owners before replacing current authority | Supply all contributors at unobservable boundaries; a false complete declaration can leak hidden speculation | Model only; no Link ownership capture or native framework integration |
| C: selected manual publication | Model requires an explicit request as well as the same eligibility checks | All B obligations plus snapshot approval and request timing | Model only; manual scheduling itself proves no independence |

The control is the unchanged current Link. Draft adoption remains an optional
workflow and outbox remains experimental. They are not substitutes for automatic
progress in this assessment. No preview-publication mode or general unsafe override
was implemented. Runtime costs cannot be ranked across these unequal obligations.
No backend extension was tested; authoritative input and endpoint completion are
assumptions, not durable delivery or exactly-once guarantees.

## Actual Link results

An esbuild-only transform changes two admission calls, brackets incoming acquire,
stamps scalar revisions and adds private disposal cleanup. The rest uses actual
Link projections and delivery machinery. Receipts verify all 88 kernel inputs
against this checkout. Exactly two source modules differ in the research build;
all 88 are byte-identical in the baseline build. Nothing was installed in production.

- **Useful progress:** pending x=7, incoming y=42 then y=7, separate outgoing y:
  research sends `[42,7]` before settlement. Baseline sends nothing until confirmation,
  then sends `[7]`. The second value rules out a value-equality independence shortcut.
- **Reentry failure:** a sending observer replaces y with a pending copy7, yet
  previously captured42 reaches the endpoint. This is stale-revision publication,
  not evidence that speculative7 escaped. Admission precedes observer delivery;
  there is no final validation before the endpoint call.
- **Held-send failure:** known42 starts; unknown7 arrives; completing42 leaves a
  send held; known9 arrives but never sends. The private held callback has no wake
  path, and later flush work is queued behind that unresolved send.
- **Ordinary progress unmet:** direct constant42 remains held before and after
  confirmation. Holding every unknown cannot qualify useful general automatic work.
- **Control findings:** an ordinary copy of pending x into y survives x rollback
  and baseline sends7; the research bridge holds it. This differs from a write owned
  by the rejected transaction. Immediate tree destruction after acquire42 also
  results in a send in both builds. That lifecycle trace needs separate contract
  adjudication; it is not counted as a newly established production defect here.
  Attempting confirmation after destruction is a separate harness error.

Known-to-known in-flight serialization, connection disposal, subsequent delivery
after endpoint failure and separate connection progress have positive controls.
Previous-value/captured-local callbacks, intrinsic reentry before notification and
enqueue reentry remain held in the tested sequences. First matching notification
is not a general proof of installation identity; these narrow controls do not
establish safety across every callback ordering.

## Model and review limits

42 asserted model observations execute successfully. That count includes intentional
negative witnesses and an assertion preserving an unmet nested-constant progress
case; it is not 42 product requirements satisfied. Two pending owners, partial and
contradictory declarations, whole payload capture, revision replacement and manual
request timing are exercised. A deliberately false complete declaration publishes7
from a hidden rejected owner. Declarations therefore introduce an application trust
boundary rather than discover hidden causality.

The model clones/freezes payloads, but its owner Sets remain mutable at runtime and
its test-facing outcome table permits terminal reversal/reset. Independent review
executed both counterexamples; root independently reproduced rejected→confirmed
sending7 and clearing the returned owner Set sending pending7. These are concrete
model enforcement gaps. No claim of immutable
ownership evidence or terminal lifecycle enforcement follows from the passing
model assertions. Native computed caches, entity structures, automatic multi-hop
capture, nested exception instrumentation and asynchronous integration are untested.

Connection disposal releases held callbacks in the harness; revision and receipt
maps retain metadata. This is not a reclamation or heap-collectibility result.
No runtime benchmark, bundle build, four-framework suite or release gate was run:
there is no production candidate change to qualify. Existing entity budgets remain
separate blockers, unchanged.

## Evidence and replay

[Worker result](RESULT.md) contains the detailed discriminator table. Its “immutable
record” statements concern payloads, with the ownership-metadata qualification above.
The [raw archive](evidence.tar.gz) contains exact source snapshots, bundles, loader,
logs, receipts, first failures and root replays. [Archive identities](SHA256SUMS)
pin the delivered record. Initial strip-only TypeScript execution failure is tooling,
not a semantic red result. It was corrected by equivalent constructor syntax only.

Root independently executed both final bundles, the model and strict model/private
TypeScript checks on Node24.15.0. All 88 original input hashes matched; baseline
transformation count was zero. The same reentry and held-send failures reproduced.
Baseline `bridge=true` rows ask unchanged code to exhibit private-feature behavior;
those rows and their missing-release errors are inapplicable harness diagnostics,
not additional runtime regressions. Use baseline `bridge=false` for the paired control.

Replay saved evidence without rebuilding or overwriting first logs:

```sh
mkdir -p /private/tmp/link-policy-archive-replay
tar -xzf evidence.tar.gz -C /private/tmp/link-policy-archive-replay
export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
cd /private/tmp/link-policy-archive-replay/bridge
shasum -a 256 -c SHA256SUMS
node --input-type=module -e 'const {run}=await import("./bundle.mjs"); console.log(JSON.stringify(await run(),null,2))' > ../bridge-replay.json
node --input-type=module -e 'const {run}=await import("./baseline-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))' > ../baseline-replay.json
node engine-test.ts > ../model-replay.json
/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree/node_modules/.bin/tsc --noEmit --strict --target es2023 --module nodenext --allowImportingTsExtensions engine.ts engine-test.ts private.ts
```

The loader's original absolute paths are preserved; rebuilding uses its recorded
`/private/tmp/link-policy-bridge` directory and exact baseline checkout. Bundle replay
needs no source transform or repository mutation. A zero harness exit is not a green
acceptance result: inspect the `FAIL`, `harnessError` and unmet outcomes in JSON.

## Disposition

Do not select or implement a public API from this comparison. Configurability can
express useful distinctions, but the tested bridge fails its delivery contract and
the general evidence-capture boundary remains unfulfilled. Manual requests and
ownership declarations do not eliminate that boundary. This finite comparison stops
with preserved counterexamples; it is not permission for an open-ended tracking
rewrite. Automatic independent progress and release readiness remain blocked.
