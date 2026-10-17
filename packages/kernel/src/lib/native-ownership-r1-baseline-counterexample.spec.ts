import { describe, expect, it } from 'vitest';
import { signalTree, restoration } from '../index';
import { nativeOwnershipExperiment } from './internals/native-ownership-driver-experiment';
import {
  materializeMember,
  ordinaryBranch,
  registerMarkerProcessor,
} from './internals/materialize-markers';
const marker = Symbol('native-b-r1-dynamic');
registerMarkerProcessor(
  (value: unknown): value is { [marker]: true } =>
    typeof value === 'object' && value !== null && marker in value,
  () => ordinaryBranch({ seed: 0 }, { keyedLookup: true })
);
const make = () => {
  const tree = signalTree(
    { x: 0, y: 0, members: { [marker]: true as const } },
    { enhancers: [restoration()] }
  );
  const members = tree.$.members as unknown as (
    value?: Record<string, unknown>
  ) => Record<string, unknown>;
  void members();
  const b = nativeOwnershipExperiment(tree.$);
  return {
    tree,
    members,
    b,
    dispose() {
      b.destroy();
      tree.destroy();
    },
  };
};

describe('preserved unresolved primitive dynamic replacement counterexample', () => {
  it('replacement, deletion, and reacquisition preserve retained identity', () => {
    const { members, b, dispose } = make();
    try {
      const leaf = materializeMember(members, 'new', 1) as (
        value?: number
      ) => number;
      const replace = b.begin(() => materializeMember(members, 'new', 2));
      replace.rollback();
      expect(leaf()).toBe(1);
      const remove = b.begin(() => members({ seed: 0 }));
      expect(leaf()).toBeUndefined();
      remove.rollback();
      expect(leaf()).toBe(1);
      members({ seed: 0 });
      const reacquire = b.begin(() => materializeMember(members, 'new', 1));
      reacquire.rollback();
      expect(leaf()).toBeUndefined();
      expect(materializeMember(members, 'new', 3)).toBe(leaf);
      expect(leaf()).toBe(3);
    } finally {
      dispose();
    }
  });
  it('baseline dynamic primitive replacement control', () => {
    const { members, b, dispose } = make();
    b.destroy();
    try {
      const leaf = materializeMember(members, 'scalar', 1) as (
        v?: number
      ) => number;
      expect(leaf()).toBe(1);
      materializeMember(members, 'scalar', 3);
      expect(leaf()).toBe(3);
    } finally {
      dispose();
    }
  });
});
