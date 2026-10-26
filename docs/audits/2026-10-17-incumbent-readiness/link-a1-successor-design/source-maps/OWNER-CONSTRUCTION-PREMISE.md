# Constructing an owning-transaction aggregate example

Read-only premise review; no code/tests/execution. Frozen native API/source: A1 d0e7d1659900b18c9a63d280f409c0448a0c1d80. Governing records: original link-declared-contract/SPEC.md, link-api-proposal/PROPOSAL.md, final A0 `/private/tmp/link-a0-contract/A0.md`, owner-approved `/private/tmp/link-a1-evidence/AGGREGATE-EXPERIMENT-PROPOSAL.md`. The last file's historical “proposal” heading is superseded by the explicit authorization in this task; its actual scope is not silently expanded. B stays closed; A1 remains frozen/unaccepted.

## Ruling on a literal inside its own transaction

Original declaration SPEC, Admission2: “Accumulate any known dependencies from active transaction attribution ... as a mandatory lower bound.” A complete list omitting a known owner cannot replace valid responsibility. Final A0, Evidence algebra: “A transaction's actual authorship remains a known lower bound; a publication declaration never converts a pending transaction's write into committed work.” The aggregate extension changes completeness from the entire outgoing projection to newly authored inputs, preserves known consumed/inherited evidence, and says “Existing scalar/field contracts stay unchanged.” It does not explicitly revoke the active-authorship lower bound.

Therefore there is no documented authority to reinterpret an independent declaration around an owning transaction's literal write as merely valid-held because the literal had no value inputs. The owning active transaction remains known evidence on that authored operation. Under the preserved rule, omitting it contradicts the declaration. Untouched preexisting ancestor/sibling support is a different case; the new approval permits that support to hold a valid field declaration without contradiction. Existing capture attribution cannot be silently moved into that untouched-support category to make a fixture convenient.

If a future design wants active ownership alone to be a noncontradicting separate prerequisite, that is a further explicit rule, not an implication of the accepted aggregate extension. No such choice is necessary to construct the approved example below.

## What the public transaction API can do

`transactions.types.ts:22–44`: transact accepts `() => void`, returns PendingTransaction with inspect/confirm/rollback only. No callback owner parameter, resume or write method exists. `transactions.ts:5039–5043` enrolls/decorates the ordinary returned handle after callback/materialization; recovery enrollment likewise happens after failure. A caller cannot refer to its not-yet-returned authentic p inside that same callback. Owner integers, raw lifecycle records, ambient metadata injection or a structural fake are not an authorized substitute. A deferred owners getter is validated before callback, not an owner-token construction facility.

Thus “put the same p in a matching declaration inside the callback that first creates p” is not a publicly constructible recipe. It should not appear in a native test with private owner injection and be labeled a public application example.

## Publicly constructible matching-publication variant

The approved case need not place the declaration inside p's callback. A0 explicitly permits an equal-value setter with changed publication responsibility to prepare a support-only unit, without a synthetic value notification or compensation effect. No-setter declarations do not do this. The rule is general; the post-rejection surviving7 example is one instance, not its only authorized use.

With the newly authorized experimental aggregate connection:

```ts
// Connection's ordinary branch baseline is established before p opens.
const connection = link(tree.$.pair, endpoint);
const p = tree.transact(() => tree.$.pair.x(7));
// p now exists and owns the native x:0->7 responsibility.
const xReceipt = connection.declare(
  { kind: 'dependent', owners: [p] },
  () => tree.$.pair.x(7)
);
const yReceipt = connection.declare(
  { kind: 'independent' },
  () => tree.$.pair.y(8)
);
```

The second x setter authors a NEW publication-support revision outside p, using its authentic returned handle. It does not resume p, retroactively declare the old operation, reassign native compensation ownership, or merely bless a snapshot. A0 says an undeclared original write contributes unknown; replacing it with complete declared[p] support can therefore change effective support despite equal P/O value. p remains the owning native transaction, and the new value proof still depends on p. This supplies “pending p owns x with matching declared dependency” in a precise publicly constructible sense: matching declaration is on a later publication-support revision of the same current value.

Then independent y replaces only y's support; untouched x support keeps the aggregate/yReceipt held. The new relevant aggregate revision supersedes xReceipt's unstarted view while x's required proof survives. Confirm p gives the useful {x7,y8} send. Reject p must follow native selected compensation to x0, keep ordinary y8, and evaluate the current projection rather than release the old captured ticket. No declaration may turn that support-only x setter into an extra compensating effect; test native p inspection/ownership before and after it. This construction is a source/contract derivation, not a native pass: aggregate declarations and all required support-only handling remain to be implemented/qualified.

If an implementation already has exactly the same effective support on x, a true equal/equal-support setter is no-write rather than a forced receipt. The fixture must establish the documented initial unknown-versus-complete support change or explicitly recognize no-write; allocating a new unit identity is insufficient. Do not manufacture a native value event to force the example.

## Separate controls and limits

1. Native ownership control: undeclared p callback writes x7; p.inspect identifies x contribution; outside equal support-only declaration[p] leaves that native contribution/ownership unchanged; no synthetic value notification. After y8 outside p, rollback restores x0 while y8 survives under the established selector/refusal contract.
2. Known owning-owner omission control: catch the after-callback declaration error INSIDE transact if a usable pending handle/retained-write assertion is needed. Otherwise letting it escape legitimately invokes transact's existing automatic-abort/error behavior. Do not claim declaration validation itself atomically undoes the installed write.
3. Simpler valid-held aggregate control: p is returned from a DIFFERENT source's transaction; outside it, aggregate x is an ordinary copy declared[p], then y is independent. This is publicly straightforward but x is a surviving copy, not owned by p. Rejection must retain ordinary x7; it cannot substitute for the owning-x rollback control.
4. No-setter declaration[p] after p returns is no-write and cannot retroactively certify x. An asynchronous continuation likewise is not a resumed transaction; it needs its own declaration and ordinary ownership semantics.

No owner question is required for the publicly constructible support-only recipe under current A0. If the desired example specifically requires a valid matching declaration during the very first owning callback, the current public API cannot express it and the preserved active-attribution rule remains; that would require a separately authorized protocol/API rule rather than a convenient semantic reclassification. Existing A1 native O-presence blockers are unaffected by this premise resolution.
