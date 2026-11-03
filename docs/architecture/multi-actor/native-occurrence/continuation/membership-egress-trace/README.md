# Membership / egress causal trace

## Findings for Main

**Line 316 is not failing on the supplied current row-source snapshot.** The exact unchanged test passes both here and on archived `87f6831fa60cafe87508f0ace84b7638698ca3b0`. Diagnostic execution confirms physical `{name:'Grace'}` and outgoing `[{name:'Grace',age:42}]`. Do not attribute the adjacent explicit-replacement failure to this case.

**The collection failure is reproduced and localized.** On direct collection re-add, native collection preparation carries `[{id:'s',n:2}]`. Membership completion first selects that correct natural array, then overwrites it at relative address `[]` with its ordinary membership snapshot `{all:[]}`. The endpoint receives that object. For the exact executed test, the expected value is the new row array, not merely `[]`; prior absent steps correctly emit `[]`. No shared cause with a line-316 failure has been established.

No runtime correction or Main/source-tree edits. Only disposable copies and diagnostic logging under this directory. No acceptance claim for adjacent disputed semantics, full integration, cost, types or release.

## Source identities

Current input `/private/tmp/st-row-source-successor/candidate` was copied to `candidate/`; all 2943 manifest files match the prior accepted row-source snapshot. Manifest SHA256: `a801391e26f62d725a99bda9deb1267020482604d67202e810687811fb017b38`. `SOURCE-SHA256.json` and `IDENTITY.json` preserve exact files; verified zero source mismatches after execution.

Baseline extracted locally, without changing root:

```sh
git archive 87f6831fa60cafe87508f0ace84b7638698ca3b0 | tar -x -C /private/tmp/st-membership-egress-trace/baseline87f
```

Relevant archived files were also checked byte-for-byte against `git show`. Root inspected as HEAD `628d302dadb082a48c58528651c9088234d0a777`, branch `fix/d1-d2-forward-port`, with existing dirty work; none touched. Both standalone source copies use existing installed dependencies. `IDENTITY.json` includes exact candidate, 87f and instrumented file hashes. Current `link.ts` is `1e9b0a856eb980edaf0f07afe2d0189b3cdcf2d3e636e33c2faa07cf6c340dc4`.

## A. Exact line-316 path: inspection omission followed by ordinary leaf replacement

Read and executed `packages/kernel/src/lib/branch-omission-correctness.spec.ts:316`. No oracle changes.

1. Link binds aggregate source address `['profile']` with ordinary payload `{name:'Ada',age:42}`. `experimental-publication/private.ts:324–374` enrolls the source and fields; recipient presence starts present.
2. Inspection whole-value `{name:'Ada'}` physically omits age. `internals/member-membership.ts:929–972` prepares physical membership separately from `OrdinaryMemberPresenceSource`; its `prepare` at 145–155 retains ordinary presence during inspection. There is no ordinary membership transition payload in this trace.
3. `private.ts:166–172` records inspection membership's unavailable physical-input view (`memberViews` / `negativeViews`) but returns with empty completion parts. It does **not** update recipient `presence`, `completedPresence`, or install a membership unit. The equal inspected name scalar is likewise rejected by the inspection return in `prepareScalar:257`.
4. Subsequent direct `profile.name('Grace')` is intent `replace`, not derive. Trace has `branchInputs:0`. Native preparation at `private.ts:120–130` consumes explicit captured input only for derive and any actual surrounding input scope. The source-level branch updater capture in `signal-tree.ts:479–485` is for function updates; this scenario does not execute it. Thus the physical negative view is not smuggled in as an input to this literal name replacement.
5. `prepareScalar:254–274` creates a field unit at relative `['name']`, payload `'Grace'`. In `ready:225–227`, applying this unit changes the retained recipient payload from `{name:'Ada',age:42}` to `{name:'Grace',age:42}`. No completed ordinary age absence exists for `maskPayload:68` to remove. `ready:247` projects that payload, and `link.ts:1035–1040` takes the receipt payload for delivery.
6. Exact witness in `inspection-values.jsonl`: `{"physical":{"name":"Grace"},"received":[{"name":"Grace","age":42}],"native":true}`. `inspection-native.jsonl` preserves each bind/membership/scalar/ready event. No extra getter was used in the native trace to obtain current state; final public reads occur at the assertion boundary.

87f comparison: there is no candidate experimental-publication subsystem in that archive. Its `link.ts:518` ignores inspection membership, and `:689–690` ignores inspection scalar pings and applies the subsequent ordinary leaf to the already eligible snapshot at its relative path. The unchanged oracle passes. The native implementation reaches the same result through prepared recipient state rather than this legacy notifier path.

## B. Adjacent line-292 oracle: explicitly supplied inspected replacement

This is a different operation: inspect `profile.name('Inspected')`, then explicitly supply ordinary whole value `profile({name:'Inspected'})`. Current file execution fails its line-309 expectation `{name:'Ada'}` with actual `{name:'Inspected'}`; 87f passes. The line-316 operation never explicitly supplies the inspected/omitted age as ordinary replacement content.

Preserved in `original-candidate.log`, separate failure heading “an omission does not carry an unchanged inspection-only sibling to Link”. No claim here that its oracle should be changed or its behavior repaired. Heisenberg's replacement-adoption adjudication remains separate. The same file run also reports the distinct “same-turn removal and reintroduction ends absent at Link” failure; not investigated or folded into either conclusion.

