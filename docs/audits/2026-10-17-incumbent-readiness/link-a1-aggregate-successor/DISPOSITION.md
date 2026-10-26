# Aggregate successor: rejected integration checkpoint

The owner-authorized aggregate experiment is preserved at
`2d71d73305fea23173b3b681c2a897ef1a7dffba`, branch
`codex/link-a1-successor-experiment`. Its runtime parent/reference is rejected A1
`d0e7d1659900b18c9a63d280f409c0448a0c1d80`; intervening
`4d8157aa059f7e6e3fbb41de06ec0cb74de01973` only added the public owner-construction
tests. Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`.

**Reject this successor for integration. The recurrence stop applies to dependent
aggregate runtime repair.** The authorized behavior remains the target; neither
API acceptance nor production activation follows from this experiment. B remains
closed. No runtime from this checkpoint is integrated into readiness.

## Decisive result and causal boundary

The combined focused run reports **58 ordinary passes and six failures in 64
tests**, seven files, no skips or expected-failure verdicts. Preserve that raw
result. Five failed assertions establish two runtime defects:

1. A root connection enrolled before an unrelated pending transaction has known
   input evidence. Adding a passive second connection during that transaction
   still prevents the first connection's declared independent updater from
   publishing. Native x becomes1; the send list remains empty. Recipient-keyed
   input capture corrected the producer, but `prepareRevision` folds the passive
   recipient's uncertainty into every active validation frame. This is recurrence
   of the unchanged noninterference falsifier after the attempted general repair.
2. Aggregate membership routing excludes scalar sources at the exact edited
   address: relative path `[]` is treated as a descendant of a nonaggregate source
   and skipped. Four unchanged scalar omission/re-add controls lose required
   sends. This does not prove cross-registry contamination; that test fails on its
   legitimate own-tree omission after its foreign-tree negative assertion passed.

The sixth failed assertion expected unknown updater coverage to wait for an
unrelated tree's pending owner. Independent review found that the approved
tree-local surviving fallback does not clearly entail that oracle in the absence
of an established foreign dependency. Keep the test and its first failure
unchanged as an **unresolved oracle/coverage question**, not a demonstrated leak.
The author's causal inventory initially described this as premature fallback;
that interpretation is explicitly qualified here. Two separately preregistered
same-tree pending-input controls subsequently passed, one declared and one default
Link. Neither observed speculative output. They do not repair the five failures.

The existing admission representation conflates native input lower bounds,
shared validation obligations, and recipient-only coverage in one `unknown`
value. A successor must preserve those distinct facts through installation,
completion and fallback. Ignoring all nonmatching recipients is insufficient:
actual enclosing declarations, validation reentry and known native ownership
must remain binding. This is a mechanism prerequisite, not a selected repair,
new public API, or authority to discard conservative evidence.

## Evidence retained separately

| Evidence | Executed result and limit |
| --- | --- |
| Initial frozen d0 aggregate discriminator | Nine unsupported-source failures before callbacks; no unsafe updater execution demonstrated |
| Early aggregate revisions | Original first reds, source copies and correction attempts retained; not superseded into a cumulative pass count |
| Final combined vector | 58/64; five established failed assertions plus one oracle-qualified failure |
| Additional independent controls | Two separate 1/1 passes; same-tree native input remains held, declaration/default separately |
| Native retained-member presence | Earlier 40/40 scoped vector, independent3/3 and later handoff11/11 with overlaps; do not sum them or qualify all writers |
| Heterogeneous invalidation containment | 45/45; independent review supports the changed inner mechanisms; direct outer adapter member publication remains a source-derived gap, not a newly executed failure |
| Selected entity rich capture | One private controlled callback witness fails: after left restoration it sees right50/60 instead of right11/12. Its later final777 assertion is not reached |
| Entity selected-install extraction | Read-only independent mapping; no native extraction implemented or qualified |
| Source typecheck | `tsc --noEmit -p tsconfig.typecheck-all.json` passed on the frozen runtime |
| Spec-types gate | Failed: two fixture typing errors in `ordinary-presence-independent.spec.ts`; not waived or corrected |
| Auxiliary kernel-lib type command | Eleven internal fixture diagnostics; separate failed auxiliary run, not the registered source gate |

The retained-member source fixes and invalidation corrections keep their bounded
results. They do not qualify this aggregate implementation. The optional ordinary
payload handoff has its focused failure/retry controls but no independent runtime
review beyond the earlier presence-core review. Entity collection declaration,
fresh-key enrollment, complete selected-unit publication, wider input coverage,
framework composition, teardown/collectibility, artifact and cost qualification
remain incomplete. No full suites or cost campaign was run after these blockers.

The entity trace identifies a distinct existing boundary: structural commit still
prepares and delivers capture/native callbacks before later selected rows install.
Existing prepared occupancy and placement stages provide possible extraction
primitives; independent early preparation against the original live topology is
incorrect. Native selection carrier refresh is itself callback-capable. These
source findings do not establish an implemented repair or justify a second inverse
selector. Original public mixed-undo Link and private rich-capture falsifiers stay
unchanged.

## Review and verification

Independent aggregate review verified the source chain and executed the two new
controls. It discloses seeing an author causal paragraph bundled with command
metadata after its initial source inspection; its own traces and new first runs
are retained. Root separately verified the same source chain, raw failures,
approved fallback clauses and exact source hashes. Independent D3 review separates
the passing inner scope from the untested containing route. Selected-install
review independently maps existing primitives without selecting new semantics.

The final commit was made after the recorded runs; no tests were rerun merely to
obtain a commit SHA. `FROZEN-SOURCE-CHECK.json` verifies all 698 files from the final
64-test manifest are byte-identical at freeze. The two added independent specs
have their own identical pre/post manifests (699 and700 files). The final worktree
is clean. This is exact-source attribution, not a claim that every command was
launched at the final SHA. Staged diff checks passed. The known spec typing and
runtime failures are intentionally preserved.

## Replay

Use Node24.15.0 (`.nvmrc`) and Corepack pnpm10.17.0. The original runs used the
installed dependencies shared with the frozen A1 checkout. Each raw directory
records its full command and source identity. In the preserved experiment:

```sh
cd /private/tmp/link-a1-successor-experiment
git rev-parse HEAD
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=packages/kernel/src/lib/aggregate-installed-publication.spec.ts --testFile=packages/kernel/src/lib/aggregate-independent-input.spec.ts --testFile=packages/kernel/src/lib/a1-installed-publication.spec.ts --testFile=packages/kernel/src/lib/a1-independent-review.spec.ts --testFile=packages/kernel/src/lib/internals/a1-publication-installation.spec.ts --testFile=packages/kernel/src/lib/a1-ingress.spec.ts --testFile=packages/kernel/src/lib/aggregate-owner-construction.spec.ts --skip-nx-cache
corepack pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json
node tools/check-spec-types.mjs
```

For the decisive unchanged useful-progress counterexample alone:

```sh
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=packages/kernel/src/lib/aggregate-independent-input.spec.ts --skip-nx-cache
```

The archive includes a Git bundle requiring preserved ancestor d0e7d165, raw
evidence with hashes, original failed expectations, source snapshots, review
limits and exact additional replay commands. No favorable resampling, ceiling
changes, API export, activation, push, merge, tag or publication occurred.
