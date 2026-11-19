# SignalTree rebuild: agent brief

As of Nov 19, 2026 · Owner: Jonathan Borgia · Repo: JBorgia/signal-tree

## 1. Mission

Build a new SignalTree core in which framework-native cells hold the state, every write passes through one seam, and every advanced capability is a plugin that costs nothing until it is installed and nothing outside the scope it is attached to. Then port SignalTree's existing transaction, restoration and multi-writer semantics onto that core without losing a single guarantee.

The product serves real business applications in which several hands write the same state: the user, AI agents (including in-page agents via WebMCP), sync engines and backend pushes. It must:

- keep interactions responsive at production data sizes;
- never let one writer silently clobber another's in-progress work;
- let the user undo an agent's changes while keeping their own;
- stay flat on memory over a full working session;
- let developers choose which capabilities they pay for, when, and on which parts of the state.

How to use this brief.

- This document is the specification. Where it conflicts with anything in the repository (AGENTS.md, RELEASE-\*.md, TODO.md, HANDOFF.md, docs/), this document wins.
- Every section is binding. "Should" means must.
- You may not change the end goal, the budgets in section 6, or the rules in section 2. If one looks wrong, stop and ask (section 8).

Decisions already made. Do not reopen them.

1. Production, not vanity numbers. Performance and heap matter as measured by production scenarios (section 6). Isolated microbenchmarks and bundle size are reported, never targets.
2. Business use cases, not competitors. Design to the scenarios in section 6 and the behaviors in section 5. Never to another library's API or benchmark numbers.
3. The current architecture is wrong. Build a new core (section 4). Do not refactor, tune or extend the v15 or v16 kernel; use it only as a reference and as the oracle.
4. Multiple frameworks through adapters chosen when the tree is built. One factory per adapter, adoption of native signals passed in the state, and a per-call adapter option for tests. No global registration.
5. Strict gates, no partial credit. A phase is done only when its gates are green. Nothing merges as groundwork.

## 2. Rules

These rules exist because the previous agent-driven work lost the goal: costs were "accepted", groundwork shipped in place of fixes, claims went unmeasured, and agents graded their own work.

1. The gates are the definition of done. A phase is complete only when every gate it lists is green in CI. "Groundwork", "prepares for", "partial" and "follow-up" work does not merge on its own merit.
2. Budgets are fixed. Never edit bench/budgets.json, the scenario definitions or the harness. CODEOWNERS assigns them to Jonathan. If a budget cannot be met, stop and ask (section 8). Do not argue it down, waive it, mark it HOLD, or record the cost as "accepted".
3. No regressions. A PR that makes any measured scenario worse is rejected, even when it fixes correctness. A correctness fix carries its own offsetting cost work in the same PR.
4. No self-grading. Proof is CI output: tests, the semantics oracle, the scenario harness. Do not write audits, receipts, evidence bundles, qualification records or research notes; they count for nothing.
5. Claims are numbers. Any commit or PR that says "faster", "smaller", "removes" or "reduces" cites the CI delta for the affected scenario, or the claim is removed.
6. Scope is closed. No public API beyond section 4, no new capabilities, no economics, adoption or market studies, no research branches. A good idea outside scope goes in one line under "Proposals" in the phase report, and nothing more.
7. Experiments stay out of shipping code. No module named or living under experimental, research, prototype or spike may be reachable from a public entry point. A lint rule enforces this.
8. One line of truth. All work merges to main through PRs; releases are cut from main tags. Branches are short-lived and deleted after merge. No binaries or evidence tarballs in git.
9. Plain language. User docs, changelogs and error messages are written for application developers. Internal process words (HOLD, receipts, qualification, owner instruction, falsifier) never appear in them.
10. Small, reviewable PRs. One concern per PR; the PR body carries the report table from section 8.

## 3. Starting state

Repository (as of Nov 19, 2026):

- main was last updated Sep 24. Releases 15.4.9 and 16.0.0-rc.1 were cut from codex/\* branches; about 60 remote branches exist.
- Published: @signaltree/\* 14.1.4 (v14 line, maintained), @signal-tree/\* 15.4.9 on latest, 16.0.0-rc.1 on rc.
- v16 rc.1: kernel 63k source lines, 150k test lines; docs/ is 353 MB, 307 MB of it audit evidence tarballs.
- The full v16 kernel suite passes: 691 files, 7,416 tests (5 expected failures, 12 skipped), about 11.5 minutes.

Why the current kernel cannot be kept:

- transactions() and restoration() each reach into 30 of 92 lib/internals modules. There is no extension seam.
- Each leaf stores its value twice: a kernel values[slot] copy plus a mirroring framework signal.
- Each node eagerly gets an address (defineNodeAddress), a mutation source (registerIntrinsicMutationSource) and kernel dependency edges, whether or not any feature is installed.
- deepEqual runs on every write.
- In v16, the publication path (experimental-publication/lifecycle.js, intrinsic-mutation.js) takes about 78% of every leaf write even with no links and no other owners.

