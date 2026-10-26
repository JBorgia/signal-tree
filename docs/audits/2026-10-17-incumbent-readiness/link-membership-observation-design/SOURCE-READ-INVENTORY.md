# Membership and absence observation: frozen source inventory

Read-only source investigation at rejected runtime
`2dacae7b9e9137018d05c4e00382ac9287bc76d4`, checkout
`/private/tmp/link-evidence-scope-successor` (HEAD and clean status verified).
All source paths below are relative to `packages/kernel/src/lib` unless otherwise
stated. No runtime/test edits or test executions were performed for this task.
Line references identify this frozen SHA; this document is not a successor design
selection or an acceptance report. Parent owns final architecture/document writes.

## Contract used

Read the current readiness copies of:

- `docs/audits/2026-10-17-incumbent-readiness/link-a0-operation-contract/A0.md`.
- `docs/audits/2026-10-17-incumbent-readiness/link-a1-successor-design/AUTHORITY.md`.

A0 distinguishes membership absence from present undefined; actual native supplied
updater inputs from arbitrary application-hidden reads; physical P from ordinary O;
source identity from recipient permission; and public value notifications from
installed-unit completion. The aggregate authorization covers inputs to **newly
authored facts**, not all untouched contributors in an outgoing payload. Actual
native inputs, transaction authorship and enclosing validation are lower bounds.
Hidden-input omissions remain the application's declaration responsibility.
Neither authorization defines arbitrary JavaScript property reads or cached
application computed reads as an existing publication-observation port.

## Public read inventory

| Read/operation | Existing native behavior and source | What is actually observable to current publication code |
| --- | --- | --- |
| Held ordinary scalar child `child()` / facade leaf read | The native reader supplied to the adapter checks effective absence (`internals/native-tree-scalar-leaf-runtime.ts143–147`); the public framework carrier may serve a cached/published value instead of invoking that reader on every call. Neutral tree leaf read explicitly checks liveness (`internals/tree-scalar-leaf-runtime.ts138–144`), then neutral location zero-argument read tracks a reactive dependency (`internals/location-runtime.ts424–427`). | A callable/native read exists, but no publication read callback/token is emitted. Framework dependency tracking is not publication ownership. |
| Previously present ordinary child property after omission | The same child remains a non-enumerable own property. `isDormantMember` checks its descriptor (`internals/member-membership.ts255–262`); effective ancestor absence uses cached descriptor walks (`340–380`). | Raw property acquisition does not execute a read observer. Calling the held child reaches the read above. `hasOwn` on the handle/container may stay true for a dormant property and is not semantic value membership. |
| Never-present ordinary key property | Branches are callable functions with ordinary supplied child properties, not a universal open-key Proxy (`signal-tree.ts360–370`, `402` onward). | No absent child topology or publication fact is synthesized. JS function/prototype collisions remain possible on undeclared names. This inventory does not add lookup/deferred handles or reverse authorized unknown dynamic typing. |
| Ordinary branch/root call `branch()` / `$()` | Absent branch returns undefined and reads its membership revision (`signal-tree.ts455–465`). Present reads call memoized materialization (`utils.ts217–219`; `internals/snapshot-authority.ts76–99`). | Native snapshot construction can observe reactive membership/values; there is no provenance scope solely because an application calls this accessor. Cache hits may not traverse children. |
| `Object.hasOwn(snapshot, key)`, `key in snapshot`, `Object.keys(snapshot)`, spread/destructure | Snapshot is ordinary JS data built from backing store (`utils.ts361` onward). Present own fields are emitted; dormant fields are omitted; present undefined remains an own field. | These later JS operations do not call SignalTree. There is no trap reporting which existence/value fact was inspected. A native-supplied whole snapshot may be treated as a known input domain at its callback boundary, but individual subsequent property operations are not presently observed. |
| `Object.keys(branchHandle)`, `hasOwn(branchHandle,key)`, descriptor reads | These are ordinary reflection over the callable/accessor's properties. Non-enumerable dormant handles remain retained and intrinsic callable properties are not state. | No ownKeys/has/getOwnPropertyDescriptor publication trap exists on ordinary branches. Reflection over handles must not be equated with snapshot semantic membership. |
| Direct branch/root updater argument | `signal-tree.ts473–517` enters `beginBranchPublicationInput` before computing supplied current value, invokes callback, keeps scope through recursive installations and exits finally. Absent branch argument is undefined. Nested branch updater uses same boundary (`1107–1152`). | This is a real native-supplied input boundary. Current experiment snapshots native requirements before callback, including writes/reentry made inside it. It does not identify which property the arbitrary callback uses. |
| `updateAndReport(updater)` | Frozen successor adds same root input scope (`signal-tree.ts2090–2110`) before unwrap/callback through recursive partial writes. Literal overload does not supply current-root input. | Observable supplied root domain, not arbitrary hidden input. No new public API is involved. |
| Scalar updater | Native adapter captures source token before callback, separately reads P input and O-before (`internals/native-tree-scalar-leaf-runtime.ts274–296`); neutral leaf equivalent is `internals/location-runtime.ts482` onward. | Real supplied-input hook. It must account for effective absence and P/O participation; a scalar value record alone does not identify its ancestor existence. |
| Entity `byId(key)` / `byIdOrFail` | Present key reads its per-row carrier and yields lifetime-bound node; absent key reads ids carrier and yields undefined (`entity-signal.ts3382–3401`). | Actual lookup is observable as a method execution and has native key/lifetime facts, but current experimental publication admission does not intercept this read or retain its query identity. Absence deliberately does not allocate a permanent per-never-present-key signal. |
| Entity `has(key)()` | Versioned derived projection checks collection absence and structural `hasActiveKey` (`entity-signal.ts3476–3478`). | Current-state boolean with reactive observation; no publication provenance token. Reading a cached boolean need not re-run the native membership query. |
| Held entity node/field read | Node resolves acquired subject handle/current key, then reads that lifetime; absent/retired subject returns undefined. Field read checks own field presence (`entity-signal.ts2951–3023`). | Lifetime identity is available in native binding (`2998–3005`), but the read does not feed the new source requirement factory. Entity scalar field projection is not automatically a migrated ordinary scalar source. |
| Entity `ids/all/count/empty/asMap` | Versioned SignalTree projections: `entity-signal.ts1349–1394`, `3409–3430`, `3482–3486`. ids normally uses active key/order snapshot; sorted ids can derive from sorted values. count uses active key count; all/asMap include bodies and membership. | Query domains differ. A count/absence result is not a row payload; ids includes occupancy/order; all includes bodies. None currently produces a publication read certificate. |
| Entity `activeId/activeEntity` | Selection cell plus conditional key-membership observation: when absent, activeEntity observes ids; when present it reads the selected row (`entity-signal.ts3434–3458`). | Key-based selection versus subject-bound held row is explicit. Neither public derived read is mapped into source publication inputs. |
| Entity `where/find` and similar queries | Predicate-cached derived values; where cache is WeakMap keyed by predicate (`entity-signal.ts3363–3375`, `3489` onward). | Callback evaluation and cached output are different boundaries. User predicate can read other trees or saved data; no declaration completeness is inferred from the fact a query method ran. |
| Entity row updater | Supplies current row before replaceOne (`entity-signal.ts2975–2994`). | Native input exists, but it is not connected to `beginBranchPublicationInput` or scalar native participant. Source finding, not a claim of qualified entity updater provenance. |
| Numeric EntityMap bracket read | Proxy get forwards numeric-looking keys to byId (`entity-signal.ts5153–5157`); other names fall through API/property logic. | This is not a general membership/ownKeys/has observation Proxy, and does not supply automatic causal tracking. |

