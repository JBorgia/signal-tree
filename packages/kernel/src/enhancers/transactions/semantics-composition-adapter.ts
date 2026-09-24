/** Actual public combinations. No synthetic policy, dependency tracking or canonical state. */
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { link } from '../../lib/link';
import { external } from '../../lib/external';
import { undoable } from '../../lib/undoable';
import { batching } from '../batching/batching';
import { restoration } from '../restoration/restoration';
import { transactions, peekInternalTransactionRuntime } from './transactions';
import { adaptCurrent } from './semantics-current-adapter';
import { UnsupportedSemantic } from './semantics-contract';
import type {
  Combination,
  CompositionJobs,
} from './semantics-composition-domain';

function scalarTree(configuration: Combination) {
  const initial = { x: 0, y: 0, z: 0 };
  const tree = configuration.batching
    ? signalTree(initial, { enhancers: [transactions(), batching()] })
    : configuration.restoration
    ? signalTree(initial, { enhancers: [transactions(), restoration()] })
    : signalTree(initial, { enhancers: [transactions()] });
  return { tree, runtime: peekInternalTransactionRuntime(tree) };
}
function entityTree(configuration: Combination) {
  const initial = {
    x: 0,
    y: 0,
    z: 0,
    rows: entityMap<{ id: string; x: number; y: number; z: number }, string>(),
  };
  const tree = configuration.batching
    ? signalTree(initial, { enhancers: [transactions(), batching()] })
    : signalTree(initial, { enhancers: [transactions()] });
  return { tree, runtime: peekInternalTransactionRuntime(tree) };
}
export async function makeComposition(configuration: Combination) {
  const { tree, runtime } = configuration.entity
    ? entityTree(configuration)
    : scalarTree(configuration);
  const rows = 'rows' in tree.$ ? tree.$.rows : undefined;
  if (rows) external(() => rows.addOne({ id: 'held', x: 0, y: 0, z: 0 }));
  const locations = rows ? rows.byIdOrFail('held') : tree.$;
  const fixture = adaptCurrent(
    {
      $: locations,
      transact: (operation) => tree.transact(operation),
      destroy: () => tree.destroy(),
      destroyed: () => tree.destroyed(),
    },
    runtime,
    () => ({}),
    tree
  );
  const relationships = new Set<ReturnType<typeof link>>();
  // A Link-labelled combination must actually have Links even in context cases
  // that do not install their own observed endpoint. Constructor failures stay
  // errors; do not silently downgrade this combination to transactions alone.
  try {
    if (configuration.link) {
      relationships.add(link(locations.x, { set: () => undefined }));
      relationships.add(link(locations.y, { set: () => undefined }));
    }
  } catch (error) {
    for (const connection of relationships) connection.dispose();
    fixture.dispose();
    throw error;
  }
  const composition: CompositionJobs = {
    group(mode, operation) {
      if (mode === 'direct') {
        operation();
        return;
      }
      if (
        mode === 'batch' &&
        'batch' in tree &&
        typeof tree.batch === 'function'
      ) {
        tree.batch(operation);
        return;
      }
      if (
        mode === 'coalesce' &&
        'coalesce' in tree &&
        typeof tree.coalesce === 'function'
      ) {
        tree.coalesce(operation);
        return;
      }
      throw new UnsupportedSemantic(
        `${configuration.id} has no ${mode} capability`
      );
    },
    external,
    readEntityState() {
      if (!rows)
        throw new UnsupportedSemantic('No entity state in this combination');
      return rows.all();
    },
    undoable(operation) {
      if (!configuration.restoration)
        throw new UnsupportedSemantic(
          `${configuration.id} has no restoration capability`
        );
      undoable(operation);
    },
    undo() {
      if ('undo' in tree && typeof tree.undo === 'function') return tree.undo();
      throw new UnsupportedSemantic(
        `${configuration.id} has no undo capability`
      );
    },
    outbound(key, receive) {
      if (!configuration.link)
        throw new UnsupportedSemantic(
          `${configuration.id} has no Link capability`
        );
      const connection = link(locations[key], { set: receive });
      relationships.add(connection);
      return {
        settled: () => connection.settled(),
        dispose() {
          connection.dispose();
          relationships.delete(connection);
        },
      };
    },
    isCompositionRefusal(error) {
      return (
        error instanceof Error &&
        error.message ===
          'A transaction cannot defer its writes beyond its callback; put coalesce() inside the transaction'
      );
    },
  };
  // Let entity initialization finish before transaction/Link controls begin.
  for (let i = 0; i < 6; i++) await fixture.flush();
  return {
    ...fixture,
    composition,
    ...(rows
      ? {
          async prepareConflict() {
            external(() => rows.addOne({ id: 'collision', x: 0, y: 0, z: 0 }));
            await fixture.flush();
            const h = fixture.candidate.beginContribution(() => {
              locations.x(1);
              rows.removeOne('collision');
            });
            await fixture.flush();
            external(() => rows.addOne({ id: 'collision', x: 2, y: 0, z: 0 }));
            await fixture.flush();
            return h;
          },
        }
      : {}),
    dispose() {
      try {
        for (const connection of relationships) connection.dispose();
      } finally {
        relationships.clear();
        fixture.dispose();
      }
    },
  };
}
