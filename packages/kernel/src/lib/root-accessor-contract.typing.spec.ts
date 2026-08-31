/** Compile-only controls for GREENFIELD-ROOT-ACCESSOR-SHAPE-0. */
import { asReadonly } from './readonly';
import { signalTree } from './signal-tree';

const next = { count: 2, user: { name: 'Grace' } };
const tree = signalTree({ count: 1, user: { name: 'Ada' } });

tree.$();
tree.$(next);
tree.$((current) => ({ ...current, count: current.count + 1 }));

// @ts-expect-error the tree is a controller, not a state location
tree();
// @ts-expect-error replacement belongs to the root state location
tree(next);
// @ts-expect-error derivation belongs to the root state location
tree((current) => current);
// @ts-expect-error root uses callable location grammar, not signal setters
tree.$.set(next);
// @ts-expect-error root uses callable location grammar, not signal updaters
tree.$.update((current) => current);

const readonlyTree = asReadonly(tree);
readonlyTree.$();
// @ts-expect-error readonly root has no replacement overload
readonlyTree.$(next);
// @ts-expect-error readonly root has no updater overload
readonlyTree.$((current) => current);
