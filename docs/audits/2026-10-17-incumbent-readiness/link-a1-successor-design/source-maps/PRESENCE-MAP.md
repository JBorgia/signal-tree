# Native ordinary plain-member presence: source map and bounded mechanism

Read-only design input. Source checkout `/private/tmp/link-a1-installed-operations`, HEAD `d0e7d1659900b18c9a63d280f409c0448a0c1d80`; no runtime/model/test execution or edits. Line references below identify this frozen source. This is not implementation approval or a public semantic decision.

## Facts the retained-child witness needs

The preserved case uses one existing retained child y under an existing parent a: ordinary omission; inspection writes retained y=99; transaction ordinarily writes y=7; rejection. It needs two independent booleans, not two values:

| Boundary | Physical local membership P | Ordinary local membership O | Physical/ordinary value |
|---|---:|---:|---|
| Initial y=7 | true | true | 7 / 7 |
| Ordinary omission | false | false | retained 7 / retained 7 |
| Inspection re-add y=99 | true | false | 99 / 7 |
| Ordinary transaction y=7 | true | true | 7 / 7 |
| Reject that adoption | false | false | retained storage is not observable membership |

Present `undefined` is a true membership bit with an undefined value; it is not absence. The inverse must capture O false→true even though P membership is unchanged and the scalar ordinary value 7→7 is a no-op. No Link or history subscription may be needed to recover O false before that adoption.

## Existing owners and carriers

- `internals/member-membership.ts:39–66,166–176`: descriptor enumerability owns **physical** current membership; both accessor/store halves must agree. `DORMANT` locates parent/key and caches the descriptor-derived physical absence answer (:83–103,236–273). It does not retain pre-inspection O.
- `member-membership.ts:602–626,702–730`: `deactivateOne` and `activateOne` are the only enumerability primitives. They update the epoch and omitted count; omission installs retained parent links. Re-activation can disable physical absence checking when the count reaches zero. Neither distinguishes inspection participation.
- `member-membership.ts:804–840`: `setMemberPresence` owns both physical halves and currently prepares/installs publication support. That support is relationship evidence, not a native ordinary membership source. Its `changes` predicate is P descriptor change only.
- `internals/tree-scalar-slot-runtime.ts:184–212,256–282`: scalar `inspectionBaseline` retains ordinary **values**; `readRecordSlot` and `needsAuthorityAdmission` consult it. Equal O-value 7 can suppress a compensation value effect without answering membership. Extending that value map implicitly to mean absent would conflate `undefined` and absence.
- `internals/plain-branch-membership.ts:266–291,306–351`: `MEMBER_ADDRESSES` indexes registry position→(branch,key,node); captured effects carry before/after membership. The comment explicitly says presence comes from descriptors, not this map. It has addresses but no ordinary presence state. Capture/history/inspection footprints are downstream records, not a current source before any observer exists.
- `plain-branch-membership.ts:714–727`: `readPlainBranchMember` reads descriptor enumerability; it currently cannot answer O when inspection differs. `hidingMembers` (:741–771) similarly identifies physical omitted ancestors along structured addresses.
- `internals/snapshot-authority.ts:16–23,50–76`: membership revision/snapshot caches invalidate reads; they hold no source O presence. Connection-local egress baselines likewise are relationship authority, cannot supply native rollback authority, and may not exist.

Thus no inspected existing carrier already supplies the missing bit. The physical owner is the natural installation seam, but an ordinary-presence distinction must be made explicit rather than reinterpreting an unrelated cache.

## Actual installation paths

Command used to establish central physical callers:

```sh
rg -n 'setMemberPresence\(' packages/kernel/src --glob '!*.spec.ts'
rg -n 'installPreparedMember|reactivatePathOnWrite|capturePlainBranchMembership' packages/kernel/src/lib
```

Bodies were inspected; this is not only an rg inventory.

