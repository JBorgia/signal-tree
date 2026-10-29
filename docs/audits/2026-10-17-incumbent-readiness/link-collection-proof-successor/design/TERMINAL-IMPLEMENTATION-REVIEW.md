# Terminal-proof and uncertainty implementation review

2026-10-29. Independent implementation review of root's lifecycle/proof-retirement changes, frozen for this run under `/private/tmp/link-collection-proof-successor`, HEAD75416029 plus the exact BEFORE.json source manifest. I previously supplied retirement design input; I did not implement the reviewed runtime. I authored only `publication-terminal-consumer-independent.spec.ts`. No other reviewer verdict read. Approved UNCERTAINTY-RULE.md and original terminal-obligation/horizon controls were read directly.

## Disposition

No blocker reproduced in the reviewed **proof/capture/transport helper scope** after the core worker completed terminal-bit consumers. Independent targeted vector passed27/27 across5files, exact pre/post manifest identical, exit0. This supports the private terminal summary and uncertainty distinction within these exercised seams. It does NOT establish native retirement integration, memory cleanup, complete collection binding, selected-unit correctness or release acceptance. `compactTerminalProof` is not yet called by either source retirement route.

## Semantics checked against source

- `captureNativeInput` snapshots outstanding actual owner identities and terminal role bits before application code, retains the original requirement object, and excludes only owners already confirmed at this new consumption. Later confirmation cannot rewrite the issued owners array. Requirements retained for horizon validation/uncertainty remain available; a terminal compaction creates a new future certificate and does not mutate old requirements/cells/arrays.
- `compactTerminalProof` drops confirmed role identities for future current-source proof; rolled-back D/I/V/unclassified actual become role bits1/2/4/8, not fake OwnerCell objects. Pending and abandoned cells remain exact. Possible-window cells retain only pending/abandoned; unknown and provenance are preserved. Abandoned is unavailable, not confirmed or a discharged terminal window.
- Selecting/combining existing support preserves each role; `combineProofs` ORs rejected role bits and uncertainty provenance while retaining live identities. Actual native consumption maps any selected rejected actual role to **input** bit2 in the new authored requirement. That corresponds to the existing rule that D becomes I on consumption, while W remains W.
- `prepareNativeRequirement` sees terminal input bits while preparing existing record additions. A complete declaration consuming an impossible/rejected actual input is marked invalid before its callback returns, retaining after-callback contradiction/error behavior. Unknown declaration does not pretend to prove complete input. The helper tests exercise rejected D/I/V, frozen primary callback sentinel and secondary error reporting without replacement.
- Unavailable input now has explicit `unavailableInput:true`; a real consumption acquires the current finite candidate window even under complete declaration. Authorship clears that unavailable flag on the resulting fact and marks historical window. Later consumption inherits this captured window, does not recapture unrelated later owners. Merely selecting the unavailable contributor combines support without performing capture.
- Finalization happens after callback-capable preparation and before record installation. Only this newly authored requirement's own window is normalized against its D and captured I; inherited windows remain in input proof. No delivery-time global owner scan or terminality reversal was introduced in the reviewed lifecycle functions.
- `projectionPending` prevents receipt/delivery eligibility before the final contributor projection is installed. `proof()` still exposes the prepared base proof to the private reducer, so this flag does not by itself deadlock completion. `projectRevision` clears it when complete support is available. The aggregate bridge exercises completion through this route.

## Terminal consumers and initial findings

At first read private.ts had not yet completed new terminal consumers: early decision, summary counters, sameProof and baseline permission did not consult terminal bits. I reported these as **unmigrated mapping**, not runtime recurrence. Parent stated they were assigned to core worker; worker completed them before this review's first execution. There is no preserved failing runtime result for those initial omissions and no claim that an executed regression was repaired by this review.

Executed source now includes:

- per-bit reference counts in aggregate/collection summaries, preserving independent contributors sharing the same role;
- terminal bits in summaryProof and sameProof;
- baseline permission refuses a terminal-rejected certificate instead of upgrading it to clean relationship evidence;
- both lifecycle and private early-decision checks reject terminal roles; private delivery still uses the existing surviving fallback once no pending obligation remains;
- terminal roles do not become actual observer/declared-owner identities or manufacture pending cells.

The private bridge tests specifically distinguish metadata from useful admission: direct compacted rejected source proof survives `prepareSourceProjection → complete → refresh`, lifecycle early=false AND private allowed=false; `admit` invokes the conservative original scheduler rather than directly running as declared early permission. A second aggregate bridge installs an untouched rejected collection contributor, authors unrelated payload, and verifies the projected proof still carries rejected input and cannot early-admit. These avoid relying only on lifecycle's own decision while Link uses a separate private gate.

