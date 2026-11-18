# Oversight application proof and v15 construction follow-through

The proposed engineering investigation, selected implementation changes,
qualification and fresh comparisons are complete. The v15 candidate is locally
qualified with its explicit size-cost acceptance; v16's previously qualified
runtime is unchanged. Human participant testing remains unexecuted.

This study completes the [registered follow-through](PROTOCOL.md) from the
[initial oversight evaluation](../2026-11-17-agent-oversight/README.md).
It separates three responsibilities: local state coordination, authenticated
durable application authority, and optional investigation tooling.

The useful result is an executable application boundary: independent accounts
approve exact commands; actual backend crashes and browser races preserve the
checked outcomes; missing evidence stays visibly missing. The small v15
construction change is selected for memory savings. Neither result establishes
that SignalTree prevents arbitrary AI mistakes or is universally faster than
other state libraries.

## What changed and what stayed optional

| Responsibility | Where it belongs | Result of this work |
| --- | --- | --- |
| Ordinary state, entity identity, Links and supported local restoration | Public runtime | v15 defers empty internal allocations; public API and configured behavior stay intact. |
| v16 pending ownership and coordinated publication | Existing public runtime | Exercised through the installed Angular facade; this application proof adds no new kernel mode. |
| Authenticated proposer/reviewer, tenant/destination scope, immutable approval, durable deduplication | Backend/application | New child HTTP/SQLite reference, including real process restart and revoked credentials. |
| Command-to-native-owner correlation, reload reconciliation, explicit unsafe-rollback recovery | Angular application | Twelve functional browser scenarios plus three isolated planted defects. |
| Recording, redaction policy, bounded transport, saved investigation | Separate private Studio | Private implementation and evidence remain private; no recorder/session/query code enters the public runtime. |
| Human comprehension and operational value | Actual users and deployed applications | Simulated investigator reviews completed and real-participant kits prepared; no human study or production deployment is claimed. |

## V15: a bounded memory improvement

The candidate shortcuts empty enhancer planning only when no explicit capability
request exists, and allocates empty observer/position containers on first use.
Late registration, held writers, ordinary delivery, configured transactions and
tree destruction retain their behavior. No supported method or enhancer is
removed. [The decision record](DECISIONS.md) explains the selection and rejected
alternative; [the generator protocol](../../../tools/v15-construction-cost/README.md)
defines useful work, process isolation, checkpoints and controls.

The first cohort ran 42 controls, 280 CPU children and 280 separate forced-GC
children across seven profiles and neutral/actual Angular carriers. At the
construction checkpoint, the combined candidate saved a paired median 217,816
bytes across 128 ordinary neutral eight-field trees. The corresponding Angular
cohort saved 217,232 bytes. Comparing lazy allocation with planning alone
normalizes to approximately 1,224 bytes per tree for that workload. This is a
whole-process difference divided by tree count, not an isolated heap-object size.
Planning also changes fixed process memory, so its entire saving cannot be
assigned to live trees.

CPU results are mixed. The first neutral ordinary and late-root episodes were
adverse; the preregistered follow-up retains them and measures twelve complete
store lifetimes per child, with seven matched rounds and adjacent A/A controls.
Its 24 controls and 112 children pass useful-work assertions. The earlier whole
episode regressions do not recur consistently, but some measured stages remain
adverse. A/A ranges describe observed noise, not confidence intervals. There is
no general speedup or equivalence claim.

The neutral bare experimental bundle increases by 60 gzip bytes. Canonical
package budgets are evaluated separately. An isolated EntityMap method extraction
preserves four consumers' behavior but increases CRUD gzip by 186 bytes and query
gzip by 194 bytes; its helper remains in the CRUD output. That particular split
is rejected. A negative decomposition experiment does not justify removing
supported stable APIs.

## Fresh comparison against other implementations

