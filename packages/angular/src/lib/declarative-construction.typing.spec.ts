import { computed, type Signal, type WritableSignal } from '@angular/core';

import { restoration, signalTree } from '../index';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() =>
  T extends B ? 1 : 2
  ? true
  : false;
type Expect<T extends true> = T;
type NotOffered<T, K extends PropertyKey> = K extends keyof T ? false : true;

const tree = signalTree(
  { count: 1, nested: { label: 'ready' } },
  {
    enhancers: [restoration()],
    derived: ($) => {
      const doubled = computed(() => $.count() * 2);
      const summary = computed(() => `${$.nested.label()}:${doubled()}`);
      return {
        doubled,
        summary,
        length: computed(() => summary().length),
      };
    },
  }
);
const nativeLeaf: WritableSignal<number> = tree.$.count;
const nativeDerived: Signal<number> = tree.$.doubled;
void [nativeLeaf, nativeDerived];

export type _DeclarativeConstructionChecks = [
  Expect<Equal<(typeof tree)['$']['doubled'], Signal<number>>>,
  Expect<Equal<(typeof tree)['$']['summary'], Signal<string>>>,
  Expect<Equal<(typeof tree)['$']['length'], Signal<number>>>,
  Expect<Equal<(typeof tree)['canUndo'], () => boolean>>,
  Expect<NotOffered<typeof tree, 'derived'>>,
  Expect<NotOffered<typeof tree, 'state'>>
];

// @ts-expect-error positional derived factories are not a v15 construction path
signalTree({ count: 1 }, ($) => ({ doubled: computed(() => $.count() * 2) }));

// @ts-expect-error fluent derived construction is not part of the v15 tree contract
signalTree({ count: 1 }).derived(($) => ({
  doubled: computed(() => $.count() * 2),
}));
