# FOURTH aggregate candidate: independent review

## Disposition

FOURTH is not causally sufficient for the claimed multiple-recipient aggregate route. The unchanged root passive-late-recipient control still fails useful progress; four unchanged scalar membership controls also fail. The receipt overwrite correction improves the three other independent input controls, but does not resolve the distinction between native input lower bounds and recipient-specific unavailable evidence.

The wider-ancestor-input test's first red is preserved. Its no-send oracle needs a narrower contract adjudication: the setup has an unrelated pending owner but no established foreign dependency. The exact approved text does not clearly require all unknown recipient coverage to wait for every unrelated tree. Two new independent controls with an actual same-tree pending updater input both pass. Accordingly this report does not claim demonstrated speculative payload leakage or treat the wider-input red alone as a settled safety blocker.

No runtime correction was made. Runtime remains the frozen candidate; this report grants no implementation or release acceptance.

## Evidence and independence

Reviewed `FOURTH/source`, `CUMULATIVE.patch` and raw `FIRST.log`, at HEAD `4d8157aa059f7e6e3fbb41de06ec0cb74de01973` plus frozen dirty source. BEFORE and AFTER manifests are identical (698 entries). Exact key source hashes:

| File | SHA-256 |
| --- | --- |
| experimental-publication/private.ts | 73f58da9919a92649f1741790b933cd3f0bb20e72a4c1dd7cb5de0d5fcfaf8ac |
| experimental-publication/lifecycle.ts | a17ce73e377489ee90345d55aa710c3cb013aef8fea36bc492a84fe885fbd42e |
| internals/intrinsic-mutation.ts | a16b715e9e37c58fe069bd1791f7ad9ac8aaa17a2a0cb0460d4dd860ed8544f3 |
| signal-tree.ts | cc61a3d7db0340992fac8639bd0fb145029f86ee489c8f4dc36481bfaa5b2115 |

The independent four-case test is byte-identical to my preserved first spec (`ac4407a0f0db940377f2334edcade0f1e3ee8e59386c6b8e7453786f72a33f00`). The scalar installed-publication spec is byte-identical to HEAD (`65da8178f977561bb234071fe90cea7c1a40b772c05f49f15a3dafc7c63221d7`). Aggregate15 source hash is `821b525ff50cb1ce124fc0230cd336f718eec2376a9c3ccd20d10866c6e3aabf`. I changed none of their assertions.

Limited independence disclosure: after inspecting the source and first failures, I opened FOURTH/COMMANDS.md for command identity; it also contained an author causal paragraph. That paragraph was seen, although no separate author verdict was requested or read. The source chains below were checked directly; the two added executable controls were independently specified before execution. Parent explicitly requested the same-tree discriminator and no-declaration control, without supplying their outcome.

Supplied first Nx run: 14:43:42, 58/64 passed, six failed across three files. The command runs the seven named specs through kernel Nx with `--skip-nx-cache`; exact command and raw output remain in FOURTH. Four other spec files passed. This review does not turn that focused result into broad qualification, nor evaluate the separate type logs.

## 1. Recipient-keyed capture still contaminates the shared frame

Executed: `aggregate-independent-input.spec.ts` now passes both branch cases and root-before-pending. Root-during-pending still fails line29 (`sent.length` 0 rather than 1). The raw diagnostic shows native x=1, no declaration error, p still7, and receipt `conservative/unknown`. Its later receipt/ownership assertions are not reached. This is the original useful-progress recurrence, not a newly chosen oracle.

FOURTH correctly changes `BranchInput` into a map of recipient-specific evidence (`private.ts:66–78`). `prepareScalar:155–160` reads only the current recipient's entry. That stops the previous flat fact-list union. But its `unknown` argument combines invalid native attribution, missing derive input, missing recipient coverage, and recipient proof unknown/invalid into one Boolean. It passes that Boolean to `lifecycle.prepareRevision:164`.

`lifecycle.ts:95–102` visits **all active frames** for every recipient's prepared operation. Line100 adds every frame to `unknownFrames` when that recipient's argument is unknown. Thus the passive late c2's baseline (`private.ts:178–179`) still makes c1's declaring frame unknown, through the lifecycle merge rather than the input list. `finish:149–155` freezes that shared frame status into c1's proof. This source chain explains the observed recurrence without claiming a private instrumentation trace.

The connection-local oracle remains grounded: changing only a passive subscriber's enrollment does not change native input identity, source revision, actual owner set, or active validation scopes. Unknown evidence for c2 cannot retroactively erase c1's established baseline. Conversely c1's good evidence must not grant c2 permission. Both directions remain required.

The additive frame update does fix the earlier last-revision collision: line101 writes `installedLast` only for matching frames, while known-owner/unknown contributions use additions. The three now-passing independent controls include truthful started receipts. That is meaningful bounded improvement, not evidence that the remaining shared-frame merge is sound.

## 2. Scalar exact-member admission is excluded

Four unchanged scalar tests fail in `a1-installed-publication.spec.ts`: ordinary omission, inspection-after-omission, cold absent enrollment/re-add, and cross-registry isolation. Three first failures are missing initial `undefined`; the cold absence case misses7. Later assertions in each failed test are not evidence of completed behavior.

At `private.ts:84–87`, membership preparation finds a scalar channel at the exact edited member address, then computes `inside = relativeSourceAddress(b.address,address)`. Exact addresses return an empty array, not undefined (`source-mutation.ts:50–59`). The `inside !== undefined` branch immediately skips every nonaggregate binding. This excludes a scalar whose own member is omitted/re-added, although that source is exactly the obligation being published. It is not a lookup limitation or permission to omit scalar compatibility. The old scalar baseline tests remain binding under aggregate approval.