Measured baselines (Node 22, published tarballs, no enhancers; reference numbers only, not targets):

| Operation | v14.1.4 (Angular) | v15.4.9 (Angular) | v16 rc.1 (kernel) |
| --- | --- | --- | --- |
| Create a 5-leaf tree | 15.6 µs | ~70 µs | ~155 µs |
| Retained heap per tree | 6.0 KB | 17.9 KB | 26.8 KB |
| Leaf write | 0.045 µs | 0.075 µs | 4.8 µs |
| setAll 10k rows | ~5 ms | ~7 ms | ~355 ms |
| 10k updateOne | ~4 ms | ~10 ms | ~76 ms |
| Raw Angular signal.set | 0.008–0.014 µs | — | — |

Prior evidence worth reusing: docs/architecture/v15-performance-baseline.md section NATIVE-STORAGE-0 measured a native-storage leaf with full semantics at 17.08 ns, against 19.88 ns for v14 and 42.54 ns for v15 as shipped. Its contract is pinned in packages/angular/src/lib/native-storage-0-contract.spec.ts.

## 4. Architecture spec

### 4.1 Packages

| Package / entry point | Contains | May import |
| --- | --- | --- |
| @signal-tree/core | Structure, write seam, turns, writer context, plain cell, entityMap, leaf(), errors | Nothing outside itself |
| @signal-tree/core/adapter | Adapter contract, conformance test kit | core |
| @signal-tree/core/transactions | Transactions plugin | core |
| @signal-tree/core/restoration | Restoration (undo/redo) plugin | core |
| @signal-tree/core/writers | Multi-writer plugin: ownership, contention, links, declarations, inspect() | core |
| @signal-tree/core/devtools | DevTools and read-only tooling readers | core |
| @signal-tree/angular, /vue, /solid, /preact, /react | One adapter each, plus a factory re-export and type aliases | core, its framework |

Plugins are subpath exports so an app that never imports them ships none of their code. The new code lives in packages/ on main. The old kernel is not copied in; it stays reachable at tags v15.4.9 and v16.0.0-rc.1 and as published npm packages (used by the oracle in section 5).

### 4.2 Layers and cost rules

1. Storage. Each scalar leaf is one native cell from the adapter. Nothing else is allocated per leaf.
2. Structure. The tree holds the initial plain state. Accessors and cells are created lazily, on first access to a path. Untouched branches stay plain objects.
3. Write seam. Every mutation, from any API or any framework binding, becomes a WriteOp routed through the seam. With no interceptor covering the location, the seam does an equality check (Object.is by default; custom equality opt-in per leaf or subtree) and then adapter.commit.
4. Turns. A turn groups writes so observers see them as one change. A branch or whole-value write is an implicit turn. tree.turn(fn) is the explicit form.
5. Plugins attach to a scope (the whole tree or a subtree), register interceptors and observers there, and own all of their own state.

Normative cost rules (each is tested in section 6):

- C1: A write with no interceptor in scope allocates zero objects.
- C2: An uninstalled plugin adds no code to the bundle and no work at runtime.
- C3: An installed plugin adds no work for writes outside its scope.
- C4: Multi-writer cost depends only on the owners of the written location, never on tree size, write count, or links elsewhere.
- C5: Plugin memory is bounded by its configuration and released on detach or scope disposal.
- C6: Construction cost is proportional to what is accessed, not to the size of the initial state.

### 4.3 Contracts

```ts
// @signal-tree/core/adapter
export interface CellTypes<T> { plain: PlainCell<T> } // adapters augment, e.g. angular: WritableSignal<T>
export type NativeCell<Tag extends string, T> =
  Tag extends keyof CellTypes<T> ? CellTypes<T>[Tag] : never;

export interface CellAdapter<Tag extends string> {
  readonly tag: Tag;
  /** Create a native cell. Writes made through the cell's own API must call route(next), never store directly. */
  createCell<T>(initial: T, route: (next: T) => void): NativeCell<Tag, T>;
  /** Store a value the seam accepted. The only path that mutates storage. */
  commit<T>(cell: NativeCell<Tag, T>, value: T): void;
  /** Untracked read. */
  peek<T>(cell: NativeCell<Tag, T>): T;
  /** Observers see every commit inside fn as one change. */
  batch(fn: () => void): void;
  /** Optional: recognise framework cells passed in the initial state and adopt them without copying. */
  matches?(value: unknown): boolean;
  adopt?<T>(value: unknown, route: (next: T) => void): NativeCell<Tag, T>;
}

export function createSignalTreeFactory<Tag extends string>(adapter: CellAdapter<Tag>): SignalTreeFactory<Tag>;
```

