import { computed, type ComputedRef, type Ref } from 'vue';

import {
  entityMap,
  link,
  signalTree,
  asReadonly,
  type AccessibleNode,
  type EntitySignalWithSlices,
} from '../index';

const tree = signalTree(
  { count: 1 },
  { derived: ($) => ({ doubled: () => $.count.value * 2 }) }
);

const count: Ref<number> = tree.$.count;
const doubled: ComputedRef<number> = tree.$.doubled;
const vueProjection: ComputedRef<number> = computed(() => doubled.value);
const reader = asReadonly(tree);
const readonlyCount: Readonly<Ref<number>> = reader.$.count;

count.value = vueProjection.value;
void readonlyCount.value;

// @ts-expect-error derived refs do not expose writes
doubled.value = 4;

// @ts-expect-error Vue leaves use native `.value` access, not call syntax
tree.$.count();

// @ts-expect-error a type-only view removes writes from the same Ref object
reader.$.count.value = 4;

// @ts-expect-error a demoted writable Ref is not an intrinsic ComputedRef
void reader.$.count.effect;

const linkTree = signalTree({
  count: 1,
  rows: entityMap<{ id: string; name: string }, string>(),
});

link(linkTree.$.count, { set: (value) => void value.toFixed() });
link(linkTree.$.rows, { set: (value) => void value[0]?.name });

const accessibleNode: AccessibleNode<{ label: string }> = signalTree({
  nested: { label: 'ready' },
}).$.nested;
void accessibleNode;

const slicedTree = signalTree({
  rows: entityMap<{ id: string; name: string }, string>().computed(
    'names',
    (rows) => rows.map((row) => row.name)
  ),
});
const slicedRows: EntitySignalWithSlices<
  { id: string; name: string },
  string,
  { names: string[] }
> = slicedTree.$.rows;
void slicedRows;
