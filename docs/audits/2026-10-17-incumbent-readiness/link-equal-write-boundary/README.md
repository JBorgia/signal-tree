# Equal displayed-value write: native versus declaration boundary

October 20, 2026. Source `db82b8ae7b75cd2d1a968a46fd8d79f489e45857`.
No runtime correction made; production hold unchanged. Previous [boundary correction](../link-native-boundaries/README.md) remains separately supported.

## Observations

Nine identical scenarios ran against unchanged native source and the frozen private declaration candidate. Root independently replayed both saved bundles. These are characterizations, not nine new safety proofs. The proposed adoption expectation remains failed in both arms.

| Sequence | Physical result | Link sends / contribution |
| --- | --- | --- |
| Ordinary99 then ordinary99 | 99 | None; genuine no-op |
| Ordinary7, inspection99, return from inspection context | 99 | None |
| Above, ordinary99 | 99 | None; proposed send99 expectation fails |
| Above, transact ordinary99, rollback | 99 | Empty inspect changes; no send |
| Above, ordinary100 | 100 | Sends100 |
| Above, declared ordinary99 | 99 | No send; candidate receipt no-write |
| Above, declared ordinary100 | 100 | Sends100 |
| Inspection99, authoritative retrieve99, ordinary7 | 7 | Sends7; acquisition retains its distinct authority contract |
| Pending0 to7, inspection99, ordinary99, reject pending | 0 | Rollback succeeds, sends0 |

No declaration fallback supplies a missing authored operation. Both arms share the native equality boundary. `location-runtime.ts` calls intrinsic observers with `changed:false`; `owned-mutation.ts` and other publication/interception routes exclude unchanged attempts. Thus the attempt is observable internally, but neither owned contribution nor publication revision is emitted. This corrects the overly broad inference that the call itself cannot be observed.

## What inspection exit means

`withWriteContext` restores metadata, not values. DevTools inspection physically applies its input; COMMIT resets diagnostic history, disconnect removes observation, and ROLLBACK applies its supplied snapshot as another inspection write. There is no implicit overlay exit that restores ordinary7. This part is source review, not a browser/DevTools execution claim.

Link retains its own eligible projection7 while physical state remains99. Calling physical99 after context exit therefore does not establish that ordinary authority became99. Existing tests establish differing authored writes and equal-value external acquisition; neither determines equal-call adoption and rollback.

## Contract boundary and review

[Independent review](REVIEW.md) traced the inspection participation decision, current no-op rules and downstream authored-dependency controls. It recommends retaining native equal-setter no-op semantics and stating that declarations cover actual revisions (including real ABA), not arbitrary setter attempts.

If equal displayed-value adoption is required, a transaction must define what rejection restores. Prior physical state99 and prior eligible authority7 are different. An authority-only effect could restore eligible7 while keeping display99; restoring both to7 instead requires a nonphysical baseline. Existing evidence does not select either policy. Link-only promotion would leave transaction semantics inconsistent.

Owner decision received after the investigation: **authorize adoption; rollback restores both physical state and publication authority7**. This explicitly selects new v16 semantics over the prior no-op behavior. The independent review's recommendation is preserved as historical advice, not current authority. A separate bounded implementation experiment must establish the new contract; these baseline traces remain unchanged. No native bug under the preceding contract is claimed.

## Evidence and replay

Archive includes initial diagnostics, frozen source/loader/module hashes, baseline/candidate bundles, raw results and root replays. Node24.15.0 was used. After extracting, run each in a fresh process:

```sh
node --input-type=module -e 'const {run}=await import("./experiment/baseline-bundle.mjs"); console.log(JSON.stringify(await run(), null, 2))'
node --input-type=module -e 'const {run}=await import("./experiment/bundle.mjs"); console.log(JSON.stringify(await run(), null, 2))'
```

The baseline has no declaration API; the identical ordinary callback is executed there. Private sources retain earlier scan/retention limitations. No Nx/full suite, new package build, benchmark, budget change or production activation was performed. Historical32/34 delivery accounting is unchanged and does not resolve this question. B remains closed.
