import { describe, expect, it } from 'vitest';
import { createSignalTreeFactory } from '../../signal-tree';
import {
  createReactiveTestRealization,
  observeReactiveTestValue,
} from '../../../reactive-test-realization';
import {
  applyInInvalidationGroup,
  wasAppliedBeforeFailure,
  applicationFailureCause,
} from './post-application-failure';

describe('post-application failure provenance', () => {
  it('does not attribute a later failed application to an earlier delivery using the same error', () => {
    const tree = createSignalTreeFactory(createReactiveTestRealization())({
      x: 0,
    });
    const reused = new Error('same consumer failure');
    let armed = false;
    const observer = observeReactiveTestValue(
      () => tree.$.x(),
      () => {
        if (armed) throw reused;
      }
    );
    try {
      armed = true;
      let delivery: unknown;
      try {
        applyInInvalidationGroup(tree.$, () => tree.$.x(1));
      } catch (error) {
        delivery = error;
      }
      armed = false;
      expect(tree.$.x()).toBe(1);
      expect(wasAppliedBeforeFailure(delivery)).toBe(true);
      let refused: unknown;
      try {
        applyInInvalidationGroup(tree.$, () => {
          throw reused;
        });
      } catch (error) {
        refused = error;
      }
      expect(refused).toBe(reused);
      expect(wasAppliedBeforeFailure(refused)).toBe(false);
      expect(observer()).toBe(1);
    } finally {
      armed = false;
      tree.destroy();
    }
  });
  it('marks outer completion when nested same-tree groups defer delivery', () => {
    const tree = createSignalTreeFactory(createReactiveTestRealization())({
      x: 0,
      y: 0,
    });
    const failure = new Error('nested delivery');
    let armed = false;
    const observer = observeReactiveTestValue(
      () => tree.$.x() + tree.$.y(),
      () => {
        if (armed) throw failure;
      }
    );
    try {
      armed = true;
      let outcome: unknown;
      try {
        applyInInvalidationGroup(tree.$, () => {
          applyInInvalidationGroup(tree.$, () => tree.$.x(1));
          tree.$.y(2);
        });
      } catch (error) {
        outcome = error;
      }
      armed = false;
      expect(wasAppliedBeforeFailure(outcome)).toBe(true);
      expect(applicationFailureCause(outcome)).toBe(failure);
      expect([tree.$.x(), tree.$.y(), observer()]).toEqual([1, 2, 3]);
    } finally {
      armed = false;
      tree.destroy();
    }
  });

  it('a caught inner receipt cannot classify a later outer pre-application failure', () => {
    const build = createSignalTreeFactory(createReactiveTestRealization());
    const outer = build({ x: 0 });
    const inner = build({ x: 0 });
    const failure = new Error('inner then outer');
    let armed = false;
    const observer = observeReactiveTestValue(
      () => inner.$.x(),
      () => {
        if (armed) throw failure;
      }
    );
    try {
      armed = true;
      let innerApplied = false;
      let outcome: unknown;
      try {
        applyInInvalidationGroup(outer.$, () => {
          try {
            applyInInvalidationGroup(inner.$, () => inner.$.x(1));
          } catch (error) {
            innerApplied = wasAppliedBeforeFailure(error);
          }
          throw failure;
        });
      } catch (error) {
        outcome = error;
      }
      armed = false;
      expect(innerApplied).toBe(true);
      expect(outcome).toBe(failure);
      expect(wasAppliedBeforeFailure(outcome)).toBe(false);
      expect([outer.$.x(), inner.$.x(), observer()]).toEqual([0, 1, 1]);
    } finally {
      armed = false;
      outer.destroy();
      inner.destroy();
    }
  });
});
