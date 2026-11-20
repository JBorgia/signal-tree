// The behavior catalog: one entry per BRIEF.md 5.1 and 5.2 row, in table
// order. A row the operation vocabulary can express has a property module;
// any other row is listed with the reason it cannot be generated yet.
// Where a row leaves room, the properties' readings are provisional pending
// Jonathan's answer on #23 (BRIEF.md 11.2).
import { E1 } from './e1.js';
import { E2 } from './e2.js';
import { L1 } from './l1.js';
import { L2 } from './l2.js';
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
import { X1 } from './x1.js';
import { BEHAVIOR_IDS, type BehaviorId, type CatalogEntry, type Property, type Unexpressed } from './types.js';

const NEW_BEHAVIOR =
  'New behavior (5.2): the published packages have no writer identity, holds or chunked ingest, so replaying them cannot exhibit it; it is tested against the new core.';

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
    row: 'Local completion is never reported as remote durability',
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
];

const PROPERTIES: readonly Property[] = [T1, T2, T3, T4, T5, T6, T7, T9, T10, R1, R2, R3, E1, E2, L1, L2, X1];

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
