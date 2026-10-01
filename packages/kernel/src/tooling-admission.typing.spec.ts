import {
  entityMap,
  leaf,
  restoration,
  signalTree,
  transactions,
  type TreeId,
} from './index';
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

// Also preserve the supported explicit <T> spelling, including generic helpers
// whose accumulated surface is already known rather than reconstructed from T.
function admit<T, TAccum = unknown>(input: ToolingTree<T, TAccum>): void {
  treeCapabilities<T>(input);
  const id: TreeId | undefined = treeRuntimeId<T>(input);
  const confirmedId: TreeId | undefined = confirmedTurnReader<T>(input)?.treeId;
  stateLocationReader<T>(input)?.locate([]);
  entityMembershipReader<T>(input)?.snapshot();
  linkStateReader<T>(input).snapshot();
  restorationReader<T>(input)?.snapshot();
  transactionLifecycleReader<T>(input)?.snapshot();
  peekInternalTransactionRuntime<T>(input);
  void [id, confirmedId];
}

admit(tree);

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
