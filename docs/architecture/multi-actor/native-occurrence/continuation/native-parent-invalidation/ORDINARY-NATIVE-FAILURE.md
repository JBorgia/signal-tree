# Native scalar parent invalidation: C11 / C12 safety failure

**Blocker demonstrated on both exact runtimes.** A child Link enrolled during a parent declaration later publishes `{x:7,y:8}` while the parent-invalidated x support still carries pending obligations. The original native requirement and recipient index initially retain those obligations correctly. A queued uncovered scalar notification subsequently downgrades publication support through the legacy fallback. This is not parent snapshot/presence-cache freshness, not omitted readiness activation, and not an oracle that may be waived because a declaration method is experimental.

The earlier assumption that Main's parent cache repair covered this case was wrong. It is explicitly withdrawn in `/private/tmp/st-c11-native-nine-classification/CLASSIFICATION.md`; the uncorrected report is preserved here as `PRIOR-CLASSIFICATION-UNCORRECTED.md`.

## Exact inputs and unchanged failure

- C11 manifest SHA-256: `dc21671bf92e2a74bd5798bfccfbc0b02d13e58dff4fe328758fd604d9f70148`, 3045 files.
- C12 manifest SHA-256: `d96cb84faeec4f098b4bba00deb9b82b108a33469b965978e4d248fa354b1df2`, 3053 files.
- Copied from `/private/tmp/st-native-combined-c11/candidate` and `/private/tmp/st-native-combined-c12/candidate`, verified against their respective manifests. Runtime and original test assertions unchanged. Root and frozen candidates untouched.
- Original `native-certificate-successor.spec.ts:33-47`, exact test `enrollment retains parent invalidation for scalar support`, independently replayed on each: **1 failed, 4 skipped**. First failure at line45 expects `[]`, receives `[{x:7,y:8}]`. No synthetic observer or private lifecycle injection in this test.

## Concrete source trace (same relevant source in C11 and C12)

1. `parent.declare(independent)` installs x=7. Native factory (`experimental-publication/private.ts:120-135`) stores its source requirement. The child Link enrolls before parent unwind; `bindSource:422-425` installs that exact requirement into its occurrence index.
2. Parent callback throws. `lifecycle.ts:392-405` marks executing frames invalid; `finish:341-364` seals native proofs and delivers readiness. Diagnostic records the same x requirement changing from unfinished/valid to ready, invalid=true, unknown=true, possible=[pending]. It is neither prematurely replaced nor missing completion activation. `recipient-occurrence.ts:59-71` updates its contribution on readiness; the child index subsequently reports that invalid pending support.
3. Child declares an independent y=8 write. This produces clean native y evidence; it does **not** revoke x's proof. The trace still sees invalid x and pending obligations after child completion.
4. The earlier x notification is delivered to the newly enrolled child. The child was not a recipient at x's installation, so notification coverage does not include it. `link.ts:822-828` takes the uncovered contribution path.
5. `private.ts:499-504` accepts that contribution: the enrolled native fact is not marked in `scalarFacts` (nativeFact at 389-393 versus authored recipient facts at 328), so `!scalarFacts.has(fact)` lets the queued ping through. This test is about receipt participation, not absence of native support.
6. Actual captured stack: `link.ts:827 -> projectScalarContribution:517 -> ready:304 -> drainLegacyScalars:511 -> project:483 -> installFact:156`. `project:477-486` manufactures `{owners:[],unknown:true,invalid:false}`, replaces the selected field contribution with that requirement, supersedes the current fact, and selects the generic unknown proof as the new publication fact. The original source-native x requirement remains invalid; the **recipient's selected proof loses its obligations**. In addition, this fallback current fact is not recomposed from complete aggregate support, so fixing only one stale marker is not established sufficient.
7. `private.ts:446-449,455-466` sees no pending owners/possible window on the fallback fact. It uses ordinary surviving admission. Instrumented `lifecycle.started` records basis **surviving**, and the external set callback receives `{x:7,y:8}` before q settles. This is not a successful new declaration validating x.

## Actual contradiction, not only an exception policy

A second bounded route replaces the arbitrary callback throw with an actual declaration contradiction:

