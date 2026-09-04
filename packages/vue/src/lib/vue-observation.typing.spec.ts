import { computed, type ComputedRef } from 'vue';

import {
  signalTree,
  type Location,
  type ReadonlyLocation,
} from '../index';

const tree = signalTree(
  { count: 1 },
  { derived: ($) => ({ doubled: () => $.count() * 2 }) }
);

const count: Location<number> = tree.$.count;
const doubled: ReadonlyLocation<number> = tree.$.doubled;
const vueProjection: ComputedRef<number> = computed(() => doubled());

count(vueProjection.value);

// @ts-expect-error derived locations do not expose writes
doubled.set(4);
