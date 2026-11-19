# I6: finite source attribution and reduction decision

**Recommend a bounded implementation trial in order 1 → 2 → 3 below, subject to Main authorization. Do not call the cost regression attributed or solved.** The selected source contains concrete extra native-publication work on ordinary scalar setters and ordinary collection population. Two candidates reduce scalar temporary work; one reduces collection construction snapshots. None justifies turning off tracking when local transactions or recipients are absent, and none establishes recovery of the populated-heap delta.

This task made no runtime/test/config changes and ran no profiling, benchmarks, Nx, builds or types. It read only the two specified snapshots, the existing representative-cost packet, and focused source/tests along these call paths. No architecture or semantic change is proposed. All allocation statements below describe source-level object/array/Map construction, not measured V8 allocations, retained bytes or time shares.

## Identity and relation to existing measurements

The cost packet's [bindings](/private/tmp/st-v16-representative-cost/BINDINGS.json:1) names retained commit `87f6831fa60cafe87508f0ace84b7638698ca3b0`, retained source-manifest digest `d70c495c62b7dbc9bd636202230664bf4656f8e07e67b6a4e71f68b4657cfb26`, and selected source-manifest digest `8bd6920bb81f676466a1c7d12d61395766694d881fcf2aa8c2dcdd35b5dce670`. The relevant files used here are checked against those existing manifests in the appendix. These are snapshots; a selected Git HEAD was not inferred from a manifest name.

The existing [cost report](/private/tmp/st-v16-representative-cost/REPORT.md:1) reports selected-higher ordinary bare scalar sync/CPU and ordinary populated live heap, with material uncertainty elsewhere. This memo imports that finding, not its attribution: no profiler, allocation counter or intervention result links any fraction of the observed delta to a particular function. No numerical timing or byte reduction is forecast.

The checked workload matters: [fixture/seed lines 13–20](/private/tmp/st-v16-representative-cost/harness/child-heap-v2.mjs:13) builds ordinary trees and calls `setAll` with id/name/value rows; ordinary populated heap does not request every row facade. [bare operation lines 35–40](/private/tmp/st-v16-representative-cost/harness/child-heap-v2.mjs:35) repeatedly calls `t.$.fields.f0(i)` then reads it. The snapshot comparison therefore follows the direct setter, not a multi-slot commit frame. The seven-profile packet did not measure a separate construction-time profile; collection construction below is relevant to live heap and setup allocations, not a claimed measured construction latency.

## Concrete source deltas

### Ordinary scalar write, without enhancements

Selected root import exports Link at [index:167](/private/tmp/st-v16-integration-candidate/packages/kernel/src/index.ts:167); Link imports native publication modules and registers the entity factory at [link:3–12,65](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/link.ts:3). Scalar authority registers at [private:150–196](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/experimental-publication/private.ts:150). This is reachable through the full root runtime used in the existing cost workload without calling `link()` or enabling transactions. This does not independently establish every tree-shaken consumer's bundle retention.

The selected direct path is:

`leaf replace → kernel.commitRecorded → terminal preparation + source.preparePublication → native requirement/endpoint selection → composed record installation → physical publish → publication completion`.

- [Selected leaf binding:233–319](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/internals/native-tree-scalar-leaf-runtime.ts:233) reads the pre-record value whenever publication preparation exists, creates preparation closures/mutation data, combines terminal/publication records, separates physical and semantic change, and completes in finally. Compare [retained binding:173–185](/private/tmp/st-v16-representative-cost/retained/packages/kernel/src/lib/internals/native-tree-scalar-leaf-runtime.ts:173): optional terminal preparation, conditional observer mutation, direct publish; no native publication unit on this path. Both already allocate a terminal callback and the `{value}` publish wrapper; those are not new selected costs.
- [Selected commitRecorded:313 onward](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/internals/tree-scalar-slot-runtime.ts:313) adds inspection-baseline checks, possible second equality under a shadow, unchanged-authorship preparation, and a result object. [Retained commitRecorded:313–330](/private/tmp/st-v16-representative-cost/retained/packages/kernel/src/lib/internals/tree-scalar-slot-runtime.ts:313) returns a boolean and exits equal writes immediately. The inspection and equal-authorship behavior is deliberate; it is not proposed for deletion.
- [Native scalar prepare:165–194](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/experimental-publication/private.ts:165) builds input arrays, a prepared requirement, a frozen proposed endpoint, relevance/comparison data, view and terminal edits, plus validation/finalization closures. [Lifecycle:289–316](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/experimental-publication/lifecycle.ts:289) clones stack/known/input arrays, registers unfinished/unactivated requirements, computes proof, and at finalization builds Sets and samples **global** pending owners. Ordinary no-enhancer writes still need that foreign-owner window.
- [Composition:316–351](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/internals/intrinsic-mutation.ts:316) adds plans, coveredRecipients, finalizers, parts, completion and finalization wrappers even with an empty recipient snapshot. It combines primitive edit arrays repeatedly through [combineTerminalRecords:20–28](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/internals/intrinsic-mutation.ts:20). A single-plan call already returns that plan, but still creates/filter-processes its rest argument list; do not count it as a full flattened copy.