## Snapshot membership is already richer than visible values

`utils.ts368–392` is a load-bearing existing distinction: when a branch has dormant
members, `buildFromStore` calls the retained dormant child functions to reestablish
reactive dependency edges, but does not emit their values into the snapshot. The
actual member loop at395–398 enumerates visible own members. Consequently the
snapshot can omit x while its observation graph remains sensitive to x reappearing.
`dormantKeys` (`internals/member-membership.ts861–866`) uses own descriptors; it is
not an indexed point-query publication API and should not be described as free.

This is **not** existing publication provenance. It is an existing source read
boundary worth recognizing. Frozen `experimental-publication/private.ts73–81`
separately walks only Object.keys, so it skips the dormant child and never collects
its retained `nativeMembers` requirement. The independent omitted-member control
therefore isolates an input-domain omission after an unrelated sibling overwrite
removes incidental support. Source membership evidence survived; capture omitted
it. No new execution was performed here.

Unconditionally visiting dormant child **values** would also be wrong. An absent
x contributes an absence fact to the supplied object domain; the hidden retained
x payload need not contribute to that domain. A representation must distinguish
observed absence, visible value, and retained value capable of later exposure.

## Physical versus ordinary membership and inspection

Physical ordinary-branch membership is descriptor enumerability. The native
OrdinaryMemberPresenceSource separately stores only divergent O facts, keyed by
literal key and expected child identity. `prepare` preserves O on inspection
(`member-membership.ts150–168`); `install` inserts/removes divergence and advances
its revision (`174–182`). `readOrdinaryMemberPresence` resolves O explicitly
(`191–204`). `getRetainedMembershipPath` returns **physical** descriptor presence
(`273–300`), not O; it is not interchangeable with the O reader.

