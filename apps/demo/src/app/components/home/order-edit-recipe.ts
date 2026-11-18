import {
  entityMap,
  external,
  restoration,
  signalTree,
} from '@signal-tree/angular';

export interface DemoOrder {
  id: number;
  customer: string;
  priority: string;
  status: string;
}

/**
 * Executable v15 adoption recipe, used by the home story and its behavior tests.
 * The caller owns this tree. defineStore ties it to the providing injector;
 * direct callers must destroy it themselves.
 */
export function createOrderEditTree() {
  const tree = signalTree(
    { orders: entityMap<DemoOrder, number>({ selectId: (order) => order.id }) },
    { enhancers: [restoration()] }
  );
  external(() =>
    tree.$.orders.addMany([
      { id: 101, customer: 'Ada', priority: 'Standard', status: 'Packing' },
      { id: 102, customer: 'Lin', priority: 'Standard', status: 'Ready' },
    ])
  );
  return tree;
}