| Writer/installer | Source anchors | Required source participation |
|---|---|---|
| Initial materialization | `signal-tree.ts:1547–1572` builder setup, :1576 onward initial child loop; `materialize-markers.ts:776–829` paired descriptor installer | Construction seeds O=P for supplied children. No eager full-tree ordinary mirror is needed. Fresh child registration is a different admission from retained-child activation. |
| Whole branch/root value and partial outer update | `signal-tree.ts:1019–1045` new child installation; :1264–1305 membership reconciliation | Preserve O before each authored local presence change; omission is authored membership, partial outer scope omits nothing. Existing `readdedDuringStructuralWrite` protection (:1285) must preserve callback-authored newer operations. Supplying an inspection-present/O-absent retained child must author adoption even when P stays true. |
| Registered dynamic reacquisition | `materialize-markers.ts:747–770`; `signal-tree.ts:859–879` value applier | Existing identity is found before construction; supplied value is installed before activation. O admission must not be conditional only on P activation returning true. A fresh child uses the separate prepared installer. |
| Scalar held-path write | `tree-scalar-leaf-runtime.ts:129–145`; `member-membership.ts:384–433` | Scalar ordinary-value commit and retained path re-add are distinct current intervals. Today `reactivatePathOnWrite` returns early on P present (:387), losing the witness’s O adoption. The O check must survive this fast path and equal ordinary-value no-ops without forcing value notifications. |
| Own child of a structural write | `member-membership.ts:201–211,389–390` | `reactivateOnWrite` uses central presence setter but intentionally does not announce a separate membership event. Its O changes still need exact minimum responsibility and consumer facts; do not accidentally double-capture the surrounding whole-value operation. |
| Held entity collection / entity mutation re-add | `entity-signal.ts:2851–2856,4865–4908` | Collection rows remain their own authority. The containing plain member needs local O presence; pending re-add is completed before a tap. Its clear/interceptor/as-empty rules must not be replaced by ordinary plain-object hydration. |
| Prepared selected inverse/member restoration | `plain-branch-membership.ts:888–967,1044–1084,1139–1169` | Validate retained identity before any writes; prepare exact selected O targets separately from physical target. Existing installer writes values then central presence, and later invalidates/publishes (:1172 onward). It must update O even when the selected O target equals current P, and report O before/after rather than reconstructing from post-install P. |
| Inspection replay | Same whole-value/reactivation/prepared setters, with ambient `participation:'inspection'`; `capturePlainBranchMembership` saves ambient metadata at :148 | Physical installation must preserve previous O rather than advance it. Inspection cannot merely be filtered out by downstream capture after the source has discarded the previous membership bit. |
| Failure/reentry | `member-membership.ts:810–825`; new-child `materialize-markers.ts:783–817`; prepared inverse `plain-branch-membership.ts:1142–1154` | Preparation may execute user code. Revalidate identity and source revision/epoch before first install; install only prepared primitive source/capture records, not returned arbitrary callbacks between P and minimum O responsibility. A failed preparation must leave both views and indexes untouched. |

`capturePlainBranchMembership` currently takes before/after from physical descriptors (:111–158), and path re-add capture is only constructed when physical absence is found (`member-membership.ts:405`, `plain-branch-membership.ts:193–212`). Both must consume source O facts for ordinary responsibility, while keeping the existing physical notification tuples. Changing only Link or transaction capture cannot supply missing native O history.

## Minimum bounded source mechanism for retained identity under an existing parent

One possible representation is a **sparse inspection-divergence record**, owned by the same plain-member source that writes P. Record only O when O differs from P. Key by canonical parent plus retained child identity (with key/descriptor identity validation), not a business-key string alone. No payload snapshot is required: existing scalar/entity value owners continue to answer ordinary values.

Its source rules must be explicit:

