import type { EnhancerLifecycle } from '../../src/lib/enhancer-lifecycle';

export interface MiddlewareConfig {
  beforeUpdate?: (state: any, updates: any) => any;
  afterUpdate?: (state: any) => void;
}

export const middlewareEnhancer: EnhancerLifecycle = {
  name: 'middleware',

  enhance(tree: any, config: MiddlewareConfig = {}) {
    const originalUpdate =
      (tree as any).update || ((updater: any) => tree(updater));

    (tree as any).update = function (updater: any) {
      let updates = updater((tree as any)());

      if (config.beforeUpdate) {
        updates = config.beforeUpdate((tree as any)(), updates);
      }

      const result = originalUpdate.call(tree, () => updates);

      if (config.afterUpdate) {
        config.afterUpdate((tree as any)());
      }

      return result;
    };

    return tree;
  },
};