These are direct candidate CPU/allocation contributors. This is stronger evidence than merely seeing a larger runtime file, but it does not apportion elapsed time.

### Ordinary entity construction/population, without enhancements

Retained [setAll:3702–3714](/private/tmp/st-v16-representative-cost/retained/packages/kernel/src/lib/entity-signal.ts:3702) commits a structural/value frame and reorders; its [frame projection:561–605](/private/tmp/st-v16-representative-cost/retained/packages/kernel/src/lib/entity-signal.ts:561) already allocates changes, clones fresh records and invokes optional responsibility. Do not attribute those shared operations wholly to selected.

Selected [collection construction:1868–1869](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/entity-signal.ts:1868) adds an EntityPublicationSource. [setAll:5031–5061](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/entity-signal.ts:5031) routes the populated frame through prepared publication; [frame publication:1592–1636](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/entity-signal.ts:1592) constructs ordinary/physical edits, steps and transitions. [source prepare:226–258](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/internals/entity-publication.ts:226) invokes its native participant even without recipients (lazy participant creation at lines 198–199). The participant is source-owned, not an enhancer.

Concrete **retained support** in [entity participant:60–75](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/experimental-publication/entity.ts:60) consists of eight maps: fields, members, placements, views, visible, placementViews, mappings, mappingViews. In population, rows acquire ordinary endpoint maps and physical view maps. [row preparation:148–205](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/experimental-publication/entity.ts:148) creates frozen field endpoints through proposal, physical View objects, per-row maps, membership/placement/mapping records and per-edit snapshots; [installation edits:208–215](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/experimental-publication/entity.ts:208) installs these into source-owned support. Thus cold row facades do not imply absence of per-row publication storage. This is a concrete plausible contributor to populated live heap; no byte count is assigned and other selected ordinary topology/value-store changes remain outside this bounded attribution.

Concrete **temporary preparation** includes the next-state/selection/pairing maps at lines 115–149, `physicalAt` row copies at 162, and per-edit `ordinaryRow`/`physicalRow` snapshots and evidence closures at 196–205. Temporary work can affect population work/GC, but cannot by itself explain quiescent retained heap without a retention path. Do not relabel all of it as retained per-row storage.

## Three bounded reduction opportunities

### 1. Compute preliminary native proof only when active frames consume it

**Exact change to consider:** In [prepareNativeRequirement:289–307](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/experimental-publication/lifecycle.ts:289), `const evidence=nativeProof(requirement)` at 296 is used only inside `for (const frame of active)`. For an empty captured `active` array, defer/omit this one preliminary proof computation. Keep requirement creation, unfinished/unactivated registration, captureWindow, finalize and completion unchanged. This is a local dead-result avoidance, not an owner/transaction fast path.

**Why concrete:** [nativeProof:263–282](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/experimental-publication/lifecycle.ts:263) constructs maps/flatMaps, owner deduplication results and a new proof when the fresh requirement has no proof. It does not assign a cache there. The proof is recomputed and stored during finalization for the no-frame case at 316. The preliminary result has no consumer when active is empty. This affects ordinary scalar writes and ordinary entity admission.

**Required invariant:** Finalization still samples current global pending owners after all callback-capable preparers. Preserve inherited actual/possible roles, inspection classification, unfinished readiness, active-frame validation and failure behavior. Do not reuse a global empty requirement or conclude that an empty local owner list means an empty window.

**Cheapest falsifier (not run):** a focused lifecycle witness with no declaration frame and a pending foreign owner; prepare, add/change a foreign pending owner before finalize, finalize, then assert the exact possible-owner set and readiness/activation behavior against baseline. Include one active-frame input/validation case to prove the retained proof path still runs. Check the existing [late native-only possible-window test](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/scalar-native-support.spec.ts:115) and [no-source-recipient support control](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/scalar-horizon-lifecycle-controls.spec.ts:49). Source review must verify no hidden accessor/callback behavior is introduced or removed on the internal requirement data. Reject the change if it needs to alter when the final window is acquired.