## Exact execution

Working directory `/private/tmp/link-collection-proof-successor`:

```sh
PATH=/private/tmp/link-membership-pinned-bin:$PATH COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm nx test kernel --skip-nx-cache -- src/lib/publication-terminal-consumer-independent.spec.ts src/lib/publication-proof-retirement.spec.ts src/lib/publication-uncertainty-provenance.spec.ts src/lib/publication-terminal-obligation.spec.ts src/lib/publication-terminal-horizon-independent.spec.ts
```

`/private/tmp/link-collection-proof-evidence/terminal-independent/FIRST.log`:5files27pass, actual exit0 in EXIT.txt. BEFORE.json and AFTER.json compare byte-identical (not merely runtime subset). PREREG.md and PREREG.spec.ts predate execution. No assertions changed. The two new private bridges are private controlled-source tests, not native public retirement witnesses. Root's previous23focused check is not substituted for this run or added to it as unique coverage.

Original terminal controls executed here include confirmation during updater and return validation, preparer confirmation, already-confirmed versus separately pending input, confirmed absence, historical window uncertainty, active enclosing validation, and invalid evidence surviving confirmation. Horizon controls cover intermediate recipient disposal and later shared validation failure reaching an earlier-consumed input. These directly constrain immutable capture timing rather than only checking final payload values.

## Limits / remaining gates

1. **No native compaction wiring.** Explicit source.retire still indiscriminately deletes native support, automatic bare forgetting still bypasses it. This review qualifies neither. Source/index transfer, weak held-lifetime certificates, shared aggregate retirement summaries, actual no-new-write settlement wake and post-drain lifecycle tests must execute when wired.
2. **No memory/resource inference.** Helper returns compact proof; no GC/retained-tree/payload/owner count bound follows from27functional tests. Closed validation frame/object graphs may still need their own source-level release mechanism.
3. **Old inputs:** helper test preserves exact old issued requirement and owner array after confirmation/compaction; unchanged native controls execute the captured-before-confirmation semantics. This is not a new actual native source-retirement replay with simultaneous old input and compacted current proof; that remains a wiring discriminator.
4. **Partial replacement/counts:** independent aggregate bridge verifies retaining an untouched terminal contributor. New actual source compaction must also test removing/replacing one of two same-bit contributors (count remains) and removing the last one (count clears), plus same-value role-only completion. Source inspection shows counters and sameProof handle these shapes, but this run does not supply those individual executions.
5. **Provenance completeness:** the new unavailable/captured/closed distinction must be emitted by every native producer. This lifecycle review does not certify entity P-view, fresh registration, cached snapshots, branch negative membership or all collection contributor factories. A producer still returning generic unknown without origin is not repaired merely by the new Proof fields.
6. **Selected support is not authored input.** Integration must preserve the separate authoredRequirement/selectedSupport path; untouched unavailable/rejected aggregate facts can hold delivery without becoming a contradiction against an unrelated independent write. Private bridge uses no declaration and therefore does not itself qualify that nested composition.
7. No full suite/types/framework/bundle/performance or installed artifact check was run by this reviewer. No broader activation or acceptance is implied.

## Executed source identities

- `packages/kernel/src/lib/experimental-publication/lifecycle.ts` SHA256 `4c788a106968031a2f3782790a86431384599901e0ea9eb3c9f06acd29bbb7cd`
- `packages/kernel/src/lib/experimental-publication/proof-retirement.ts` SHA256 `e94f688db30bfa63224286c4436668734fa7864a04ecd9d2383ab64edfb9faf4`
- `packages/kernel/src/lib/experimental-publication/private.ts` SHA256 `94b0e0077c7124a1b43005969bc5fc32712b7a11aee5853ec9b2f1591a03a868`
- `packages/kernel/src/lib/publication-terminal-consumer-independent.spec.ts` SHA256 `fd719835e389f508cde80c44d432e5a82274d8b168bef57b4d3d6cb0b3e64483`
- `packages/kernel/src/lib/publication-proof-retirement.spec.ts` SHA256 `42802bc7648ee70fc638a5459b476964dd782ace61e89605e4d3a86410f8f90c`
- `packages/kernel/src/lib/publication-uncertainty-provenance.spec.ts` SHA256 `6906a1db3ba371275ab7f8e86b75267453ef5404e701b89889736be8142aec83`
- `packages/kernel/src/lib/publication-terminal-obligation.spec.ts` SHA256 `0725a41669d33ea0358fc7559f63436cb9c235abdd8ed8ca5131bc888276f91e`
- `packages/kernel/src/lib/publication-terminal-horizon-independent.spec.ts` SHA256 `9736816d0e980a3be2b5d7901381b19bc7ed6e77a27e903478789570dd81e4cf`
