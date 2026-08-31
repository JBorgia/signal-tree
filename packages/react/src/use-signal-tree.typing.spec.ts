import { signalTree } from '@signal-tree/kernel';
import { useSignalTree } from './use-signal-tree';

const tree = signalTree({ count: 1, user: { name: 'Ada' } });

export const count: number = useSignalTree(tree, ($) => $.count());
export const user: { name: string } = useSignalTree(tree, ($) => $.user());
export const whole: { count: number; user: { name: string } } = useSignalTree(
  tree,
  ($) => $()
);

// @ts-expect-error a projection is required; whole-root observation is explicit
useSignalTree(tree);
// @ts-expect-error custom equality is not part of the initial observation API
useSignalTree(tree, ($) => $.count(), { equal: Object.is });
// @ts-expect-error selector root type is inferred from the supplied owner
useSignalTree(tree, ($) => $.missing());
