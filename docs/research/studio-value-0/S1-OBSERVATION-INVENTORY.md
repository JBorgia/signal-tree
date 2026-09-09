# S1 — observation surface inventory

> **Inventory-first rule** (`MUTATION-OBSERVABILITY-0`, spec §8.5, §23): prove
> the existing observation paths insufficient before building a third one.
> This is that evidence. Conducted 2026-09-09 against `packages/kernel` at
> `c0b3d49a`.

## Verdict

**Do not build a new observer.** The kernel already produces every fact S1
needs and already delivers them to optional subscribers. What is missing is a
**supported read contract**, not production machinery.

The S1 seam is therefore an export/contract problem sized in the hundreds of
lines, not a new observation engine.

---

## A. What is actually public today

This corrects the record. Two documents overstate it.

| Surface | Reachable from `@signal-tree/kernel`? |
|---|---|
| `devTools()` enhancer | **yes** |
| `DevToolsDebugSession` (type only) | **yes** |
| `@signal-tree/kernel/adapter` | yes — but it is the *framework reactivity* substrate (`observeOwnerInvalidation`, `readCanonicalSnapshot`, `ObservationAdapter`), not semantic observation |
| `createAuditTracker` / `AuditEntry` / `AuditMetadata` | **NO** — `src/index.ts:123` is `export {} from './lib/audit/audit'`, which exports *nothing*. The implementation exists at `src/lib/audit/audit.ts:103` and is unreachable. |
| `exportDebugSession()` | **NO** — appears only inside a comment at `src/index.ts:81` |
| `PathNotifier` / `getPathNotifier` | **NO** — `src/index.ts:174`: "not root app API" |
| `interceptLeafSignals`, `getActiveWriteContext` | **NO** — `src/index.ts:95`: "not root app API" |
| all of `lib/internals/causal-runtime/**` | **NO** — internal; nothing re-exported |

### This changes the gate

Spec **§20.2** defines the control condition as "`devTools()`,
`exportDebugSession()`, `audit` `metadata.description`, logs, OTel, a
debugger." Two of those three programmatic surfaces **cannot be imported by a
user.**

**§3.2** repeats the error as a design caveat: *"The kernel already ships a
narrative hook the control can copy: `createAuditTracker`'s
`metadata.description`."* It does not ship it. The code exists; the export does
not.

The error runs in the direction that **flatters Studio**: it describes a
control stronger than the one a developer can actually assemble, so a real run
would compare against something weaker than documented and Studio would look
better than it earned. That is precisely the failure mode the preregistration
discipline exists to catch, and it survived four revisions of §20 because
every revision reasoned about the baseline from the spec rather than from the
export map.

Either §20.2 is corrected to what is reachable, or `audit`/`exportDebugSession`
are actually exported before the gate runs. **Not both, and not neither.**

---

## B. The causal semantics already exist, internally

`src/lib/internals/causal-runtime/causal-types.ts`:

```ts
interface CausalTurn {
  readonly id: TurnId;
  readonly effects: readonly CausalEffect[];
  readonly participants: readonly PositionId[];   // the participation parcel
  readonly state: 'pending' | 'confirmed';        // attempted vs committed
}

interface CausalEffect {
  readonly owner: PositionId;
  readonly before: unknown;
  readonly after: unknown;
  readonly subjectId?: unknown;
  readonly structural?: 'add' | 'remove' | 'rekey';
  readonly structuralContext?: StructuralEffect;
}
```

**`CausalTurn` is a direct answer to S1's question** — *"what did this
transaction actually cause state to become?"* — `effects` carries net
before/after per owner position, `participants` is the parcel, and `state`
distinguishes attempted from committed.

Also already modelled, in `lib/mutation-types.ts`:

- `WriteParticipation = 'authored' | 'realized' | 'inspection'` — **this is
  S2's authored-vs-external-truth distinction, already a first-class kernel
  axis**, deliberately independent of `origin`.
- `WriteMetadata.origin = 'restoration' | 'devtools' | 'external' |
  'transaction-rollback'` — provenance, closed union.
- `StructuralEffect` (`add`/`remove`/`rekey`) — S4's structural semantics.