[The complete tables](COMPARISON.md) come from the unchanged registered eight-arm
Angular workload and fresh production builds. Actual completed results are 88
dispatch conformance cases, 32 context controls, nine metric controls, 16
calibration children, 176 comparison children and 12 analyzer-admission cases.
All nine phases pass on the first attempt. The comparison has 160 main samples
and 16 separate v15 A/A samples; CPU-facing and forced-GC children are separate.

At 10,000 rows, five-child medians are:

| Implementation | Store factory ms | Populated app heap MB | Additional heap at 128 pending MB | Checked commands/s |
| --- | ---: | ---: | ---: | ---: |
| Native Angular implementation | 6.8 | 10.838 | 0.522 | 212.4 |
| NgRx Signals | 4.6 | 5.187 | 0.554 | 207.3 |
| Selected v15 | 11.8 | 7.269 | 1.233 | 209.4 |
| Current v16 | 167.0 | 7.946 | 1.569 | 211.2 |
| TanStack DB | 38.2 | 7.627 | 1.093 | 215.0 |
| TanStack application alternative | 36.5 | 7.627 | 1.094 | 218.2 |

Heap is decimal MB above the blank application; the pending column is a further
increment. It includes framework, application and in-memory service state, not
library-exclusive bytes. Factory excludes seed generation. Throughput includes
the whole checked 180-command trace and its asynchronous service/validation work,
not isolated primitive updates. Pins are Angular 22.0.7, NgRx Signals 22.0.1,
TanStack Angular DB 0.2.12/DB 0.15.2, Node 24.15.0 and Chromium 141.0.7390.37.

The comparison still shows a substantial v16 startup premium. Against current
v15 its matched factory difference is +155.8 ms, with every pair between +151.4
and +158.7 ms. Navigation-to-layout medians are 47.8 ms for v15 and 203.7 ms for
v16. The subsequent checked workflow is much closer: current arms' repeated full
context p95 totals are about 3.0–3.4 ms, and enqueue-to-layout p95 medians are
11.6–12.7 ms. These are synthetic queued-input observations, not INP. Small
throughput rankings do not survive a persuasive noise/paired-difference argument.

V15 is slower to construct and uses about 2.08 MB more populated heap than the
NgRx implementation here. It uses about 3.57 MB less populated heap than this
native Angular implementation, while requiring more pending-operation memory.
Those differences describe these implementations of the same task, not an
inherent minimum cost for each library.

The latest cumulative changes do not transform that ranking. V15 saves about
3,188 populated bytes in this two-tree application; the many-tree construction
study answers a different workload. V16's matched factory median improves by
4.4 ms at 10,000 rows, while pending-128 and settled-128 heap decrease by about
7 KB and 18 KB. These remain modest against its startup premium. Before/after
compares frozen November 16 artifacts with current candidates, not the isolated
effect of the latest lazy-container or publication change.

Five rotated rounds and two v15-only A/A pairs per profile/kind are descriptive.
There is no v16-specific A/A noise distribution. Host one-minute load ranged
6.20–10.33; team heavy work was serialized, but the OS was not idle. Initial
context demand follows UI reads of 40 rows, and full-context timing follows
selected-row reads. Neither is untouched-store latency. Destruction leaves the
application/service fixture alive; residual heap is not a tree-leak verdict.

Independent recomputation verifies all 3,026 group, paired and A/A metric
summaries, plus raw input and analysis bindings. The common coordinator does
not make every peer implement v16's native guarantees. Those guarantees have
their own runtime qualification and the application proof below; this table
prices a common workflow, not equivalent complete library contracts.

## Qualified and exercised identities

| Subject | Runtime/source identity | Evidence |
| --- | --- | --- |
| Selected v15 | `4e791f32238fa7bdde480c5408a23dc4a4bca804` | 90/91 normal gates; 91/91 mutation summary plus independent 0/1/0 size control; five canonical archives/158 payloads; strict consumers/AOT/SSR; strict demo and 146 browser checks. |
| Current v16 | `5801008ea4ca591b3be483e8bbb0aa02e15f59ed` | Previously qualified runtime, reused unchanged. New strict-AOT application build, 12 browser cases, three browser controls and current peer cohort. |
| Frozen peer v15 baseline | `da2e92ccab46747471cae810fb9221f563d0a906` | Original prepared 15.4.9 kernel/facade archives, freshly measured. |
| Frozen peer v16 baseline | Kernel `2c439198b13a93ede29e7bece69a07a534f30797` | Original whole-input collector candidate with its unchanged inherited Angular facade; no claim that the facade was rebuilt at that kernel commit. |