**Decision:** first trial; smallest implementation surface. Likely temporary CPU/allocation benefit, magnitude unknown; no meaningful retained-heap claim.

### 2. Specialize native-only scalar composition, retaining the installation protocol

**Exact change to consider:** In [composePublication:316–351](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/internals/intrinsic-mutation.ts:316), when `native` exists and the captured recipient snapshot is empty, avoid the generic plans/finalizers/coveredRecipients collection machinery. Use the native record/finalizer directly within an equivalent wrapper. Keep the existing completion parts representation initially; changing completion representation is not required for this bounded trial. Keep the common path for any recipient.

**Why concrete:** Even zero-recipient ordinary writes currently build plans and finalizers arrays, then spread/filter/flatten them before returning another record with installation marking. Native work itself is necessary; constructing collections to iterate exactly one known participant is the proposed reduction. The native-only predicate concerns composition cardinality, never absence of causal responsibility.

**Required invariant:** Keep source enrollment-identity checks before/after finalize, `deferPublicationFinalization`, exactly-once completion only after installation, native-unit validation, and original thrown values/error precedence. [completion:54–66](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/internals/intrinsic-mutation.ts:54) deletes the installation marker before invoking callbacks; [leaf completion/failure handling](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/internals/native-tree-scalar-leaf-runtime.ts:300) must retain that behavior. Reentrant registration must invalidate or follow the existing path, never silently become unobserved. No mutation of a shared/native record just to append bookkeeping.

**Cheapest falsifier (not run):** use one native source without recipients: refuse in finalize and assert zero installed value/evidence and no completion; install successfully and invoke completion twice, expecting one callback; throw `undefined` from completion and preserve the failure. Add enrollment during preparation/finalization and require the current identity refusal. Reuse [last-source-finalization refusal](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/scalar-frame-finalize.spec.ts:42) and [completion reentry witness](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/scalar-native-support.spec.ts:210) before any timing run. If avoiding collections requires a new completion protocol, stop this candidate at the narrower wrapper optimization.

**Decision:** second independent trial after 1. Some overhead remains intentionally. No claimed coverage of all bare-setter cost.

### 3. Reuse the final ordinary row map for unique-subject construction edits

**Exact change to consider:** [ordinaryRow snapshot:194–205](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/experimental-publication/entity.ts:194) already uses `singleton ? row : new Map(row)`. Extend this specific reuse to an admitted packet where each ordinary subject occurs once, determined from immutable admission metadata. A multi-row fresh `setAll` is such a candidate: every fresh subject has one ordinary add. Keep cloning for repeated-subject/tombstone sequences. Leave `physicalAt` and `physicalRow` copies unchanged; they serve a different observation boundary.

**Why concrete:** Current whole-packet singleton logic copies every ordinary row map in multi-row construction although other edits address different subjects. The per-edit evidence closes over those copies. With unique ordinary subjects, the staged `row` for an edit has no later same-subject mutation in that unit; later units already clone installed rows in `rowFields` at 148. Determine uniqueness using the existing admitted sequence/index at 113–116, without reading row payloads again. Do not rely on user keys alone: subject/entity lifetime is the identity.

**Required invariant:** A per-edit reader must retain its exact admitted ordinary image despite subsequent edits, refused installation, inspection-only physical changes, restore/remove/readd and reentry. Map reuse is valid only after proving no later write to the same row map. Do not coalesce ordinary and physical Views: line 190 deliberately mutates an existing view's requirement, and inspection can make physical truth diverge. Sharing those mutable objects would be a different, riskier change.

**Cheapest falsifier (not run):** extend the existing [packet evidence fixture](/private/tmp/st-v16-integration-candidate/packages/kernel/src/lib/packet-physical-pair-singleton.spec.ts:10) with two distinct fresh subjects and saved per-edit readers; check their ordinary/physical support before installation, after installation, and after a subsequent write to one subject. Counter-control: two ordered edits to the same subject must keep distinct per-edit facts; include a remove/readd and an inspection divergence. An attempt-local allocation witness should show that only ordinary-row clone construction falls for unique subjects; no global Map monkeypatch or benchmark matrix is needed. Existing packet step-order assertions remain authoritative.

**Decision:** third trial; saves temporary per-edit ordinary map copies in population. It does **not** remove the persistent ordinary/physical maps, field endpoints or views and therefore is not a proposed solution to the populated live-heap delta. Stop if stable reader ownership cannot be proved locally.

## Finite execution and stop rule for Main

