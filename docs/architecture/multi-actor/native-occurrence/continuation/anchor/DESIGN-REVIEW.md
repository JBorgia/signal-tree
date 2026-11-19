# Entity source-anchor design review

Verdict: the raw API/proxy mismatch is a concrete cause of the observed missing-address failure. Moving the single collection-level binding registration from the raw API to the final returned proxy is a justified bounded experiment. No design objection found to that move as specified. This is not evidence that all 52 inherited failures will clear, or acceptance of the successor.

## Evidence and mechanism

Paths below are relative to `/private/tmp/st-retained-source-successor/candidate/packages/kernel/src/lib`.

- `entity-signal.ts:5130` registers the collection binding on `api`. `internals/entity-publication.ts:142-153` stores the registration object as `anchors[source]` only for collection bindings (no subject/field).
- `entity-signal.ts:5315-5341` creates and returns a distinct Proxy(api). Its only trap is get; ordinary symbol lookup forwards to the raw target. There is no defineProperty trap.
- `markers/entity-map.ts:330-338` attaches registry metadata to the returned collection. Registry metadata is an object property (`internals/position-registry.ts:157-180`), so the proxy and raw target can both see it.
- `internals/materialize-markers.ts:968-983` stamps the produced collection object's address. Address storage is a WeakMap (`internals/position-registry.ts:185-214`), so stamping proxy does not stamp raw target. The same materialized object is installed into the parent at line 1010.
- `internals/native-occurrence.ts:25-31` resolves row/field binding to its source's collection anchor, then requires BOTH registry-root and address. Current anchor is raw api: registry is present, address absent. It fails before ancestry/lifetime verification at lines 35-45.
- Row/field bindings (`entity-signal.ts:3283-3297`) already carry source, subject lifetime and field; they do not need collection-address copies. Their registry read from api remains valid because it is property based.

The independently supplied diagnostic was inspected, not rerun: `native-anchor-diagnostic.spec.ts:19` fails unchanged for BOTH enhanced=false and enhanced=true. Raw log `/private/tmp/st-retained-source-successor/runs/anchor-first/first.log` records 2/2 failures, expected ['rows'], actual undefined. Assertions immediately before it established field binding, equal registry, and public collection address. The capture assertion on line20 was not reached. Original fixture/log remain untouched.

## Bounded change conditions

Move the existing defineEntityPublicationBinding call to immediately after proxy construction and before return, using proxy and the same source. Do not leave the old call and add a second new binding: the symbol property is nonconfigurable/nonwritable by default; redefining it with a new binding object through the proxy can throw. The proposed move lets defineProperty forward onto api while the WeakMap anchor records proxy. Both internal raw property reads and public proxy property reads still observe the same binding.

Leave row/field registration, subject allocation, retire behavior, replaceSelected callback, registry/address stamping, and occurrence checks unchanged. Do not normalize arbitrary proxies, synthesize guessed paths, copy metadata onto raw nodes, fall back to mutable public IDs, or accept missing address/root. The existing source-issued entity edge remains anchored to the exact collection object and exact subject/field identity. Registration itself is not publication authority.

The interval between old registration and proxy construction contains setup/property/helper registrations; no inspected source-level dependency requires collection binding lookup there. Row bindings are independent and do not overwrite the collection anchor because subject is defined. Moving registration later still precedes return to marker processing and first external enrollment. Standalone createEntitySignal without tree materialization still has no verified root/address; this change must not manufacture one.

## Necessary focused controls before broader qualification

1. Replay the exact two diagnostic cases unchanged; additionally assert anchor === public rows. Capture the field and row occurrences; verify final entity edge parent is that collection, child is exact retained field/row and subject/field binding is unchanged. Verify collection capture itself has no extra entity edge. This tests both identity and the next ancestry check, not merely absence of exception.
2. Real public field Link in bare and transaction-enhanced trees: enroll, update one field and assert actual delivered value/count. In enhanced mode also exercise pending/confirm and rollback against inherited expected terminality/delivery assertions. A diagnostic-only pass does not establish useful Link behavior.
3. Nested collection address, ideally a literal key containing a dot: verify address segments and successful field enrollment. No path-string parsing or synthetic address workaround.
4. Retain field, change row key, write same lifetime: its binding subject/source and collection anchor stay identical; link follows that lifetime. Remove/re-add same public key: new subject/field is distinct and must not redirect old handle to new row. Preserve existing retired-handle policy, including any existing refusal/terminal result.
5. Negative provenance: a bound standalone collection with no materialized root/address must still refuse occurrence capture; two collections at equal paths in different trees must produce distinct roots/anchors. Reuse existing stale ancestry/foreign-root rejection controls where available; no weakened validation.
6. Dispose Link/tree and exercise existing bounded reclamation control if one already asserts these source anchors. The WeakMap value changes from raw target to its owning proxy (which already owns that target); no new global strong map is introduced. This observation is not a GC proof and should not replace an existing lifetime regression.

Minimum next gate: exact diagnostic plus ordinary public field-Link case, then retained/rekey/reused-ID and nested/negative cases. Keep the original failure and unchanged assertions. Treat any later failure beyond getNodeAddress independently. No runtime experiment, broad suite, source edits, or metadata-policy change performed by this reviewer.

## Inspected source hashes

- `internals/native-occurrence.ts`: `421873e7534602a1328dc1d04dd3f09e80f955b66445b1d0b4044316a00773bc`
- `internals/entity-publication.ts`: `7885ead200a79c3d344e82ddb52a6aae4f13ee55964bf2f5619fddd90c03323d`
- `entity-signal.ts`: `5a995cfb42f00d4cbf6bec730408b0365ab0e37a8f2ba237669ccf8c33754b7c`
- `internals/materialize-markers.ts`: `6aa9b12c829d737a8ed00880aff880153deb4ab157eda884d16d6868efd9d8f4`
- `internals/position-registry.ts`: `e86ed017e11d69ee5cdf625082309bef976b2528227367f652a762998f0f89b6`
- `markers/entity-map.ts`: `80a1885936ff614753e002741a7c6d35752e37e28ec697b3de030b1786780d8f`
- `native-anchor-diagnostic.spec.ts`: `261fd61f3d42b7bd48f5a1896025c09c5251cb4312e40b766f9df60ae877d213`
- Original diagnostic log: `6dc055a58c6db0620757458f59eaa6b6a3dae3cf78cc55a325075edc1d9c986b`
