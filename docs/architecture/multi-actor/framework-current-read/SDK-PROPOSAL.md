# SDK proposal: source-current readonly realization

Historical proposal preserved below. The owner-approved [decision](DECISION.md)
supersedes its legacy native-adapter fallback: native adapters must explicitly
support the capability. The later held-reader decision also supersedes the
acquisition-time distinction below. The original proposal remains preserved;
the approvals do not establish activation or completed qualification.

Status: owner-decision draft; main-agent contract review only. Ready for Hume's independent review.
No implementation or acceptance of the rejected repair is authorized by this document.
Basis: retained `87f6831fa60cafe87508f0ace84b7638698ca3b0`; identities and raw failures remain in `RESULT.md` and `FINAL-HASHES.json`.
Only this proposal file is written for this task; no external CLI review is used.

## Recommended candidate: optional distinct capability

Add only this optional member to the existing exported `ObservationAdapter` interface:

```ts
createCurrentReadonlyCell?<T>(readCurrent: () => T): ReadableCell<T>;
```

`ReadableCell<T>` is the existing internal callable contract `{ (): T }`; no new named export is proposed.
Member presence advertises support. Once present, failure must propagate under existing callback/error rules; never silently downgrade.
The adapter must return its existing readonly facade shape as well as the callable contract.
This is an additive public SDK surface change despite adding no barrel export. Owner approval is required.

## Capability contract

- Kernel owns `readCurrent`, values, selection, entity lifetime, and when callback-fresh semantics apply.
- Adapter owns the returned representation, native metadata, dependency tracking, and framework resource cleanup.
- Creation is lazy: it neither evaluates `readCurrent` nor publishes state.
- Each direct callable/native value read consults `readCurrent` during that read, including repeated reads of one retained cell across nested writes.
- One returned cell keeps coherent native producer/effect identity for its lifetime. Metadata access neither evaluates the value nor creates replacement producers.
- Stable identity alone is insufficient: metadata must belong to the representation performing the reads and tracking dependencies, not a separate cached/dummy computation.
- Reads do not write reactive state, advance epochs, invalidate tokens, flush publication, or create another value authority.
- Observation of dependencies read by `readCurrent` must survive normal publication; no eager notification is introduced merely by reading.
- Readonly operations remain readonly. Getter exceptions propagate; an exception must not poison subsequent reads or dependency cleanup.
- Separate getter acquisitions need not return the same cell. Existing outside-tap readers do not acquire new freshness semantics.

## Native cache contract: distinct from ST direct reads

In the existing rollback discriminator, the source is restored from X to A before the rich callback.
A callback-acquired ST reader returns A; after the callback chooses C it returns C, even if the reader is retained.
An application native computed warmed to X before rollback remains X when explicitly read inside the held-publication callback, both before and after the C write.
Its computation count does not advance there; after ordinary publication it observes C.
The new capability must not dirty, force, rebuild, or bypass that application computed to satisfy direct ST reads.
Ordinary `createReadonlyCell`/`createDerived` caching, selection granularity, scheduling, and error delivery remain unchanged.
Freshness applies to the source supplied by the kernel; it cannot make an arbitrary app-owned cached computation source-current.

## Kernel routing (internal changes only)

1. Add internal `LocationRuntime.createCurrentReadonly<T>(readCurrent: () => T): ReadableCell<T>` to neutral and native runtimes.
2. Both implementations delegate to the optional adapter capability when present; otherwise use the explicitly limited fallback below.
3. Preserve `createSignalTreeFactory`'s existing three-member native-carrier detection; the new capability must not silently move an older adapter to a different runtime.
4. Route the existing `entity-signal.ts` tap-fresh helper through this method, replacing the rejected per-property Proxy. Ordinary projection paths continue through existing factories.
5. Supply source-current selection and row computations from the kernel, retaining their dependency reads. A new native wrapper around unpublished `activeIdSignal()` alone is insufficient.
6. Mutation/rekey comparisons must use kernel selection truth; restoration must not overwrite later callback-authored selection or row writes.
7. Do not expose tap depth, restoration internals, framework symbols, or property-name inspection to implement routing.

## Older custom adapters: exact proposed fallback and limitation

| Adapter | Missing capability behavior |
| --- | --- |
| Default neutral/kernel, including React's neutral tree | Retain the existing uncached callable reader; this is the complete neutral read shape. |
| Older custom adapter, whether token-only or native-carrier | Retain the historical bare callable for this tap-only path; ordinary adapter construction and cached projections are unchanged. |
| Updated built-in Angular/Vue/Solid | Capability is required by local implementation checks and conformance tests; absence is a failed adapter build/test, not an accepted release. |