```ts
// @signal-tree/core: the write seam
export type Origin = 'user' | 'agent' | 'sync' | 'server' | (string & {});
export interface WriterContext {
  readonly writer: string;          // e.g. 'user', 'agent:planner', 'sync:orders'
  readonly origin: Origin;
  readonly turn?: TurnHandle;
  readonly meta?: Readonly<Record<string, unknown>>;
}
export interface WriteOp<T = unknown> {
  readonly location: Location;
  readonly kind: 'set' | 'update' | 'insert' | 'remove' | 'move' | 'rekey';
  readonly next: T;
  readonly context: WriterContext;
}
export interface WriteEffect {
  readonly location: Location;
  readonly before: unknown;
  readonly after: unknown;
  readonly changed: boolean;
}
export interface Interceptor {
  readonly name: string;
  /** May observe, refuse (throw a typed SignalTreeRefusal), or transform. Calls next() at most once. */
  intercept(op: WriteOp, next: (op: WriteOp) => WriteEffect): WriteEffect;
}
```

```ts
// @signal-tree/core: plugins and scopes
export interface Plugin<Api> {
  readonly name: string;
  attach(scope: ScopeHandle): Attachment<Api>;
}
export interface Attachment<Api> { readonly api: Api; detach(): void }
export interface ScopeHandle {
  readonly path: readonly PathSegment[];
  intercept(interceptor: Interceptor): () => void;
  observe(listener: (effects: readonly WriteEffect[], turn: TurnInfo) => void): () => void;
  snapshot(): unknown;               // for late attachment
  onDispose(fn: () => void): void;
}
```

### 4.4 Public API

Keep v15/v16 names wherever the semantics carry over. Breaks are allowed in this major version, but each one is listed in the migration guide.

```ts
const tree = signalTree(state, { plugins: [transactions(), restoration({ retain: 100 })] });
const orders = tree.$.orders.use(writers());               // scoped attachment
tree.as({ writer: 'agent:planner', origin: 'agent' }, () => { /* writes attributed to the agent */ });
const t = tree.transact(() => { /* optimistic writes */ }); // t.inspect(), t.confirm(), t.rollback()
tree.turn(() => { /* several writes, one publication */ });
await tree.$.rows.setAll(bigArray, { chunk: 'auto' });     // yields between chunks when over budget
```