Public dormant leaf/branch/snapshot reads normally describe P. Internal stored
reads bypass effective absence for capture (`member-membership.ts549–551`).
Native scalar updater deliberately separates displayed argument from ordinary
before (`native-tree-scalar-leaf-runtime.ts280–283`). The slot O reader consults
inspectionBaseline outside inspection (`internals/tree-scalar-slot-runtime.ts253`).
A query or future evidence port must identify which view it observes; it cannot
attach an O owner merely because a displayed P value happens to compare equal.

`setMemberPresence` already prepares P/O presence, ordinary before/after and
incumbent responsibility before descriptor installation (`member-membership.ts918–997`).
It validates epoch, child identity and ordinary-source revision after callback-capable
preparation. Inspection affects P while ordinary preparation preserves O. The
experimental `prepareMembership` ignores inspection writes (`private.ts115–118`)
and retains current native membership requirements on ordinary installations.
This is write-side evidence; it does not prove that every public reader consumed it.

Entity topology likewise has separate physical and ordinary plans. The completed
topology unit carries both (`entity-signal.ts1275–1296`), then responsibility and
native frame installation use the prepared ordinary changes (`1299–1324`).
Physical membership observation tap receives committed frame instructions (`1328–1329`).
The existence of those facts does not itself map user query reads into publication
requirements. No Link permission may be inferred merely from a structural neighbor
record or an inspected physical row.

## Entity lifetime, occupancy and order

StructuralStore maps business keys to subject IDs (`physical/structural-store.ts124–135`),
allocates fresh IDs monotonically within a collection incarnation (`111–121`),
and resolves held acquired handles through incarnation and lifetime state (`139–182`).
Retired/forgotten IDs cannot alias a new row under the same business key. A full
clear can reset allocation only while incrementing collection incarnation
(`590–602`). Held row currentKey follows subject identity, not a fresh key lookup
(`entity-signal.ts2963–2972`).

Therefore these observations are distinct:

- `has('a')`: current key occupancy, possibly a new lifetime on later read;
- `byId('a')`: current mapping and returned lifetime;
- held old row(): that acquired lifetime, still absent if a replacement occupies a;
- ids(): active key sequence/order, potentially sort-derived;
- Object.hasOwn(rowSnapshot,'field'): field presence in that ordinary JS snapshot.

The existing entity membership tooling seam is expressly write observation:
`internals/entity-membership-source.ts3–25` reports committed point instructions,
operation open/order-open/close, and exposes structural read methods (`46–60`).
`entityMembershipReader` snapshots/subscribes to inventory
(`internals/entity-membership-view.ts52–54`, `294–306`). It does not intercept
application membership queries or identify every read dependency. Its optional
collection tap must not be relabeled an already-existing causal read port.

## Source evidence lifecycle independent of enrollment

At frozen successor `2dacae7b`:

1. Scalar SourceRecord construction invokes optional experimental native factory
   (`internals/intrinsic-mutation.ts223–231`). Factory
   initializes one weakly keyed current requirement per native scalar identity
   (`private.ts71–101`). No canonical value or compensation history is stored.
2. Setter/update preparation records actual transaction metadata and native
   supplied inputs. Requirement installation is part of the same terminal record
   plan as source/recipient installation; completion remains installed-only.
3. Membership preparation stores a separate requirement under child identity
   (`private.ts115–131`). A value overwrite does not delete this membership fact.
4. Native updater scope snapshots requirements before callback (`private.ts102–113`).
   Current implementation misses dormant edges as documented above. Native input
   capture is not an ambient observer for zero-argument getters.
5. Actual executing validation frames accumulate known native/declared obligations;
   horizon completion freezes compact proof then clears frames/inputs/temporary
   known arrays (`lifecycle.ts47–67`, `169–185`). Recipient coverage does not become
   a source-global uncertainty merely because another Link is enrolled.
6. Link baseline reads source requirements into its own projection (`private.ts207–237`).
   Disposal removes recipient metadata/hooks/indexes but leaves source records
   (`265`), so a later Link or native updater can still encounter native facts.
7. Literal replacement replaces current native value evidence. Same-identity
   membership changes replace membership evidence. Weak source keys allow release
   with source lifetime; terminal owner cells retain compact outcome, not source
   values. Terminal removal from active owner map is deferred to a microtask
   (`lifecycle.ts17–28`); destroying an owner source does not fabricate confirmation
   (`30–35`). This is source inspection, not a collectibility pass.

This lifetime discipline is separate from native entity reclamation. Entity native
records can be retained for history/recovery/ordinary topology; reclamation checks
those obligations and must not republish/re-intern forgotten identities
(`entity-signal.ts3188–3237`, `3262` onward). Publication ownership for entity
existence/occupancy/order is not implemented by the scalar native requirement maps.

## Cached, retained and asynchronous inputs

