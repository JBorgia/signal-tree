import {
  entityMap,
  leaf,
  restoration,
  signalTree,
  transactions,
  type TreeId,
} from './index';
import type { CarrierKind } from './lib/types';
import {
  confirmedTurnReader,
  entityMembershipReader,
  linkStateReader,
  restorationReader,
  stateLocationReader,
  transactionLifecycleReader,
  treeCapabilities,
  treeRuntimeId,
} from './internals';
import { peekInternalTransactionRuntime } from './enhancers/transactions/transactions';
import type { ToolingTree } from './lib/internals/tooling-tree';

type Row = { id: number; name: string };
const initial = () => ({
  count: 0,
  bounds: leaf({ min: 0, max: 10 }),
  rows: entityMap<Row, number>(),
});
const tree = signalTree(initial(), {
  enhancers: [transactions(), restoration()],
});

// Inferred construction retains an opaque object leaf beside a nominal marker.
treeCapabilities(tree);
treeRuntimeId(tree);
confirmedTurnReader(tree)?.readConfirmedTurns();
stateLocationReader(tree)?.locate([]);
entityMembershipReader(tree)?.snapshot();
linkStateReader(tree).snapshot();
restorationReader(tree)?.snapshot();
transactionLifecycleReader(tree)?.snapshot();
peekInternalTransactionRuntime(tree);

// Also preserve the supported explicit spelling, including generic helpers
// whose accumulated surface is already known rather than reconstructed from T.
//
// v16 (slice 6, class b): admission keeps v16's parameter order and carrier,
// ToolingTree<T, C, TAccum> (v15: <T, TAccum>). v16's root accessor is typed
// from the construction carried by TAccum (`StateAccessor<ConstructionOf<
// TAccum, T>> & TAccum`), so a generic helper forwards all three parameters;
// an explicit <T> alone would default TAccum and cannot forward a generic
// accumulated surface. Explicit <T> against a concrete tree is kept below.
function admit<T, C extends CarrierKind = CarrierKind, TAccum = unknown>(
  input: ToolingTree<T, C, TAccum>
): void {
  treeCapabilities<T, C, TAccum>(input);
  const id: TreeId | undefined = treeRuntimeId<T, C, TAccum>(input);
  const confirmedId: TreeId | undefined = confirmedTurnReader<T, C, TAccum>(
    input
  )?.treeId;
  stateLocationReader<T, C, TAccum>(input)?.locate([]);
  entityMembershipReader<T, C, TAccum>(input)?.snapshot();
  linkStateReader<T, C, TAccum>(input).snapshot();
  restorationReader<T, C, TAccum>(input)?.snapshot();
  transactionLifecycleReader<T, C, TAccum>(input)?.snapshot();
  peekInternalTransactionRuntime<T, C, TAccum>(input);
  // Inference through the same generic helper.
  treeCapabilities(input);
  stateLocationReader(input);
  entityMembershipReader(input);
  linkStateReader(input);
  restorationReader(input);
  transactionLifecycleReader(input);
  void [id, confirmedId];
}

admit(tree);

// Explicit <T> (and <T, C>) against a concrete tree whose state type is its
// construction: the spelling existing callers use.
type Plain = { count: number };
function admitExplicit(input: ReturnType<typeof signalTree<Plain>>): void {
  treeCapabilities<Plain>(input);
  treeRuntimeId<Plain, 'location'>(input);
  confirmedTurnReader<Plain>(input);
  stateLocationReader<Plain>(input);
  entityMembershipReader<Plain>(input);
  linkStateReader<Plain>(input);
  restorationReader<Plain>(input);
  transactionLifecycleReader<Plain>(input);
  peekInternalTransactionRuntime<Plain>(input);
}
void admitExplicit;

// Admission does not alter the neutral factory's leaf topology.
const bounds: { min: number; max: number } = tree.$.bounds();
// @ts-expect-error bounds is a terminal leaf, not a branch
tree.$.bounds.min();
void bounds;

const plain = signalTree({ count: 0 });
admit<{ count: number }>(plain);
// @ts-expect-error an explicit state type must still agree with the root accessor
treeCapabilities<{ count: string }>(plain);
// @ts-expect-error a root accessor alone is not a tree controller
treeRuntimeId(tree.$);
// @ts-expect-error arbitrary objects are not tree controllers
confirmedTurnReader({});
// @ts-expect-error arbitrary objects are not tree controllers
stateLocationReader({});
// @ts-expect-error arbitrary objects are not tree controllers
entityMembershipReader({});
// @ts-expect-error arbitrary objects are not tree controllers
linkStateReader({});
// @ts-expect-error arbitrary objects are not tree controllers
restorationReader({});
// @ts-expect-error arbitrary objects are not tree controllers
transactionLifecycleReader({});
// @ts-expect-error arbitrary objects are not tree controllers
peekInternalTransactionRuntime({});
// @ts-expect-error a value-only object is not a registered lifecycle carrier
restorationReader({ ...plain, destroyed: { value: false } });

tree.destroy();
plain.destroy();
