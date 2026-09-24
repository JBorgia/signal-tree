import { entityMap, leaf, restoration, signalTree } from '../index';

type Row = { id: string; value: number };
const tree = signalTree({
  rows: entityMap<Row, string>(),
  nested: { rows: entityMap<Row, string>(), label: 'before' },
  terminal: leaf({ all: 'opaque' }),
  date: new Date(),
});
const rows: Row[] = [{ id: 'a', value: 1 }];
const canonical = {
  rows: { all: rows },
  nested: { rows: { all: rows }, label: 'after' },
  terminal: { all: 'opaque' },
  date: new Date(),
};
const read: typeof canonical = tree.$();
tree.$(canonical);
tree.$({ ...canonical, rows });
tree.$.nested({ rows: { all: rows }, label: 'after' });
tree.$.nested({ rows, label: 'after' });
tree.$((current) => {
  const existing: Row[] = current.rows.all;
  return { ...current, rows: { all: existing } };
});
// @ts-expect-error rows must preserve their declared payload type
tree.$({ ...canonical, rows: { all: [{ id: 'a', value: 'wrong' }] } });
// @ts-expect-error whole-value replacement still requires sibling state
tree.$({ rows: { all: rows } });
// @ts-expect-error ordinary object leaves do not acquire entity hydration syntax
tree.$({ ...canonical, terminal: rows });
void read;
tree.destroy();

// Opaque payloads must not be recursively interpreted as construction markers.
const opaque = { marker: entityMap<Row, string>() };
const opaqueTree = signalTree({
  opaque: leaf(opaque),
  rows: entityMap<Row, string>(),
});
const opaqueRead: typeof opaque = opaqueTree.$().opaque;
opaqueTree.$({ opaque, rows });
opaqueTree.$((current) => ({ ...current, rows: current.rows.all }));
void opaqueRead;
opaqueTree.destroy();

// Restoration history contains snapshots, not the original construction model.
const historical = signalTree(
  { rows: entityMap<Row, string>() },
  { enhancers: [restoration()] }
);
const historicalRows: Row[] =
  historical.getRestorationHistory()[0].state.rows.all;
// @ts-expect-error a historical snapshot cannot be used as a construction marker
const historicalMarker: ReturnType<typeof entityMap<Row, string>> =
  historical.getRestorationHistory()[0].state.rows;
void historicalRows;
void historicalMarker;
historical.destroy();

// Ordinary structural accessors do not need a new required construction brand.
import type { AccessibleNode, NodeAccessor, TreeNode } from '../index';
declare const unbranded: NodeAccessor<{ value: number }> &
  TreeNode<{ value: number }>;
const stillStructural: AccessibleNode<{ value: number }> = unbranded;
void stillStructural;

// Existing tooling helpers consume snapshots while retaining source topology.
import { applyState, snapshotState, unwrap } from './utils';
import { confirmedTurnReader, treeRuntimeId } from '../internals';
const hydrated = signalTree({ rows: entityMap<Row, string>() });
applyState(hydrated.$, { rows: { all: rows } });
const helperSnapshot: { rows: { all: Row[] } } = snapshotState(hydrated.$);
const unwrappedSnapshot: { rows: { all: Row[] } } = unwrap(hydrated.$);
confirmedTurnReader(hydrated);
treeRuntimeId(hydrated);
// @ts-expect-error applying a snapshot must retain row payload types
applyState(hydrated.$, { rows: { all: [{ id: 'a', value: 'wrong' }] } });
void helperSnapshot;
void unwrappedSnapshot;
hydrated.destroy();
