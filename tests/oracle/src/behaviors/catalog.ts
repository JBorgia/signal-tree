// The behavior catalog: one entry per BRIEF.md 5.1, 5.2, 12.4 and 12.5 row, in table
// order. A row the operation vocabulary can express has a property module;
// any other row is listed with the reason it cannot be generated yet.
// Where a row leaves room, the properties' readings are provisional pending
// Jonathan's answer on #23 (BRIEF.md 11.2).
import { D1 } from './d1.js';
import { E1 } from './e1.js';
import { E2 } from './e2.js';
import { H1 } from './h1.js';
import { L1 } from './l1.js';
import { L2 } from './l2.js';
import { O1 } from './o1.js';
import { O2 } from './o2.js';
import { O3 } from './o3.js';
import { O4 } from './o4.js';
import { R1 } from './r1.js';
import { R2 } from './r2.js';
import { R3 } from './r3.js';
import { T1 } from './t1.js';
import { T10 } from './t10.js';
import { T2 } from './t2.js';
import { T3 } from './t3.js';
import { T4 } from './t4.js';
import { T5 } from './t5.js';
import { T6 } from './t6.js';
import { T7 } from './t7.js';
import { T9 } from './t9.js';
import { W5 } from './w5.js';
import { X1 } from './x1.js';
import { X3 } from './x3.js';
import { BEHAVIOR_IDS, type BehaviorId, type CatalogEntry, type Property, type Unexpressed } from './types.js';

const NEW_BEHAVIOR =
  'New behavior (5.2): the published packages have no writer identity, holds or chunked ingest, so replaying them cannot exhibit it; it is tested against the new core.';

const RELEASED_MEMORY =
  'Needs a garbage-collection observation (a WeakRef or FinalizationRegistry cleared after a forced collection), which a replay cannot make deterministic; covered by hand-written tests on the new core.';

const ROWS_12_5 =
  'Added in BRIEF.md 12.5; generator properties for the rows the vocabulary can express follow once the row text is approved.';