## C. Collection natural-value overwrite

Executed unchanged `link-absent-locations.spec.ts`, specifically collection / no enhancers / “an omission, and re-adds of the location and of a sibling”. Its initial omission and sibling re-add steps pass. Failure is after `a.rows.addOne({id:'s',n:2})`.

Trace sequence (`collection-native.jsonl`, also initial stdout in `trace-collection-retry.log`):

- Omitted collection occurrence is unexposed; `ready` projects `[]` correctly.
- Re-add prepares collection units with payloads `[]`, then `[{id:'s',n:2}]`. These complete while recipient presence is still false. `private.ts:200–205` updates `collection.payload`, leaving outward projection absent.
- Membership reactivation arrives at the **same source address** `['a','rows']`; ordinary after payload is `{all:[]}`. It comes from `setMemberPresence`'s prepared `ordinaryMemberSnapshot(child)` at `member-membership.ts:961–970`. `plain-branch-membership.ts:84–111` delegates the collection snapshot to branch-write capture; this is a branch snapshot representation, not the direct collection Link's natural array.
- `ready:209–212` exposes the occurrence and sets `b.valuePayload=ownCollection.payload`. The diagnostic **after this assignment** records both valuePayload and ownPayload as `[{id:'s',n:2}]`.
- `ready:213–217` obtains relative address `[]` and applies `after.value` unconditionally for present membership. `applyAtRelativePath` at `internals/source-mutation.ts:41–46` replaces the complete payload at an empty path. The correct array is overwritten by `{all:[]}`.
- The following repair loop only covers collections with a relative nested address. The own collection has no relative nested address, so its natural array is not reinstated. `ready:247` and Link's receipt refresh deliver `{all:[]}`.

Concrete source-owned seam for Main: the `ready` membership arm crosses from branch/member snapshot representation into a direct collection recipient after already selecting its natural collection value. The source occurrence and collection payload are present and correct before the overwrite. This trace does not call for weaker admission, bypassed presence, new permission or a later physical reread. No correction implemented.

87f's unchanged collection file passes all 21 tests. Its `link.ts:550–551` reseeds entity projection on membership, with the legacy entity projection delivery path handling collection rows. This comparison establishes the regression; it does not certify that the legacy reread strategy should be transplanted into the native design.

## Execution records and limits

Each name has `.command.json`, `.exit`, `.log`. Runner pins Node v24.15.0 PATH, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_TUI=false. Nx invokes installed Vitest; no external CLI review/source transfer.

| Run | Actual scope | Result |
| --- | --- | --- |
| original-candidate | whole branch-omission file | 33 pass / 2 fail; line316 passes |
| original-87f | same whole file | 35 pass |
| collection-candidate | whole Link absent-locations file | 16 pass / 5 fail, all collection re-add cases |
| collection-87f | same whole file | 21 pass |
| focused-inspection-candidate | exact unchanged line316, no instrumentation | 1 pass / 34 skipped |
| focused-inspection-87f | exact unchanged line316 | 1 pass / 34 skipped |
| trace-inspection-file | exact line316 with logging only | 1 pass / 34 skipped |
| trace-collection-file | exact bare collection re-add, logging only | 1 fail / 20 skipped |

First four commands requested short `-t`; Nx consumed it instead of forwarding it. Those raw outputs are preserved and explicitly counted as whole-file runs, not targeted results. Subsequent commands use `--testNamePattern=...`. No broad suite was run.

First `trace-collection` failed before tests because the diagnostic copy was still being populated (`ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND`). Preserved, not a runtime failure. `trace-collection-retry` executed and reproduced the collection failure. Early console-only inspection traces did not expose diagnostics in their logs; final file-based trace proves the executed native path. These earlier outputs are retained without invented observations.

`instrumented/` contains logging-only edits. `instrumentation.patch` preserves the first console patch; `instrumentation-final.patch` records all final diagnostic changes against candidate, including final public-value capture. Raw `native-trace.jsonl` is chronological across two executions; `inspection-native.jsonl` and `collection-native.jsonl` split it on module-load boundaries without modifying events. No types/build qualification claimed for diagnostic edits.

Replay using NEW log names (runner refuses overwrite):

```sh
python3 /private/tmp/st-membership-egress-trace/run.py replay-inspection corepack pnpm nx test kernel --skip-nx-cache branch-omission-correctness.spec.ts '--testNamePattern=inspection-only omission does not hitchhike' --maxWorkers=1
CONTROL_COPY=baseline87f python3 /private/tmp/st-membership-egress-trace/run.py replay-87f corepack pnpm nx test kernel --skip-nx-cache branch-omission-correctness.spec.ts '--testNamePattern=inspection-only omission does not hitchhike' --maxWorkers=1
python3 /private/tmp/st-membership-egress-trace/run.py replay-collection corepack pnpm nx test kernel --skip-nx-cache link-absent-locations.spec.ts '--testNamePattern=a collection.*no enhancers.*an omission' --maxWorkers=1
```

If another archived source actually fails line316, compare its identity and exact run context against `IDENTITY.json` before sharing this collection explanation with it. The requested inherited line316 failure has not been reproduced on these sources.