The fallback is precisely `readCurrent` (or its existing dependency-reading closure), with no derived wrapper, native metadata fabrication, forced publication, warning, or new runtime throw.
It preserves older custom-adapter behavior; it DOES NOT fix their existing native callback-facade defect.
Therefore this is optional adoption, not a claim that every older custom adapter receives the repaired guarantee.
**Owner decision:** accept this explicitly limited compatibility fallback, or require a separately authorized adapter compatibility policy.
There is no established automatic fallback that gives an unknown older native adapter both a correct native shape and stable fresh reads. Do not conceal that gap.

## Alternative: option on the existing factory

```ts
readonly readonlyCellCapabilities?: { readonly sourceCurrent: true };
createReadonlyCell?<T>(
  read: () => T,
  options?: { readonly readPolicy?: 'cached' | 'source-current' }
): ReadableCell<T>;
```

Omitted options mean existing cached behavior. Kernel requests `source-current` only when the explicit capability flag is true and the factory exists; otherwise it uses the same limited legacy fallback.
A flag advertising support without a factory is invalid configuration, detected before construction mutates state.
An optional parameter ALONE is unsafe: old one-argument implementations remain assignable and can silently ignore it, returning a stale cached cell.
Do not infer support from function arity or probe it by evaluating user reads.
Both shapes add SDK surface; the option form adds negotiation plus a second responsibility to the ordinary factory.
**Recommendation:** distinct optional method: one detectable capability, no change to the ordinary factory call contract. Neither signature proves native implementation feasibility.

## Framework obligations and feasibility gates

- **Angular:** return the existing `Signal<T>`-compatible readonly callable with one coherent native node; prove node identity, real dependency delivery, `isSignal`, and retained fresh reads together. Copying a symbol from an unrelated signal is not a solution.
- **Vue:** preserve the existing callable realization plus `.value`, readonly/ref identification, and the declared `ComputedRef<T>` contract, including coherent stable `.effect`. `customRef`/`readonly` is only an investigation direction: a `Readonly<Ref<T>>` is not automatically a compatible `ComputedRef<T>`.
- **Solid:** a stable accessor may call the supplied reader directly; verify actual browser-condition reactivity, dependency cleanup, ownership, and no eager memo creation.
- **React/neutral:** retain callable reads and existing external-store publication. Do not introduce native-node requirements or render notifications during the callback.
- **Tiny fake adapter:** implement the capability without any framework imports; prove source-current reads while notification is held and subsequently delivered. This earns the neutral semantic port, not any framework's metadata compatibility.
- No framework implementation has been proven by this proposal. If Angular/Vue cannot meet their existing carrier types and coherent metadata through supported mechanisms, stop for a further owner decision; do not weaken types, invent metadata, or rely silently on private native internals.
- Any resources allocated by a realization use existing adapter/tree teardown ownership. No new disposer SDK is proposed without a concrete necessity finding.

## Acceptance falsifiers (all required; run through Nx)

1. Re-run the byte-identical original Angular/Vue public tests; preserve the original stale-X and missing-`.value` failures independently.
2. Retain one callback reader; observe A, conditionally choose C only on A, update C, re-read, rekey, and clear. Newer writes must survive completion.
3. Execute warmed application computed reads inside the callback before AND after C; assert X and unchanged execution counts, then C after publication.
4. Assert repeated Angular node / Vue effect identity before and after value reads and nested writes; assert metadata's actual dependency/value relationship, not just reference equality or identification flags.
5. Observe a retained fresh reader with real framework consumers; require non-vacuous delivery after normal publication, unchanged unrelated-row granularity, and teardown with no later delivery.
6. Cover every existing tap-fresh projection (`ids`, `all`, `count`, `empty`, `asMap`, `has`, `where`, `find`, active selection/entity), nested callbacks, read/callback exceptions, and query readers retained after the callback.
7. Exercise fake, neutral, legacy token-only, legacy native, and capability-present adapters. Verify old shape/behavior is preserved and no cached factory is silently treated as current-capable.
8. Typecheck existing carrier contracts and old adapter fixtures; declaration/export checks must show only the approved optional SDK addition. Do not loosen baselines.
9. Mutation controls must fail for: cached-current implementation, per-read metadata replacement, premature publication, dropped dependency tracking, and overwritten callback writes. Full-suite green cannot replace these controls.

Decision requested: approve the distinct optional capability and limited legacy fallback for a bounded implementation proof, or return the unresolved fallback/carrier issue for owner resolution. No runtime activation or release authority is implied.