1. Read O as the matching exception, else current validated P. A stale exception must never apply to a different child installed under the same spelling.
2. Before inspection changes P, privately retain the prior O bit; if resulting P equals O, remove the exception. Inspection can change P repeatedly without replacing O with an inspected bit.
3. An ordinary operation supplies its exact authored presence intent. Prepare O-before/O-after independently of P-before/P-after. O false→true remains an authored effect even when P true→true and value O 7→7.
4. A selected inverse supplies the already-selected O disposition; it does not create a new authored ordinary operation. Physical realization remains separately prepared under existing footprint rules.
5. Install the new source bit, exact minimum membership responsibility, address/index updates and applicable P descriptor changes as one callback-free prepared unit at the actual presence installation point. Rich capture/inspection/publication consume those same O facts after installation; no post-callback backpatch.
6. A pure P change or O change may have no corresponding value notification. Keep responsibility observation separate from ordinary equality suppression.
7. Preserve the existing value-before-reactivation timing. For the witness, P is already present, so native O adoption can be prepared without moving P. For physically absent paths, do not casually move descriptor activation before scalar capture: A0 permits distinct installed units where existing timing requires it. A specification must show which unit owns planned O adoption and how minimum authority exists before its callback; “pair value and membership” is not by itself a timing proof.

The sparse owner adds current source evidence, not a journal or another payload store. It must be independent of Link registration, transaction/history retention, and capture activation.

### Comparison with reusing existing carriers

| Carrier | Can locate identity? | Can answer missing O presence now? | Constraint |
|---|---|---|---|
| Descriptor + dormant link | yes, retained address | no, only P | Keep P read semantics unchanged. |
| Scalar inspection baseline | scalar slot | no presence bit | Cannot use sentinel undefined; branches/collections also have membership. |
| Member address index | yes | no | Could locate a source record but must not silently turn downstream registration into source completeness. |
| History/transaction effects | only observed obligations | not generally | Omission can predate a transaction and no history is required. Replaying events is not native current truth. |
| Connection support/egress | relationship-local | only its authorized baseline | Must not become settlement authority or overwrite a connection created after inspection. |
| Sparse native P/O exception | yes, if identity-validated | yes | Requires the writer/consumer mapping above and lifecycle proof; not already implemented or approved. |

## Lifetime, release, and scope limits

- Current plain omission retains node identity and slots. `materializeMember` first reuses `KEY_INDEX` identity (:747–759); `preparePlainBranchMembers` validates descriptor.value===retained node (:945–953,1142–1153). This supplies a finite existing-parent/retained-lifetime scope without inventing replacement lifetimes.
- Delete an exception on proven P/O convergence, not merely when there are no pending transactions. O≠P is itself a live current-truth obligation even without Link or history. Ordinary omission, ordinary adoption and selected inverse can discharge it.
- A failed attempt must not publish the new exception or leave attempt-owned children/index entries reachable. The approved existing new-key allocation controls remain separate acceptance requirements; this design does not infer cleanup from removing a key name.
- Do not retain payloads in the presence record. Do not globally index unrelated trees. Parent/child keyed weak storage can avoid a new global root, but a weak key alone is not a proof of collectibility; existing dormant bindings hold parent links and existing member address maps retain child addresses while their registry lives.
- `signal-tree.ts:1990–2020` destruction runs registered cleanup and terminates owner invalidation; it does not erase retained descriptors/values or the registry’s state. No existing plain-member retirement/deletion path was found that safely permits unconditional source-record clearing while held nodes can still be read or written. The final design must explicitly bind cleanup to the established post-destroy operation contract; clearing O exceptions must not promote inspected P accidentally. This is a lifecycle qualification requirement, not a chosen new destruction policy.
- Fresh inspection-created keys, an actual same-key fresh-identity replacement producer, and an ordinary write below a missing **ordinary** ancestor need explicit admission/footprint mapping beyond the one retained local edge. The local bit can represent them, but it does not decide which ancestors may be created/adopted or which old handle can act. No ancestor-creation or lifetime-retargeting rule is selected here.
- Existing tests establish “write absent descendant reactivates its authored path; off-path dormant storage must stay absent” (`member-membership.ts:365–383`, `whole-value-membership.spec.ts` cases named there). Preserve that minimum footprint. Do not adopt all physically displayed siblings to avoid specifying nested O presence.

Required bounded falsifiers before native approval: preserved no-Link/default-Link witness; O-absent/P-present and O-present/P-absent retained edges; present undefined; whole/partial/point/inStructuralWrite routes; same child repeated omission/re-add and reentrant newer write; preparation throw; atomic inverse refusal→useful retry; source records reclaimed on convergence and after permitted lifecycle drain. This inventory supplies requirements, not a pass count or a selected public policy.