This is a direct source guard error consistent with all four first failures. It should not be inflated into proof of cross-registry contamination: the cross-registry case reaches its own-tree omission assertion and fails because that legitimate send is missing. Its negative foreign-tree assertion passed first.

## 3. Wider native argument: preserve red, qualify the oracle

The aggregate15 test at lines125–133 enrolls a descendant pair connection, opens p on a separate owner tree, and uses the native root updater's unchanged local input.x=0 to author pair.x=1. It expects no send and conservative/unknown until p rolls back. Actual first failure is a send `{x:1,y:0}`. The receipt assertion follows that failure and does not execute; the raw result does not establish its basis.

Static mechanism: recipient coverage is explicitly unknown (`private.ts:72–75`) when the updater's argument is wider than the recipient. That unknown reaches the proof. However `fact.blockers` at161 depends on `completeDeclarationContext(channel)` before this newly prepared unknown is installed. It can therefore be empty under the valid declaration. `admit:206–212` then falls back to `scheduleDurableConsequence` when proof is not early and no tracked blocker is pending. That generic gate is explicitly tree-local (`commit-consequence.ts:175–220`): same-tree open scopes hold it, unrelated trees do not. A successful fallback adds a surviving grant, rather than proving declared independence. This is source-derived path attribution, not observed receipt-basis telemetry.

The exact approved aggregate proposal, readiness commit `2782af63d9ad38a905e594190b596b4537ae0143`, line17 says: “Existing conservative fallback must still respect another open owner q and known unresolved/unavailable foreign support.” Its immediate context is a surviving ordinary copy explicitly declared dependent on foreign p after p rejects. The wider-input test has no foreign p-support fact on the copied local value. It tests unavailable **recipient coverage**, not an actual observed foreign dependency. A0:157 says unknown historical evidence must still drain through the supported ordinary gate; A0:50 permits a fresh coherent surviving baseline after its actual gates pass. These clauses do not by themselves make the production tree-local gate global whenever coverage is incomplete.

Therefore retain the failed assertion and source mechanism as an unresolved conservative-coverage oracle. If the chosen contract requires unknown native argument coverage to retain the global relevant-pending set, FOURTH fails that contract; the required relevance rule must be stated, not inferred from the mere existence of p elsewhere. If normal tree-local surviving fallback suffices in this setup, the observed send is not declared permission or proven speculative leakage. Neither reading may clear an authentic unresolved/invalid foreign support fact or discard a known native updater owner. No assertion was edited to select either reading.

## 4. New discriminating controls: both pass

Two separate prewritten specs were saved before copying into the checkout. Both use public native constructors, transactions, Link and a root updater; no private proof injection. The declaration test uses only the existing isolated declare surface. Each was run once through the authorized exclusive Nx slot with Node24.15.0 and:

```sh
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=src/lib/<spec>.spec.ts --skip-nx-cache
```

- `FOURTH-independent-native-input/FIRST.spec.ts` → `aggregate-native-input-independent.spec.ts`, SHA-256 `0ec2b037b3af6a1271f747487c0f9c14261a879fd98c76147dd3a17b5a4c883d`: same-tree p owns root x=7; descendant pair connection declares independence around root updater copying input.x into pair.x. Expected native pair7 retained, p unchanged, no send while pending, receipt conservative/unknown. **1/1 pass**, first run14:49:36. All699 kernel source hashes identical before/after; original FOURTH698 entries unchanged before run.
- `FOURTH-independent-default-control/FIRST.spec.ts` → `aggregate-native-input-default-control.spec.ts`, SHA-256 `6a2d6071a14d203e0e33103e8af77750143ab5e4bdbec63c3fd3348f5d8486e0`: same sequence without any declaration. Expected native pair7 retained, p unchanged, no send while pending. **1/1 pass**, first run14:50:12; all700 source hashes identical before/after.

Each directory contains its preregistration, command, first log, before/after manifest and source-check result. Neither test checks delivery after rollback, fresh replacement recovery, or arbitrary foreign dependencies. They show the generic same-tree gate still contains this pending native input, and limit the claim about the wider-source red. They do not repair root passive-recipient interference or scalar membership.

## Representation decision

As currently specified and used, `prepareRevision(channel,revision,known,unknown,blockers)` does not represent two different meanings of unknown with distinct propagation rules. Native input/attribution uncertainty that belongs to the authored operation and shared enclosing validation must be retained. Recipient-only coverage or baseline uncertainty must remain local to that recipient rather than contaminate a different active declaration. The single Boolean loses this provenance before the shared merge.

An explicit distinction is therefore needed somewhere in the admission representation. It need not mandate a new public API, a global source-proof store, or even a particular TypeScript parameter list. A caller could retain recipient-local coverage in the immutable unit/proof and pass only genuine shared obligations into lifecycle validation; alternatively the private signature could encode those dimensions separately. In either case the distinction must survive installation, completion and fallback admission. The existing Fact.unknown alone is not sufficient: decisions at196–203 use projected Proof, and ready:103–106 reconstructs authored proof from lifecycle and stored input facts; uncovered-domain uncertainty has no independent fact carrying it if removed from the shared frame path.

Changing line100 to ignore every nonmatching recipient is not a complete semantic rule. An actual nested unknown/invalid declaration, then-getter failure, and known native authorship/input owner remain binding across enclosing horizons. The approved immutable declaration set must still be validated against accumulated known lower bounds. Recipient independence is not an exemption from enclosing validation.

The narrow proven conclusion is that recipient-keyed capture plus additive frame bookkeeping is insufficient. Required distinctions are native lower-bound provenance, shared validation obligations, recipient coverage, and conservative fallback eligibility. Root useful-progress recurrence and exact-member compatibility already reject this candidate without resolving the wider-input oracle or inventing a hidden-input waiver.
