import {
  asReadonly,
  batching,
  entityMap,
  external,
  link,
  restoration,
  signalTree,
  transactions,
  undoable,
} from './index';
import type {
  EntitySignal,
  Link,
  SignalTree,
  TransactionMethods,
  TreeConfig,
} from './index';

const config: TreeConfig = {};
const tree = signalTree(
  { rows: entityMap<{ id: number }, number>(), count: 0 },
  { enhancers: [batching(), restoration(), transactions()] }
);

const typedTree: SignalTree<{ rows: ReturnType<typeof entityMap<{ id: number }, number>>; count: number }> = tree;
const rows: EntitySignal<{ id: number }, number> = tree.$.rows;
const readonlyTree = asReadonly(tree);
const transactionMethods: TransactionMethods = tree;
const connection: Link = link(tree.$.count, { get: async () => 1 });

undoable(() => tree.$.count(1));
external(() => tree.$.count(2));
connection.dispose();

void typedTree;
void rows;
void readonlyTree;
void transactionMethods;
void config;