V15 build seal is
`aba6872e95102a814a3930bb8040e0454ecde1c8e040ced6ddeba8c7269e450d`;
v16 build seal is
`9e88629aecfbd59014940bca99650c353e8d72817b869a47d838bda54575bf78`.
The final public application build-manifest SHA-256 is
`d07d34704a262a6c39117df70448747083b4435f8f4f0cef61e10fbc03c107cf`.
[Results](RESULTS.json) bind commands, exact receipts and identities.

The current v16 application and peer kernels match all 144 payloads; their Angular
archives share 16 identical payloads. The peer archive additionally contains the
non-exported build file `dist/index.d.ts`; both manifests direct public types to
`src/index.d.ts`. Runtime and declared-export equivalence is established, not
identical archive member sets. The first overly strict join and its corrected
direction/omission accounting are retained. Documentation-only successors never
replace the frozen runtime identities above.

## V16: application guarantees survive actual failures

The [authority API](../../../tools/agent-oversight-lab/durable-authority/API.md)
describes the protocol and trusted host setup. The store uses the reported SQLite
3.51.3 implementation with DELETE journaling and synchronous FULL. The business
update, effect count and receipt commit in one database transaction.

Fifteen backend scenarios pass. Actual SIGKILL before commit leaves zero effects;
the same command can then succeed once. SIGKILL after commit leaves one effect;
restart in a new process returns the original receipt without another effect.
Eight concurrent duplicates also produce one effect. Other cases cover exact
review binding, independent reviewer identity, authorization scope, changed
entity lifetime, ABA revisions, stopped work, revoked credentials during upload,
and bounded recent-review/event views. Two isolated authorization/deduplication
mutants fail named assertions against actual database effect counts; their
unmodified counterparts pass.

The [strict AOT Angular reference](../../../tools/agent-oversight-lab/application/README.md)
uses installed kernel and Angular archives rather than source aliases. Twelve
browser scenarios check actual reversed HTTP completion, stale snapshots,
preparation/refresh races, receipt replay, retained unresolved ownership after
history ages out, reload, new sessions, closed-page callbacks, stopped work,
entity replacement and explicit recovery. Useful independent edits and Link
delivery are asserted. False native settlement, hidden evidence gaps and ignored
entity lifetime are detected by three isolated browser controls.

Authenticated approval and a native transaction are distinct facts. Native
ownership does not survive navigation; the browser explicitly reconstructs a
new owner only for an unchanged pending command in the same authenticated
session. A new session does not silently adopt the old one. A lost response is
uncertain until a scoped receipt lookup reconciles it. The application binds that
receipt to the original command, request, operation, principal, scope, epoch and
digest before settling the matching owner.

The backend's recent review list is bounded to active reviews plus 64 terminal
records; old exact-ID recovery remains available. The event window is 256 and
the browser retains 64 events. This is separate from durable command/receipt
retention, which must have an application archival policy. Silent deduplication
eviction would invalidate the demonstrated replay guarantee.

Commands and failure schedules are deterministic test inputs; no live model's
decision quality is measured. This isolates approval, concurrency and recovery
behavior from model variability. It tests the application's handling of proposed
work, not whether an AI selects the right business action.

## Oversight: expose limits, not just events

The reference distinguishes local preview from a dated fetched server snapshot,
declared actor labels from authenticated accounts, rejected commands from
delivered effects, and unresolved local ownership from durable server outcomes.
It names unknown actors rather than inventing system attribution. Recovery and
retry controls explain their consequences. Export identifies the evidence window
held in the browser, with gaps and unavailable earlier records.

