import type { EnhancerLifecycle } from '../../src/lib/enhancer-lifecycle';

export const timeTravelEnhancer: EnhancerLifecycle = {
  name: 'timeTravel',

  enhance(tree: any) {
    const history: any[] = [];
    let currentIndex = -1;

    // Store initial state
    history.push((tree as any)());
    currentIndex = 0;

    // Intercept updates
    const originalUpdate =
      (tree as any).update || ((updater: any) => tree(updater));
    (tree as any).update = function (updater: any) {
      const result = originalUpdate.call(tree, updater);

      // Add to history
      history.push((tree as any)());
      currentIndex++;

      // Limit history size
      if (history.length > 100) {
        history.shift();
        currentIndex--;
      }

      return result;
    };

    // Add time travel methods
    (tree as any).undo = () => {
      if (currentIndex > 0) {
        currentIndex--;
        (tree as any).set(history[currentIndex]);
      }
    };

    (tree as any).redo = () => {
      if (currentIndex < history.length - 1) {
        currentIndex++;
        (tree as any).set(history[currentIndex]);
      }
    };

    (tree as any).getHistory = () => history.slice();

    return tree;
  },
};