- Reads and writes use each framework's natural API: Angular leaf() / .set() / .update(), Vue .value, Solid accessor and setter, Preact .value, and .get() / .set() / .update() on the plain cell. The v15 kernel's call-style write (leaf(value)) is removed.
- entityMap<E, K>({ selectId }): addOne/addMany, setAll, updateOne/updateMany, upsertOne/upsertMany, removeOne/removeMany, rekey, move, byId, ids(), all(), count(). Row fields become cells only when accessed. Identity survives rekey.
- Adoption: native framework cells in the initial state are adopted through matches/adopt. leaf(x) marks anything ambiguous.
- Errors: keep the [ST####] codes and the onTreeError channel. Every refusal is a typed error that names its cause.

### 4.5 Writes that bypass the seam

Framework code can write to a native cell without calling its public setter (Angular Signal Forms or model() writing the signal node directly, Vue internals, devtools). Each adapter must guarantee one of these:

- (a) interception at the primitive level; or
- (b) drift detection: when the seam next reads or commits a cell, a value that differs from its last commit is routed as an external write, with origin 'framework', before anything else proceeds.

An unrouted write must never be invisible to an installed plugin. Each adapter ships a bypass test for every known bypass path in its framework.

## 5. Semantics to preserve

The existing semantics are the product's real value. Every behavior below must hold in the new core, proven three ways: ported tests, the differential oracle, and the scenario harness.

### 5.1 Required behaviors

Spec paths are relative to packages/ at tag v16.0.0-rc.1.

| ID | Behavior | Where it is pinned today |
| --- | --- | --- |
| T1 | Transactions are optimistic: speculative writes are visible immediately, before confirm() | angular/src/lib/demarcation.spec.ts, kernel/src/lib/demarcation-0.spec.ts, angular/src/lib/native-storage-0-contract.spec.ts |
| T2 | A rollback that cannot be proven safe refuses without changing anything and leaves the transaction pending; confirm() and a retried rollback() remain available | kernel/src/enhancers/transactions/hotfix-15-2-2-safety.spec.ts (H1–H9) |
| T3 | Rolling back an older transaction while a newer overlapping one is open refuses with cause later-pending-dependency; reversing the newer one first, then the older, succeeds | same, plus rollback-refusal-scope.spec.ts |
| T4 | A later confirmed write that depends on the change refuses with later-confirmed-dependency | rollback-refusal-scope.spec.ts, rollback-refusal-legibility.spec.ts |
| T5 | Supersession vs dependency: if newer truth removed the row (superseded), rollback completes the rest of the turn; if newer truth updated it (depends), rollback refuses | kernel/src/lib/nested-structural-rollback-1.spec.ts, heterogeneous-atomicity.spec.ts |
| T6 | A rekeyed row later deleted by another writer: rollback reverses the rest of the turn | transactions suite |
| T7 | A rollback's own compensation is never filed as a dependency, so out-of-order rollbacks still succeed | hotfix-15-2-2-safety.spec.ts |
| T8 | Confirmed turns are retained only while a pending turn could need them; diagnostic history is opt-in (history: { retain: N }); truncated is reported truthfully | transactions suite |
| T9 | inspect() reports each change as 'current' or 'superseded'; confirm() and rollback() snapshot it; 'current' means the contribution stands, not that the value is unchanged | proposal-inspection-safety.spec.ts |
| T10 | A throwing observer never strands transact(); observer errors reach onTreeError (at most 50 per tree per second) and [ST2034] | kernel/src/lib/tree-error-public-contract.spec.ts, after-commit-0.spec.ts |
| R1 | Undo applies only to operations marked undoable() and requires restoration() | kernel/src/enhancers/restoration/restoration.spec.ts |
| R2 | Undo refuses the whole operation if it would overwrite a newer write | restoration suite (74 spec files) |
| R3 | Undo and redo after a settled transaction, and after an overlapping rollback, behave as in 15.3.1 | restoration suite |
| R4 | History is bounded and its memory is released | restoration suite |
| E1 | A held row handle belongs to its entity lifetime; a reused key never retargets an old handle | kernel/src/lib/entity-\*.spec.ts |
| E2 | Field carriers are stable per handle and created on first access | entity suites |
| L1 | Links: endpoints and settled() while a transaction is pending; a disposed link withdraws the consequences it held | kernel/src/lib/entity-link-0.spec.ts, link-persistence-conformance.spec.ts, production-link-conformance-0.spec.ts |
| L2 | Conditional publication declarations: contributing pending owners, declared independence, or unknown completeness; PublicationReceipt.read(); admission is not delivery; invalid declarations throw SignalTreePublicationError with stage and reason; a no-write receipt neither creates nor clears an obligation | v16 link and publication suites |
| L3 | Local completion is never reported as remote durability | link suites |
| X1 | [ST####] error codes and messages stay stable; refusals are typed and name their cause | tree-error-public-contract.spec.ts |
| X2 | Tooling readers are read-only and confer no write or settlement authority | kernel/src/lib/\*reader\*.spec.ts |

### 5.2 New behaviors (the agent-safe editing goal)

| ID | Behavior |
| --- | --- |
| W1 | Every WriteEffect and history entry carries its WriterContext (writer, origin, turn) |
| W2 | A location held by a writer (an open transaction, or an explicit hold() while a user edits) is protected. Another writer's write follows the scope's policy: 'refuse' (default) with a typed refusal, 'queue' (applied when the hold ends), or a merge(current, incoming, context) function. A user's in-progress edit is never silently overwritten |
| W3 | Selective undo by writer: history.undo({ writer: 'agent:planner' }) reverses that writer's operations and keeps everyone else's, refusing (per T4/T5 rules) any part that newer writes depend on |
| W4 | A large ingest can be chunked ({ chunk: 'auto' }) and yields between chunks. Each chunk is atomic to observers, and the whole ingest can be rolled back as one turn |

### 5.3 How each behavior is proven

1. Port manifest. Create tests/port-manifest.json listing every spec file in the v15.4.9 and v16.0.0-rc.1 trees (about 875) with a disposition: ported (new path), superseded (names the new test that covers it), or internal (asserts implementation details that no longer exist, with a one-line reason). Jonathan reviews every internal entry before the phase that drops it can close.
2. Differential oracle. Build a property-based runner (fast-check) that generates operation sequences: writes, branch writes, entity operations, transactions, rollbacks, undo, redo, links, declarations, several writers. It replays them against the published @signal-tree/kernel@16.0.0-rc.1 (and @15.4.9 for the v15 surface) and against the new core. It compares every observable outcome: values, refusals and their causes, inspect() results, undo and redo results, receipts, error codes. The existing kernel/src/enhancers/transactions/semantics-authority.ts, semantics-contract.ts and semantics-composition-\*.ts are the starting point for its assertions.
3. Intended differences. Any difference the oracle finds must be listed in tests/intended-differences.json with its reason (for example, the renamed write API). That file is owned by Jonathan in CODEOWNERS; an unlisted difference fails CI.
4. New behaviors. W1–W4 get new tests plus oracle properties, such as: "no write from writer A changes a location held by writer B unless the policy allows it".

## 6. Harness and gates

Gates measure what production feels: blocked interactions, dropped frames, heap growth over a session, correctness with several writers. Published standards set the thresholds: good INP is 200 ms or less at p75; any task over 50 ms is a long task; input should be processed within 50 ms; scroll and drag need 16.7 ms frames.

### 6.1 Harness

- Location and ownership. Everything lives in bench/, owned by Jonathan in CODEOWNERS: bench/budgets.json, bench/scenarios/, reference apps in bench/apps/ (Angular first, one per adapter later), and the runner pnpm bench.
- Environment. CI Linux runner, Chrome stable via Playwright, CPU throttled 4× through CDP Emulation.setCPUThrottlingRate. Micro gates run in Node with --expose-gc.
- Attribution. Store time is measured with marks around the seam, plugins and adapter. Long tasks come from the Long Animation Frames API with script attribution to @signal-tree/\* code.
- Noise. Each scenario runs 5 times in fresh processes; the gate uses the median. The A/A noise of each scenario is measured in Phase 0. A regression is a median worse than main by more than the larger of 3% or the A/A noise.
- CI. Every PR runs M1–M3, S1, S3, S6, S7 and the oracle at 10,000 sequences. Nightly runs all scenarios, S5 included, and the oracle at 100,000 sequences. Results are CI artifacts, never committed.

### 6.2 Scale parameters

These are defaults until Jonathan replaces them with first production adopter numbers.

| Parameter | Default |
| --- | --- |
| Largest collection | 50,000 rows × 20 fields |
| Rows rendered at once | 1,000 |
| Sustained server update rate | 500 row updates per second, in batches every 100 ms |
| Agent batch | 1,000 field edits across 200 rows |
| Largest form | 500 bound fields |
| Session length | 8 hours |
| Slowest supported device | CI machine at 4× CPU throttle |

### 6.3 Gates

| Gate | Scenario | Budget (at 4× throttle unless noted) |
| --- | --- | --- |
| M1 | Leaf write with no interceptor in scope | ≤ 2.0× a raw native write in the same framework (Node, 1×); zero allocations per write over 1M writes (C1) |
| M2 | Leaf read through a held handle | ≤ 1.2× a raw native read (Node, 1×) |
| M3 | Build a tree from 100,000 leaves of initial state and access 10 of them | ≤ 1 ms and ≤ 2× the heap of the plain state plus 10 native cells (C6) |
| S1 | Form edit: one keystroke in the 500-field form | Store work ≤ 1 ms; whole interaction processing ≤ 50 ms |
| S2 | Live grid: 50k × 20 collection, 1,000 rows rendered, 500 updates/s for 60 s | Zero long tasks attributed to the store; store ≤ 10% of main-thread time; store heap overhead ≤ 1× the retained size of the plain row objects |
| S3 | Bulk replace of 50k rows with { chunk: 'auto' } | No main-thread task over 50 ms; total time reported |
| S4 | Agent batch applied while the user types into a held field every 100 ms | User's held value never overwritten (W2); agent apply ≤ 8 ms; inspect() ≤ 2 ms; rollback ≤ 8 ms; selective undo ≤ 8 ms; each user keystroke processed ≤ 50 ms |
| S5 | Soak: 8 hours of S2 + S4 traffic with transactions, restoration({ retain: 100 }) and writers installed (nightly may compress time but must apply at least 2M writes) | Heap growth over the final half of the run ≤ 2%; every plugin's internal collections stay at or below their configured caps |
| S6 | Scoped opt-in | (a) a core-only bundle contains no plugin code (symbol scan); (b) with every plugin attached to a different 10% subtree, M1, S1 and S2 stay within ±5% of a bare tree; (c) a bare tree is within ±2% of a build with the plugin folders deleted |
| S7 | Contention: a write to a location held by 1, 2, 8 and 32 owners | Cost linear in owners (R² ≥ 0.95 against a linear fit); an uncontended write is unchanged (±10%) with 10 vs 10,000 links elsewhere (C4) |
| Q1 | Correctness | 100% of ported tests pass; the oracle finds zero unlisted differences; every adapter passes its conformance and bypass suites |

Reported, never gated: bundle sizes, nanoseconds per isolated operation, construction microseconds.

## 7. Phases

Phases run strictly in order. A phase closes only when every exit criterion is green in CI on main and Jonathan has acknowledged the phase report. No work from a later phase merges early.

1. Phase 0: Reset and instruments. Starts only after Jonathan approves the reset.
   - Create release/15.x from tag v15.4.9 for maintenance.
   - Tag every codex/\*, fix/\*, wip/\*, optimization\*, research/\* and dead/\* branch as archive/&lt;name&gt;, then delete the branches.
   - On main, remove the old packages/, docs/audits/, docs/research/, specs/, TODO.md, HANDOFF.md, RELEASE-\*.md and every evidence tarball. Keep LICENSE and NOTICE.
   - Copy this brief verbatim to BRIEF.md (owned by Jonathan). Replace AGENTS.md and CLAUDE.md with a one-line pointer to it.
   - Scaffold the pnpm workspace and the empty packages from section 4.1.
   - Build the harness (6.1), the Angular reference app, the scenario scripts, bench/budgets.json from 6.2 and 6.3, CODEOWNERS, the CI workflows, the rule-7 lint and the S6(a) symbol scan.
   - Build the oracle runner against the published @signal-tree/kernel@15.4.9 and @16.0.0-rc.1, and generate tests/port-manifest.json with dispositions pending.
   - Exit: the harness runs end to end on a shim over published @signal-tree/angular@15.4.9 and records baselines; A/A noise is measured for every scenario; the oracle runs 10,000 sequences of v16 rc.1 against itself with zero differences; the lint and CODEOWNERS are active; Jonathan has approved budgets.json.
2. Phase 1: Core.
   - Plain cell, lazy structure, write seam, turns, writer context, entityMap, leaf(), typed errors and [ST####] codes.
   - The adapter conformance kit in @signal-tree/core/adapter.
   - Port every non-plugin spec in the manifest.
   - Exit: M1–M3 and S3 green on the plain adapter; Q1 for the ported core tests; zero unlisted oracle differences for operations with no plugins installed.
3. Phase 2: Angular adapter.
   - WritableSignal cells, .set and .update routing, bypass coverage for Signal Forms, model() and linkedSignal (4.5).
   - Adoption of signals passed in the initial state, defineStore and injector-scoped disposal, SSR state transfer.
   - Port the Angular specs.
   - Exit: M1–M3, S1, S2 and S3 green in the Angular reference app; Angular conformance and bypass suites green; Q1.
4. Phase 3: Transactions plugin.
   - T1–T10, plus W4's one-turn rollback of a chunked ingest.
   - Exit: Q1 for every transactions spec; zero unlisted oracle differences with transactions in the sequences; S6 for transactions; S4's apply, inspect() and rollback budgets green.
5. Phase 4: Restoration plugin.
   - R1–R4 and W3 (selective undo by writer).
   - Exit: Q1; oracle with undo and redo in the sequences; S4's selective-undo budget; S5 with transactions and restoration installed; S6 for restoration.
6. Phase 5: Writers plugin.
   - W1, W2, L1–L3; contention-scaled ownership; publication and inspect() across writers.
   - Exit: S4 complete, S7, S5 with all three plugins, S6 for writers; oracle with links, declarations and several writers in the sequences; Q1.
7. Phase 6: DevTools and readers.
   - Observers on the seam; X2.
   - Exit: S6 for devtools; reader specs ported; Q1.
8. Phase 7: Remaining adapters, one at a time in this order: Vue (customRef/shallowRef), Solid, Preact, React (plain cell plus useSyncExternalStore), then plain TypeScript.
   - Each adapter gets its own reference app.
   - Exit per adapter: conformance and bypass suites; M1–M3 and S1–S3 in its reference app; its ported specs; Q1. Svelte is out of scope.
9. Phase 8: Release.
   - Write user docs in plain developer language: README, per-package guides, API reference.
   - Write migration guides from 14.x, 15.x and 16.0.0-rc.
   - Write a plain-language changelog.
   - Add a deprecation notice on 16.0.0-rc.
   - Exit: two consecutive full nightly runs fully green; Jonathan's first production adopter validation passes against S1–S5 with real data; then publish the new major from a main tag.

## 8. Stop and ask

Stop work and ask Jonathan when:

- A gate is still red after three materially different approaches. Report the profile (top 10 functions by self time, allocations per operation) and what each attempt changed. Do not lower the budget or route around it.
- Two required behaviors conflict, or a ported test contradicts the oracle.
- A behavior seems to need public API beyond section 4.
- A test would be marked internal and you are not certain the behavior it pins is gone for good.
- The oracle finds a difference you believe is an improvement. Propose the intended-differences.json entry; do not add it yourself.
- Anything requires access to first production adopter code or data.
- A rule in section 2 would have to be broken to make progress.

Phase report. Every PR body and every phase close uses this format and nothing longer:

```text
Phase / PR:            <phase> — <one-line purpose>
Gates (median, CI):    gate | budget | main before | this PR | status
Oracle:                sequences run | unlisted differences (must be 0)
Tests:                 ported / superseded / internal / failing (counts)
Manifest changes:      entries changed, with dispositions
Profile (if a gate moved): top 10 self-time functions, allocations per op
Proposals (optional):  one line each, outside scope, not implemented
Blocked on:            question for Jonathan, or "nothing"
```

No other documents: no audits, essays, receipts or narrative logs.

## 9. Definition of done

The rebuild is done when all of the following are true on a main release tag. Nothing less counts as shipped.

- [ ] Every gate in section 6.3 is green for the core and for every adapter in Phase 7, on two consecutive nightly runs.
- [ ] Every behavior in 5.1 and 5.2 is covered by ported or new tests, and the oracle reports zero unlisted differences at 100,000 sequences.
- [ ] tests/port-manifest.json has no pending entries, and Jonathan has signed off every internal entry.
- [ ] Rules C1–C6 are each proven by a gate, not asserted in prose.
- [ ] No module from experimental, research, prototype or spike is reachable from a public entry point.
- [ ] User docs, migration guides and the changelog are written for application developers, with no internal process language.
- [ ] Jonathan's first production adopter validation passes S1–S5 with real data on the slowest supported device.
- [ ] The repository holds one line of truth: main, release/15.x, and tags. No open long-lived branches, no evidence tarballs.

## 10. Rulings on the Phase 0 review

These rulings answer the agent's review items 1–17 by number. **Where they conflict with an earlier section, they win.**

1. **Micro gates.** Decision 1 now reads: "absolute timings and bundle size are reported, never gated." M1–M3 remain gates because they measure ratios and allocations.
2. **Merging and phase gates.**
    - A PR may merge when all tests pass, no measured scenario regresses, every new code path is exercised by a test, and it implements only the current phase. A phase closes only when its gates are green.
    - "No groundwork" now means two things: no PR or report claims completion (only a phase close does), and no unexercised code merges.
    - S4 is split. S4a (apply, `inspect()`, rollback; no holds) closes Phase 3. S4b (selective undo) closes Phase 4. S4c (holds while the user types) closes Phase 5.
    - S5 runs with whichever plugins exist at that phase. The final S5, with all three plugins, closes Phase 5.
    - `inspect()` lives on the transaction handle, in the transactions plugin (T9). The writers plugin adds cross-writer publication status.
3. **Oracle authority.** In Phase 0, run the oracle with v15.4.9 against v16.0.0-rc.1 and give Jonathan the list of differences. He rules on each one. Where v16 rc.1 covers a behavior, it is the authority by default. R3 now reads "as in v16.0.0-rc.1".
4. **Turn lifecycle in core.** Core owns the turn lifecycle (open, pending, confirmed, rolled back), each with its `WriterContext`. It exposes read-only turn state and lifecycle events to plugins through `ScopeHandle`. Plugins still import only core. No work happens unless a turn is opened, so C1 holds.
5. **Holds and supersession.**
    - The `'refuse'`, `'queue'` and `merge` policies apply only to an explicit `hold()`.
    - Writes into locations held by a pending transaction resolve by v16's supersession and dependency rules (T5).
    - A refused write inside an agent turn rejects the whole turn atomically. The typed refusal names the location and its holder.
    - In S7, "owners" means pending transactions plus declared holders on the location.
6. **Turns versus chunks.** The publication unit is the chunk; the rollback unit is the ingest. The ingest handle captures the `WriterContext` when it is called, and rolling back an ingest is one compensating turn.
7. **Allowed public API:** every v16.0.0-rc.1 public export (renamed only where 4.4 says), plus `hold()` and its release, `history.undo({ writer })`, `tree.as()`, `tree.turn()`, the `plugins` option, `.use()`, the `setAll` chunk option and `signalTree(state, { adapter })`. Anything else, stop and ask. Rule 9 governs prose only; type names such as `PublicationReceipt` are fine.
8. **Allocation and drift.** `route(cell, next)` is one shared function, not a closure per leaf. Drift detection uses the framework's own version counter (the Angular signal node's `version`; each adapter documents its own in the conformance kit), never a stored copy of the value.
9. **Phase 0 baselines.** Phase 0 records baselines for M1–M3, S1 and S2 only. Each other scenario gets its baseline when its phase lands. Switching a measured implementation resets its baseline only with Jonathan's sign-off.
10. **Measurement fixes.**
    - S6(c) becomes a byte-identity check: the core-only bundle has identical bytes with and without the plugin folders present.
    - S7 becomes an upper bound: `cost(n) ≤ cost(1) + n × 0.5 µs` at Node 1× (a provisional coefficient), and an uncontended write is unchanged (±10%) with 10 vs 10,000 links.
    - Pin the Chrome version through the Playwright lock. M1–M3 run in Node at 1×.
    - Reference apps may be added by PR with Jonathan's review. `budgets.json` and the scenario definitions stay frozen.
    - Gates run on a dedicated self-hosted runner, which Jonathan provisions.
11. **Attribution.** Mark per turn, not per write, behind a bench-only build flag. The flag must be absent from production bundles, which the symbol scan verifies. Attribute long frames by overlap with those marks.
12. **Port manifest:** the union of both tags, `packages/` only (959 spec paths).
13. **Stray branches.** Archive-tag and delete `master`, `chaz-thoughts` and `release/15.3.0`. `chaz-thoughts` needs Jonathan's explicit yes.
14. **signaltree.io.** Jonathan points Vercel at `release/15.x` before any branch is deleted. The agent waits for confirmation.
15. **Removal list.** Also remove `.agents/`, `.claude/`, `.codex/`, `.cursorrules`, `RELEASE_PROCESS.md`, `V9_PLAN.md`, `apps/`, `api/`, `.github/instructions/`, `.github/skills/` and `.github/VALIDATION_GUIDE.md`. `main` keeps only `LICENSE`, `NOTICE`, `BRIEF.md`, the two pointer files and the new scaffold.
16. **Tarballs:** "no evidence tarballs" applies to `main`'s tree. History and tags are not rewritten.
17. **Enforcement.** Agents commit as a dedicated bot account. A ruleset on `main` requires PRs and the required status checks (tests, oracle, gates). Code-owner review is required for `BRIEF.md`, `bench/`, `tests/intended-differences.json`, `tests/port-manifest.json`, `CODEOWNERS`, and everything that decides which checks run or what passes: `ci/`, `.github/`, the oracle runner and its properties, the root `package.json` scripts, and the ESLint, Vitest and Playwright configs. The ruleset applies to admins (no bypass). Jonathan reviews collaborator write access.

**Local unpushed work.** Before the reset, commit the uncommitted changes in `~/code/signaltree_1` and in the two dirty worktrees to their own branches, push each local-only branch, and archive-tag it like the rest. Move the evidence tarballs to storage outside git.

## 11. Running unattended

The agent works continuously from Phase 0 through Phase 8. **Where this section conflicts with sections 7, 8 or 10, it wins.** No rule in section 2 is relaxed, and no budget changes.

### 11.1 Hard stops (the only reasons to wait)

1. Any change to `budgets.json`, the scenario definitions, or the code-owned files listed in ruling 17. Open the PR; it waits for Jonathan's review.
2. Any destructive repository operation not pre-approved in 11.3.
3. Breaking a rule in section 2.
4. Anything that needs first production adopter code or data.

### 11.2 Everything else is asynchronous

- **Questions.** Each question that section 8 would have stopped for becomes a GitHub issue labeled `needs-jonathan`. The issue carries the evidence and a recommended answer. The agent adopts the recommendation provisionally, marks the affected code with the issue number, and keeps working. When Jonathan answers differently, fixing it is the next task.
- **Sign-offs.** Oracle difference rulings, `internal` manifest entries and baseline resets go through the same issue queue. Unresolved sign-offs block the **release** (Phase 8), not the next phase.
- **Red gates.** A gate that stays red after three materially different approaches gets a `needs-jonathan` issue with the profile. The agent then keeps attacking it with new approaches and never lowers the budget. While a gate is red it may also work in the parallel lane below; it may not close the phase.
- **Parallel lane.** Adapter work (Phase 7) depends only on the core and the adapter contract, so it may run once Phase 2 closes, in parallel with Phases 3–6. Each adapter still closes only on its own gates.
- **Phase closes.** A phase closes when CI shows its gates green. Jonathan reviews phase reports asynchronously; his review does not block the next phase.
- **Merging.** PRs that touch no code-owned path auto-merge when every required check passes. PRs that touch code-owned paths wait for Jonathan's review while other work continues.

### 11.3 Pre-approved once, before the run starts

Jonathan gives these in a single message: the reset (archive tags, branch deletion, the removal commit), `chaz-thoughts`, the ruleset, the bot account, the self-hosted runner, Vercel on `release/15.x`, the default budgets, and the version number of the new major.

### 11.4 Mechanics

- **Done check.** Phase 0 adds `ci/done-check.mjs`, which is code-owned. It exits 0 only when every item in section 9 holds. Otherwise it prints the next unmet item and the open `needs-jonathan` issues.
- **Environment.** Run in an isolated container or VM, signed in as the bot account, whose GitHub token has write access but not admin.
- **Continuation.** Claude Code's `/goal` with the condition "`node ci/done-check.mjs` exits 0". A `Stop` hook acts as the backstop: it blocks stopping while the done check fails, and lets the session stop after 20 consecutive blocked stops with no new commit, so a stuck session can't loop forever.
- **Restarts.** A supervisor loop in `tmux` resumes the session with `--continue` whenever it exits before the done check passes, for example after a crash or a usage limit.
- **Status.** At the end of each phase, and every 24 hours, the agent posts a status comment (the section 8 report format) on a pinned issue named `Rebuild status`.