Supporting machinery, all internal: `TurnStore`, `transaction-lifecycle.ts`,
`realization-context.ts`, `applied-turn-projection.ts`, plus confirmed/pending
rollback, undo, redo and reversal planning.

### Consequence for the slice plan

S1–S4 were scoped as if each slice adds observation machinery. It mostly does
not. The slices are better understood as **widening the supported read contract
over facts the kernel already produces**, which makes each slice cheaper and
the composition-refusal discipline (§8.5) *more* important, not less — refusing
a composition now means declining to expose a fact that exists, which is a
harder discipline to hold than declining to build one.

---

## C. Delivery already exists — do not add a third observer

`PathNotifier` delivers writes to optional subscribers.
`causal-runtime/transaction-capture-bridge.ts` is already a `PathNotifierHandler`
that filters those writes into transaction effects:

```ts
if (isInspectionWrite(meta) ||
    getWriteParticipation(meta) === 'realized' ||
    meta?.transactionId !== options.turnId ||
    meta.transactionOwner !== options.transactionOwner) return;
```

That is transaction-scoped capture, correctly excluding inspection writes
(DEVTOOLS-JUMP-0.1) and realizations. A Studio observer would duplicate it.

**Inventory-first is satisfied and its answer is negative:** the existing paths
are sufficient for S1's fact production. The insufficiency is in *reachability*,
not coverage.

---

## D. The zero-cost-when-unused pattern already exists

`src/lib/internals/path-observation-port.ts` implements the S1 disabled/unused
contract (§8.5) almost point for point, and states the principle verbatim:

> **ZERO-RUNTIME COST IS NOT ZERO-BUNDLE COST**

| S1 contract point | Existing mechanism |
|---|---|
| 1. No observer registered by importing the kernel | bare kernel never imports `path-notifier`; `runtime` starts `undefined` |
| 2. No event objects allocated when unused | `PORT.notify` delegates to `runtime?.notify` — no-op when uninstalled |
| 3. No retained global state when unused | single module-level `runtime`, `undefined` until installed |
| 4. No hot-path work when unused | `hasPathObservers()` short-circuits `owned-mutation` |
| 5. Studio code tree-shakeable | **type-only imports**, explicitly guarded: *"THIS MODULE MUST NEVER VALUE-IMPORT `path-notifier`"* |
| 6. Bundle delta measured | `tools/bare-module-list.mjs` (esbuild bundle carrier) + `tools/verify-gates.mjs` |
| 7. Disabled overhead benchmarked | `tools/bench-*.mjs` suite exists; no disabled-seam bench yet |
| 8. Enabling explicit and disposable | `installPathDeliveryRuntime()` / `resetPathDeliveryRuntime()` |

Measured precedent recorded in that file: `path-notifier.js` was 5,665 bytes of
a 33.7 KB bare bundle, and its *delivery* machinery measured **1.42 KB gzip** —
"four times the membership substrate and the dynamic seam combined."

**S1 follows this pattern rather than inventing one.** Points 6 and 7 are the
only genuinely new work: a bundle-delta number and a disabled-overhead
benchmark for the new contract.

---

## E. The Q4 trap is structurally enforced, not a discipline

`CausalTurn.effects` are **net** per owner position. The frozen incident's
intermediate `discount = 20.00` does not exist anywhere in the kernel's model —
not withheld, absent.

Studio cannot claim it even by mistake, because it has no source for it. The
Q4 trap (spec README) is therefore stronger than assumed: it tests whether
Studio *says* UNKNOWN rather than whether it resists a temptation.

---

## Recommended next step (step 3)

Specify the minimum kernel seam as a **read contract over `CausalTurn`**,
delivered through a port modelled on `PathObservationPort`:

1. Decide which of `CausalTurn` / `CausalEffect` becomes supported public
   shape, and which fields stay internal.
2. Add the port + lazy install, type-only imports, bundle carrier entry.
3. Resolve the §20.2 / §3.2 control-condition error **before** any gate run.
4. Then scaffold `studio-adapter` → `studio-query` → `studio-devtools`.

Open question for step 3, not decidable from code: `CausalTurn.participants`
is `PositionId[]`, and `PositionId` is a numeric identity. Studio needs a
stable, human-meaningful address for the parcel. §23 already carries "exact
turn identity surface" as open — this inventory confirms it blocks S1's
contract design, not just its UI.
