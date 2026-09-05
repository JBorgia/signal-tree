import { computed, type ComputedRef, type Ref } from 'vue';

import { signalTree } from '../index';

const tree = signalTree(
  { count: 1 },
  { derived: ($) => ({ doubled: () => $.count.value * 2 }) }
);

const count: Ref<number> = tree.$.count;
const doubled: ComputedRef<number> = tree.$.doubled;
const vueProjection: ComputedRef<number> = computed(() => doubled.value);

count.value = vueProjection.value;

// @ts-expect-error derived refs do not expose writes
doubled.value = 4;

// @ts-expect-error Vue leaves use native `.value` access, not call syntax
tree.$.count();