Keep the frozen baselines. Authorize at most these three separately reviewable changes; retain individual diffs and source identities. For each: run its smallest semantic witness and relevant existing focused Nx cases first, plus a local allocation/call-count witness only for the claimed removed work. No success-by-weakened assertions, no extra workload family, and no performance conclusion from static object counts.

Once the bounded implementation is stable, use only the existing identity-bound representative cost cells/protocol and unchanged budget gates in the heavy owner's scheduled slot. Before/after measurements would be intervention evidence; this memo is not. Bundle improvement is also unestablished. If this finite batch is insufficient, the decision returns to Main/owner with the remaining absolute ordinary costs and uncertainty; it does not automatically expand into new architecture, broadened profiling, or disabling source tracking. In particular, the dominant-looking persistent entity support is identified but has **no safe retained-storage reduction established here**.

## Read-only evidence identity check

The following relevant files were hash-checked against the existing arm manifests while writing this memo. Missing retained native-publication modules are noted from the retained layout, not treated as proof that retained had no other costs. This is a targeted source identity check, not a fresh artifact seal or whole-checkout audit.

| Arm | File under packages/kernel/src | SHA-256 |
| --- | --- | --- |
| selected | `index.ts` | `08f93fa7aa7f67281f26f8d7e7591cd9c294b29e44ed04f176da804943c5f790` |
| selected | `lib/link.ts` | `a413b304b5f989af64620795ccefcbf3061285f9def16086f93cfccbb90cbba5` |
| selected | `lib/entity-signal.ts` | `b9925af0cba748fdaa44220581c84cf772c17bfc4f0af8ee8cc73ddfcb0c9e84` |
| selected | `lib/internals/native-tree-scalar-leaf-runtime.ts` | `aff08b7c247d874d2a0e88c9d97869bb8fb4fd6dd576956f7e89923c02dca743` |
| selected | `lib/internals/tree-scalar-slot-runtime.ts` | `3295b2aba72d7b103e1a99c6d45f490632f0c1a3ab1e146551950b39eb980915` |
| selected | `lib/internals/intrinsic-mutation.ts` | `27a88b798bb1c47dbbd5d931f09fbe6238cc831195d244309bda4df23607a692` |
| selected | `lib/internals/entity-publication.ts` | `98c5b53dcafe88403cdb9b808e0ec105a6b5051b84ce87580145fdabc6a7aa79` |
| selected | `lib/experimental-publication/private.ts` | `e1b062e95a54a7729c06733d4f8198eb5c398cf1658141bf215a69fe7d9ab472` |
| selected | `lib/experimental-publication/entity.ts` | `f213cf2f1f7095a9e6881416a3dd685714bb678a68dd31929d6871817d7557c6` |
| selected | `lib/experimental-publication/lifecycle.ts` | `1fd0ec87c7c10e8f27fd424e48544b44164a5aff548344540a9e83e1f53b187b` |
| selected | `lib/scalar-native-support.spec.ts` | `74acda5f67e00ec0ad070b5ef1562b5f2e18bcc5eb18accb0d4124e99d52bfb1` |
| selected | `lib/scalar-horizon-lifecycle-controls.spec.ts` | `fc0f5d3503b3dbc97825b3372eb9d52c42f41b6032dc3a330803aaff03c16b51` |
| selected | `lib/scalar-frame-finalize.spec.ts` | `116f971081e536b77f7656bfb631291a57bb62eb66451f23156310cbdad3ee53` |
| selected | `lib/packet-physical-pair-singleton.spec.ts` | `93679a448adf9a5b0cd06f4c3298021c22a96fbcf34255fed6c5b23ad7333e66` |
| retained | `index.ts` | `180b166b80796e9519188f694e29a4fff2a66a92256e2858557e1d7a7b7d2388` |
| retained | `lib/link.ts` | `d16e5f14cd4ad52d2b4b4f22466208004d73e7f464318cc910adfa7889bd6901` |
| retained | `lib/entity-signal.ts` | `4459d2ad9dfdf690388ce38f8421234ae8bb3a10266b65125287388cc674aebc` |
| retained | `lib/internals/native-tree-scalar-leaf-runtime.ts` | `4c2077142cd3f69c475221abe0a0a45f605f14d304d73ef256980a2c661da876` |
| retained | `lib/internals/tree-scalar-slot-runtime.ts` | `3d609a913f82055ea18bdc03e10af7a07f3de38c09e5ea229ec8a4cd44b623df` |
| retained | `lib/internals/intrinsic-mutation.ts` | `b813247b331d44cd6cb0566b572118ab1bac4fb774deb7ad7b35dd95837103fd` |