const UNEXPRESSED: readonly Unexpressed[] = [
  {
    id: 'T8',
    generatable: false,
    row: "Confirmed turns are retained only while a pending turn could need them; diagnostic history is opt-in (history: { retain: N }); truncated is reported truthfully",
    reason:
      'The vocabulary has no history option, and no subject exposes retained confirmed turns or a truncation report to observe.',
  },
  {
    id: 'R4',
    generatable: false,
    row: 'History is bounded and its memory is released',
    reason:
      'Needs a configured history cap and heap measurement; the vocabulary has neither, and sequences are too short to reach a cap. Memory belongs to the scenario harness (S5).',
  },
  {
    id: 'L3',
    generatable: false,
    row: 'No API reports a write as durable (settled() resolving, a receipt reading delivered) until the endpoint has acknowledged it; a local commit or confirm alone never does',
    reason:
      'The spec names no observable that reports remote durability: settled() is tied to pending transactions (L1) and PublicationReceipt has no specified fields.',
  },
  {
    id: 'X2',
    generatable: false,
    row: 'Tooling readers are read-only and confer no write or settlement authority',
    reason: 'The vocabulary has no tooling readers.',
  },
  {
    id: 'W1',
    generatable: false,
    row: 'Every WriteEffect and history entry carries its WriterContext (writer, origin, turn)',
    reason: NEW_BEHAVIOR,
  },
  {
    id: 'W2',
    generatable: false,
    row: "A location held by a writer (an open transaction, or an explicit hold() while a user edits) is protected. Another writer's write follows the scope's policy: 'refuse' (default) with a typed refusal, 'queue' (applied when the hold ends), or a merge(current, incoming, context) function. A user's in-progress edit is never silently overwritten",
    reason: NEW_BEHAVIOR,
  },
  {
    id: 'W3',
    generatable: false,
    row: "Selective undo by writer: history.undo({ writer: 'agent:planner' }) reverses that writer's operations and keeps everyone else's, refusing (per T4/T5 rules) any part that newer writes depend on",
    reason: NEW_BEHAVIOR,
  },
  {
    id: 'W4',
    generatable: false,
    row: "A large ingest can be chunked ({ chunk: 'auto' }) and yields between chunks. Each chunk is atomic to observers, and the whole ingest can be rolled back as one turn",
    reason: NEW_BEHAVIOR,
  },
  {
    id: 'D2',
    generatable: false,
    row: '**Released memory.** A removed row or field releases its memory once no history entry, pending transaction or held handle references it.',
    reason: RELEASED_MEMORY,
  },
  {
    id: 'R5',
    generatable: false,
    row: "**Exact reversal.** An undo, redo or rollback that is not refused leaves every location it reverses exactly as it was immediately before the reversed writes: scalar values, row field values and field presence (absent versus present with undefined), row existence, key and held handle, nested collections, and the absence of omitted members. Order is part of a collection's existence: a reversal restores the exact prior order, each row at its prior position. This holds when the reversed turn composed several writes to one row (update then remove, rekey then field write, remove then re-add) and when the prior value was written by another writer context.",
    reason: ROWS_12_5,
  },
  {
    id: 'R6',
    generatable: false,
    row: '**History position.** History position, `canUndo` and `canRedo` report the position after every undo, redo, new undoable entry, eviction or reset, and change in the same turn (O2). A new undoable write made after an undo discards the redo entries and becomes the newest entry. A refused undo or redo changes nothing, position included.',
    reason: ROWS_12_5,
  },
  {
    id: 'R7',
    generatable: false,
    row: '**Undo granularity.** One `undoable()` call records exactly one history entry, however many locations it writes; `undoable()` calls nested in it, or made in the same `tree.turn()`, join that entry, and `confirm()` alone records none. A turn whose undoable writes net to no change (rewriting the current value, adding then removing a row, a rekey round trip) records no entry, and writes composed in one turn record their net effect (an add then a rekey records one add under the final key).',
    reason: ROWS_12_5,
  },
  {
    id: 'R8',
    generatable: false,
    row: "**Reversals through the seam.** Undo, redo and rollback write through the seam with origin `'reversal'` and the writer context of the writes they reverse. Interceptors in scope observe them but may not transform them: an interceptor that refuses a reversal, or attempts to transform it, makes the whole reversal refuse with a typed error and no change (a refused rollback leaves the transaction pending, per T2).",
    reason: ROWS_12_5,
  },
  {
    id: 'V1',
    generatable: false,
    row: "**Membership by whole-value write.** A whole-value write to a branch or row makes its members exactly the written value's own keys. A key it supplies that did not exist becomes a location; a member it omits becomes absent (not present with undefined) on every read path, and a link on it sends undefined (an absent collection sends `[]`). A write that names a row of an absent collection refuses with a typed error; a write beneath an absent member re-adds only its own path; an updater on an absent member receives undefined. Undo, redo and rollback restore absence and presence exactly.",
    reason: ROWS_12_5,
  },
  {
    id: 'V2',
    generatable: false,
    row: '**Opaque values.** Only plain objects are branches. Class instances, built-ins (Date, Map, Set, RegExp, typed arrays), functions and values marked `leaf()` are opaque leaf values: one location each, stored and returned by identity, never walked into, copied or invoked, and written, compared (`Object.is`), snapshotted, sent through links, undone and rolled back as a whole.',
    reason: ROWS_12_5,
  },
  {
    id: 'V3',
    generatable: false,
    row: "**Construction input.** Initial state is validated before any plugin initializes. A framework cell is adopted only when the adapter's `matches()` accepts it (4.4); any other reactive value, and any cell, handle or marker belonging to another tree, refuses construction with a typed error naming its path. Getter-backed members are read once.",
    reason: ROWS_12_5,
  },
  {
    id: 'V4',
    generatable: false,
    row: "**Key identity.** A literal key containing `.` or `@`, or the empty key, is a different location from the nested path it spells, and an entity key keeps its type, so `1` and `'1'` are different rows. Writes, turns, rollback, undo, redo, `inspect()`, links, history and snapshots never merge, split or retype a key. A null or undefined entity key refuses with a typed error.",
    reason: ROWS_12_5,
  },
  {
    id: 'V5',
    generatable: false,
    row: '**Caller input is never owned.** The tree never freezes, mutates or keeps a live reference to a caller-supplied object, row or array: after a write the caller may mutate its input without changing tree state, and a stored row keeps its prototype, symbol keys and non-enumerable fields.',
    reason: ROWS_12_5,
  },
  {
    id: 'V6',
    generatable: false,
    row: '**Stable handles.** Reading the same path returns the same handle object every time, before and after whole-value writes that remove and re-add it, and inside and outside transactions; the handle always reads the current value.',
    reason: ROWS_12_5,
  },
  {
    id: 'V7',
    generatable: false,
    row: "**Depth and size.** Results do not depend on nesting depth or call size: at any depth, and for entity calls, turns and snapshots larger than the engine's call-argument limit (over 130,000 rows), writes, observation, undo, redo, rollback, links and snapshots behave as they do for shallow, small inputs.",
    reason: ROWS_12_5,
  },
  {
    id: 'V8',
    generatable: false,
    row: "**Tree isolation.** Two trees, of the same or different shape and created in any order, share nothing observable: a write, turn, transaction, rollback, undo, link, lifecycle event or history entry in one never changes, notifies or blocks the other, and each tree's readers and lifecycle events report only that tree.",
    reason: ROWS_12_5,
  },
  {
    id: 'E3',
    generatable: false,
    row: "**Atomic entity calls.** Every entity call is all-or-nothing. `addOne`/`addMany` on an existing key, `updateOne`/`updateMany` or `removeOne`/`removeMany` on a missing key, `rekey` onto an occupied or missing key, and a key repeated within one call's input each refuse the whole call with a typed error naming the key: nothing is written, no history entry is recorded, and earlier work stays reversible. A successful update keeps the row's lifetime (E1), and rekeying a key to itself changes nothing.",
    reason: ROWS_12_5,
  },
  {
    id: 'E4',
    generatable: false,
    row: "**Collection order.** A collection has one order, which `all()`, `ids()`, snapshots and links report. New rows append after the existing tail in input order; `move` places a row where addressed; `rekey` and updates keep a row's position; `setAll` and a whole-value write set the order to the input's order; a removal closes the gap. An `all()` result already returned never changes.",
    reason: ROWS_12_5,
  },
  {
    id: 'L4',
    generatable: false,
    row: '**Links outside a pending transaction.** With no pending transaction on the linked location, every turn that changes it (a write at any depth, including to members re-added after the link was created, a removal, a reorder, an undo, redo or rollback) sends the endpoint the complete current value of the linked location: a branch link sends the whole branch, a collection link sends `all()` rows in collection order, and an absent location sends undefined (an absent collection `[]`). A turn that leaves the value deep-equal sends nothing. After `dispose()` a link sends and applies nothing, including a `get()` that resolves later; a new link on the same location resumes delivery.',
    reason: ROWS_12_5,
  },
  {
    id: 'L5',
    generatable: false,
    row: "**Link sends and inbound values.** A link has at most one send in flight; writes made meanwhile are sent next as the then-current value, so the endpoint ends at the newest value, and a payload once handed to the endpoint is never mutated by later writes. A rejected send reaches `onTreeError` as a typed error and the link recovers by sending the current value. An inbound value (from `get` or `subscribe`) replaces the linked location whole as a write with origin `'sync'` in the link's writer context, becomes the link's baseline, and is never sent back through the same link (a fresh deep-equal value included), though other links on that location receive it; an inbound value older than one already applied never overwrites it. Creating a link whose endpoint has neither `set` nor `get`/`subscribe`, or on a location that cannot be written, refuses with a typed error.",
    reason: ROWS_12_5,
  },
  {
    id: 'T11',
    generatable: false,
    row: '**Failed transaction body.** A `transact()` body that throws any value (undefined included) is rolled back and that value is rethrown; no observer sees its writes, and later transactions still roll back normally. If that rollback is refused (T2–T4), the thrown typed error carries the still-pending transaction so the caller can `inspect()`, retry `rollback()` or `confirm()`. A write whose updater or value getter throws partway installs none of its effects; outside `transact()`, writes completed before the throw stand.',
    reason: ROWS_12_5,
  },
  {
    id: 'T12',
    generatable: false,
    row: '**Nesting and settlement.** `transact()` called inside a transaction body or inside `tree.turn()` refuses with a typed error before its body runs and leaves the outer transaction or turn usable. Repeating `confirm()` or `rollback()` on a settled transaction is a no-op that returns the same result; settling it the other way, or settling it from an observer of its own rollback, refuses with a typed error and changes nothing. A transaction whose body writes nothing opens, confirms and rolls back like any other.',
    reason: ROWS_12_5,
  },
  {
    id: 'T13',
    generatable: false,
    row: '**Explicit turns.** Inside `tree.turn(fn)`, each write applies immediately and later reads in `fn` see it; observers run once after `fn` (O2); the values, writer contexts and undo eligibility after the turn equal those from making the same writes without it. If `fn` throws, every write in the turn is reverted, nothing is published, and the error is rethrown.',
    reason: ROWS_12_5,
  },
  {
    id: 'H2',
    generatable: false,
    row: "**Snapshots.** A snapshot contains exactly the tree's state: no markers or their configuration, no internal references or library brands, and user symbol keys kept. Its plain objects and arrays are frozen, never change after it is taken, and are not objects live state holds; opaque values appear by identity (V2). An unchanged subtree keeps its reference from one snapshot to the next; a changed one gets a new reference.",
    reason: ROWS_12_5,
  },
  {
    id: 'X4',
    generatable: false,
    row: "**Tooling readers.** The history reader lists each retained entry's net effects (location, writer context, kind, before, after) in order and omits net no-ops. Turn lifecycle events (ruling 4) arrive in order, each after the state it reports: open, pending, then confirmed or rolled back for each transaction; a refused rollback emits nothing and leaves the transaction pending (T2). A reader attached late replays nothing, and an entry once returned never changes.",
    reason: ROWS_12_5,
  },
  {
    id: 'X5',
    generatable: false,
    row: "**Prototype safety.** No value entering the tree (initial state, a write, an updater result, a link's inbound value, a devtools payload) changes the Object, Array or Function prototypes. A `__proto__` key refuses with a typed error naming its path; keys named `constructor` or `prototype` are own data; inherited properties are never read as state or sent through a link.",
    reason: ROWS_12_5,
  },
  {
    id: 'X6',
    generatable: false,
    row: "**Error attribution.** Every `onTreeError` event carries an id for its tree that is stable for the tree's lifetime and distinct between live trees, and the location involved; for a link failure, that is the link's source location.",
    reason: ROWS_12_5,
  },
  {
    id: 'F1',
    generatable: false,
    row: "**Form bindings.** An edit through a framework form binding to a tree location (Angular Signal Forms or `model()`, and each adapter's equivalent) is a synchronous tree write: tree reads, observers, links, holds (W2) and undo (inside `undoable()`) see it before the next read, and a tree write is visible through the binding before the next read.",
    reason: ROWS_12_5,
  },
  {
    id: 'W6',
    generatable: false,
    row: '**Writer contexts inside transactions.** A write made inside a `transact()` body under another writer context (`tree.as()`) is not part of the transaction: rollback never reverses it, it counts as a later write under T4 and T5, and it is not undoable. An async callback passed to a context-setting scope (`tree.as()`, `undoable()`) refuses with a typed error instead of running with its context dropped after the first `await`.',
    reason: ROWS_12_5,
  },
];

const PROPERTIES: readonly Property[] = [T1, T2, T3, T4, T5, T6, T7, T9, T10, R1, R2, R3, E1, E2, L1, L2, X1, O1, O2, O3, O4, X3, D1, W5, H1];

const byId = new Map<BehaviorId, CatalogEntry>([...PROPERTIES, ...UNEXPRESSED].map((e) => [e.id, e]));

/** Every behavior, in BRIEF.md table order. */
export const CATALOG: readonly CatalogEntry[] = BEHAVIOR_IDS.map((id) => {
  const entry = byId.get(id);
  if (!entry) throw new Error(`behavior catalog has no entry for ${id}`);
  return entry;
});

export const isProperty = (entry: CatalogEntry): entry is Property => entry.generatable;

export function catalogEntry(id: string): CatalogEntry | undefined {
  return byId.get(id as BehaviorId);
}