```
parent.declare({kind:'independent'}, () => {
  tree.$.pair.x(7);
  child = link(tree.$.pair, sink);
  parent.declare({kind:'dependent', owners:[q]}, () => tree.$.pair.y(1));
});
child.declare({kind:'independent'}, () => tree.$.pair.y(8));
```

The outer declaration's empty responsibility contradicts installed shared validation involving q. Native x proof becomes invalid and includes pending responsibility; child y's fresh independence cannot erase it. Both instrumented C11 and C12 replays publish early through the same surviving fallback. An additional **uninstrumented** C12 safety falsifier verifies the thrown error has code `SIGNALTREE_PUBLICATION_DECLARATION_INVALID` and reason `contradiction`, verifies live values, then fails `expect(sent).toEqual([])` with exactly `{x:7,y:8}`. Its original source and first failure are preserved. There is no fabricated observer-trigger write or private requirement construction on this route.

## Frozen distinctions and violated obligation

- **Native dependencies:** source requirements retain destination/input evidence. This review does not infer data causality merely from q existing. In the original throw route q is a conservative possible-window member, not asserted to be a direct data input.
- **Shared validation:** the actual contradiction route puts q into the executing declaration's validation lower bound. `nativeProof:155-175`, `effective:235`, and `prepareRevision:265-277` retain that shared obligation. An independent child write to y does not author or cleanse x.
- **Recipient permission:** enrollment and notification coverage may govern participation/initial relationship permission; they must not discard known native or shared-validation obligations. `scalar-publication-coverage.ts:4` states “A receipt of recipient participation, never publication permission.” Missing coverage cannot be treated as missing native evidence.

These are the task's frozen distinctions. The existing exact test requires parent invalidation to survive enrollment. The available declaration contract (`docs/audits/2026-10-17-incumbent-readiness/link-declared-contract/SPEC.md`, Admission rules 1-4) additionally says early publication waits for validation, known dependencies form a mandatory lower bound, nested empty declarations cannot erase inherited known evidence, and failed validation must prevent early publication while retaining responsibility. That document identifies itself as a draft; it is supporting history, not authority to relax the user's frozen safety contract. The actual contradiction falsifier avoids relying solely on how an arbitrary user exception should be classified.

## Run evidence and limits

Raw commands, logs, exits, and observations are beside this report. All Nx runs used Node24.15.0 / pnpm10.17.0, one worker, no cache, own disposable checkout and root-derived working dependencies. Original commands:

```
corepack pnpm nx test kernel --skip-nx-cache --testFile=native-certificate-successor.spec.ts --testNamePattern='enrollment retains parent invalidation for scalar support' --maxWorkers=1
```

Executed once for each exact runtime (`c11-original`, `c12-original`). Diagnostic `parent-proof-diagnostic.spec.ts` executes the throw and contradiction paths, asserts the reproduced early-send behavior, and records pass-through native/occurrence/started observations: 2/2 on each runtime. Those green diagnostics are evidence of the defect, not safety passes. `c12-contradiction-first` is the independent uninstrumented negative test with the safety assertion, and fails as described. `c12-roles` adds role-specific proof recording to the same two routes.

No runtime patch, oracle correction, authority change, API-scope waiver, broad callback matrix, full suite, or progress-six work was performed. Causal classification is complete. A future correction must preserve native and shared validation support across late enrollment/uncovered notification handling; this report does not select a repair mechanism.

Role trace confirmed on C12: x after the callback throw has destination=[], input=[], validation=[], possible=[pending], invalid=true; after actual contradiction it has destination=[], input=[], validation=[pending], possible=[pending], invalid=true. Thus the latter is explicit shared-validation loss, not a fabricated data-input claim.

First diagnostic spec-type check exposed four TS2683 errors in pass-through spy functions (unannotated `this`). Raw failure is retained in `c12-spec-types.log`. Only the diagnostic gained `this:RecipientOccurrences`; runtime and safety assertions unchanged.

Final C12 spec-types passed (`c12-spec-types-final`). No baseline update. C11 diagnostic first-source typing is preserved as run; the corrected final diagnostic is archived separately.