Independent simulated investigators used only rendered views, without source or
answer keys. Their findings drove corrections to attribution, zero counts,
snapshot freshness, retry wording, export scope and recovery explanation. Private
Studio received its own independent rendered-view review. Neither review is a
human usability study. The public and private participant kits remain explicitly
unexecuted; no fabricated participants or inferred comprehension rate appear in
the results.

Private monitoring is evaluated with runtime-only, SDK-loaded/unattached,
ordinary full recording, minimal metadata and redacted history arms. The native
useful-work result stays invariant. Bounded delivery fixes stalled-consumer
backlog, while privacy filtering has its own CPU and representation costs. Less
visible sensitive data does not automatically mean less heap or faster work.
Exact private source, distributions, A/A controls and final artifacts are retained
in the separate private delivery, not this repository.

## What this supports

V15 remains appropriate when its state, entity and local coordination facilities
solve the application's problem without v16's additional publication contract.
V16 has an executable role in a supervised agent application: proposals can
remain owned and coordinated while approval and durable delivery proceed, and
failed or obsolete work can be distinguished from confirmed work. It supplies a
local coordination layer inside a broader architecture.

The application and private tooling provide evidence of *what was observed and
settled*. They do not infer an agent's reasoning, prove that a reviewer was human,
detect all prompt injection, authenticate arbitrary tools or make external
services transactional. Those needs require application authorization, tool
isolation, durable service design and appropriate monitoring. A valid authorized
command can still be a bad business decision.

## Evidence and execution limits

Commands, source identities, artifact inventories, raw distributions, positive
and planted-defect controls, first failures and source restoration receipts are
retained with this study's final evidence packet. Counts are scenario counts,
not a claim of exhaustive correctness. Loopback HTTP and independent bearer
credentials are exercised; production identity providers, arbitrary remote
effects, power loss and real customers are outside this experiment.

The work prepares reviewable candidates. It does not publish npm packages, create
release tags, merge branches, deploy the public demo or publish private Studio.

## Portable evidence verification

The [archive](evidence.tar.gz) contains **13,436 verified file payloads**
(91,422,979 compressed bytes). [The inventory](EVIDENCE.json) binds every
archive-relative payload to its size, SHA-256 and original execution path;
[the collection plan](COLLECTION-PLAN.json) identifies the included inputs and
omissions. The archive SHA-256 is
`8617256c51dadb9dc4223de64f6396db4d33e5de27b70beed842ea122d1ecfc7`.

[Isolated verification](VERIFICATION.json) denied reads beneath the original
repository and produced passing/corrupt/missing/restored exit codes **0/1/1/0**.
The corrupt and missing copies had recomputed container hashes, so their failures
exercise actual payload hashing and exact membership rather than merely detecting
a changed compressed file. The original archive stayed unchanged.

From the repository root, verify without extracting or accessing original paths:

```sh
python3 tools/agent-oversight-lab/application/verify-evidence.py docs/audits/2026-11-17-oversight-followthrough/EVIDENCE.json
```

To inspect or recompute the comparison tables, extract into a new directory and
use the replay command in [the tables](COMPARISON.md). Execution receipts retain
their original paths as provenance; dependencies and omitted fixture databases
are not recreated by extraction. Archive integrity establishes the supplied
snapshots and results, not complete Git history or offline reproducibility of
every test. Private Studio source and raw evidence are deliberately excluded.

Final source-gate closure also corrected recognition of existing hyphenated
archive-part filenames. The first memory-exhaustion failure, the new failing
regressions and all 26 passing classification cases are preserved in the archive.
This tooling correction does not change the measured packages.

[Final closure checks](final-checks/receipt.json) pass lint, source controls,
documentation links/API/numeric claims, documentation validation, version claims,
release-state consistency and staged whitespace checks. All changed Python
generators parse. These checks supplement the frozen runtime qualification and
application results; they are not a substitute for a release gate run.
