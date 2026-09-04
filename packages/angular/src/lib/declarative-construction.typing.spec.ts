import {
  restoration,
  signalTree,
  type Location,
  type ReadonlyLocation,
} from '../index';

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
      const doubled = () => $.count() * 2;
      const summary = () => `${$.nested.label()}:${doubled()}`;
      return {
        doubled,
        summary,
        length: () => summary().length,
      };
    },
  }
);
const sourceLeaf: Location<number> = tree.$.count;
const derivedLocation: ReadonlyLocation<number> = tree.$.doubled;
void [sourceLeaf, derivedLocation];

export type _DeclarativeConstructionChecks = [
  Expect<Equal<(typeof tree)['$']['doubled'], ReadonlyLocation<number>>>,
  Expect<Equal<(typeof tree)['$']['summary'], ReadonlyLocation<string>>>,
  Expect<Equal<(typeof tree)['$']['length'], ReadonlyLocation<number>>>,
  Expect<Equal<(typeof tree)['canUndo'], () => boolean>>,
  Expect<NotOffered<typeof tree, 'derived'>>,
  Expect<NotOffered<typeof tree, 'state'>>
];

// @ts-expect-error positional derived factories are not a v15 construction path
signalTree({ count: 1 }, ($) => ({ doubled: () => $.count() * 2 }));

// @ts-expect-error fluent derived construction is not part of the v15 tree contract
signalTree({ count: 1 }).derived(($) => ({
  doubled: () => $.count() * 2,
}));