Neutral computed dependency tracking records reactive node/version edges only
(`location-runtime.ts260–275`); recomputation replaces those edges (`611–635`),
and a cached read returns through readCurrent without necessarily reexecuting its
producer (`642–645`). Snapshot materialization similarly caches a derived read
(`snapshot-authority.ts76–99`). Framework-owned computed/effect timing cannot be
turned into a promise that each read replays source getters inside a declaration.

Framework example: Angular's source realization stores `signal(read())` and publishes
via `cell.set`, while `peek` is the supplied native reader
(`packages/angular/src/lib/observation-adapter.ts24–37`). A normal public signal
read does not necessarily call that reader. Angular readonly cells use computed
(line40); Vue readonly wrapping uses computed (`packages/vue/src/lib/vue-observation.ts47`).
Thus installing a hook only in the native snapshot builder or supplied peek callback
would not observe every application read of an already-materialized carrier.

A saved plain snapshot, saved boolean (`hadX`), key array or prior computed output
contains no current publication token. Later Object.hasOwn/enumeration/branching on
it is arbitrary application work. In a native-supplied callback the whole argument
boundary exists before user code; outside it the runtime cannot retrospectively
infer which values or absence observations were consumed. Async continuations
cross the synchronous declaration stack boundary; declaration rejects thenable
return and pops scope in finally (`lifecycle.ts211–223`). This does not cancel
already-scheduled asynchronous work or attach its future writes automatically.

## Work and retention constraints for any next design

- A point existence read should identify its branch/key or collection/key domain;
  it must not scan all registered trees/connections or create immortal records for
  every arbitrary absent string ever probed.
- Full snapshot or enumeration may legitimately traverse its returned domain and
  relevant absence/order obligations. Reporting O(D) while enumerating all retained
  dormant descriptors would be misleading; count that work separately.
- Same-lifetime dormant state may keep support while reactivation/history can use
  it. New lifetime same key must not inherit an old lifetime's dependencies.
- A held snapshot/computed result can outlive source revision. Any proposed metadata
  lifetime must explain that obligation, rather than retaining every old revision
  or claiming collection from WeakMap syntax alone.
- Ordinary membership divergence, source requirements, recipient baseline and
  reactive membership carrier are different records with different release rules.
  Neither disposal of one Link nor a value notification count can retire them all.
- An observable method call or write-side tap is a place an explicit future port
  could be specified; it is not evidence that such a port already exists.

No new reader interception, API, policy, runtime successor or test correction is
selected by this inventory. Production and all frozen rejected sources remain unchanged.

## Examined source hashes

```text
b5c636c660e391531e63c2d2da7ff1105e69d25c1202fa81fc45ae9940ac74c0  packages/kernel/src/lib/signal-tree.ts
3a631f9381e564a964474e7e86c0eeac5809c5da8b4658c6f105927828d89e53  packages/kernel/src/lib/utils.ts
956d39c81548d5168df8ba40a20ddedd40b89b10b46d26eebb2c37827033b013  packages/kernel/src/lib/entity-signal.ts
bfad0d5f63050e5c774d0a903783f5472b44a9e74259e94ce5c09ff80262183b  packages/kernel/src/lib/internals/member-membership.ts
d082605b6c48613dc08db6a066d4657c5f43622712bab23bff095fd162b32954  packages/kernel/src/lib/internals/snapshot-authority.ts
d86fc473ec3c214d4d9db5122a9386b24666b8f89a1722e3cbdf4373081cb29f  packages/kernel/src/lib/internals/location-runtime.ts
eaa9850c22851a0d8887e9f69060e8724f2b7c6f12d577d847439ee3cfc4ada4  packages/kernel/src/lib/internals/native-tree-scalar-leaf-runtime.ts
fe3f6d58db7885c3effc17016aa4b2c867e1bd2f12e85aafa06db9033ce93304  packages/kernel/src/lib/internals/intrinsic-mutation.ts
099b2d5ad23ae5f7a75f691577bf45221aa18c1276d09ca1dacf2324b3eb6dc1  packages/kernel/src/lib/internals/entity-membership-source.ts
a93b5aefbdd10fc06997f3f8f5dc64daa28ab7400291ea720c01053a9cb64993  packages/kernel/src/lib/internals/entity-membership-view.ts
1895bdd43895296a255eb4fc9ae86e339a687c60ee051da797a94e24a1ff0353  packages/kernel/src/lib/physical/structural-store.ts
c5b32608354921f465b7a04fd511181a9e3cae315a63a0c610113ce59bad5761  packages/kernel/src/lib/experimental-publication/private.ts
24c2b6c847ad1feb643c9bd6c6985f3f1655d62728fed097757e6113e4bfb648  packages/kernel/src/lib/experimental-publication/lifecycle.ts
```
