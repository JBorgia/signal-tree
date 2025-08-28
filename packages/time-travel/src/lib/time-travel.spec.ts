import { signalTree, unwrap, type SignalTree } from '@signaltree/core';
import {
  withTimeTravel,
  enableTimeTravel,
  getTimeTravel,
  type TimeTravelEntry,
  type TimeTravelInterface,
} from './time-travel';

interface TestState {
  count: number;
  user: {
    name: string;
    id: number;
  };
  items: string[];
}

type TimeTravelTree = SignalTree<TestState> & {
  __timeTravel: TimeTravelInterface<TestState>;
};

// Helper function to create properly typed time travel tree
function createTimeTravelTree(
  initialState: TestState,
  config?: {
    maxHistorySize?: number;
    includePayload?: boolean;
    actionNames?: { update?: string; set?: string };
  }
): TimeTravelTree {
  if (config) {
    return signalTree(initialState).with(
      withTimeTravel(config)
    ) as TimeTravelTree;
  }
  return signalTree(initialState).with(withTimeTravel()) as TimeTravelTree;
}

// Helper function for enable time travel
function createEnabledTimeTravelTree(
  initialState: TestState,
  limit?: number
): TimeTravelTree {
  if (limit !== undefined) {
    return signalTree(initialState).with(
      enableTimeTravel(limit)
    ) as TimeTravelTree;
  }
  return signalTree(initialState).with(enableTimeTravel()) as TimeTravelTree;
}

describe('Time Travel', () => {
  let initialState: TestState;

  beforeEach(() => {
    initialState = {
      count: 0,
      user: {
        name: 'Alice',
        id: 1,
      },
      items: ['a', 'b'],
    };
  });

  afterEach(() => {
    // Clean up any trees created during tests
    jest.clearAllTimers();
  });

  describe('withTimeTravel', () => {
    it('should enhance tree with time travel interface', () => {
      const tree = createTimeTravelTree(initialState);

      expect(tree.__timeTravel).toBeDefined();
      expect(typeof tree.__timeTravel.undo).toBe('function');
      expect(typeof tree.__timeTravel.redo).toBe('function');
      expect(typeof tree.__timeTravel.getHistory).toBe('function');
      expect(typeof tree.__timeTravel.resetHistory).toBe('function');
      expect(typeof tree.__timeTravel.dispose).toBe('function');

      tree.__timeTravel.dispose();
    });

    it('should track state changes in history', () => {
      const tree = createTimeTravelTree(initialState);

      // Use signal.set() for leaf nodes
      tree.$.count.set(1);
      tree.$.count.set(2);

      const history = tree.__timeTravel.getHistory();
      expect(history.length).toBe(3); // INIT + 2 updates
      expect(history[0].action).toBe('INIT');
      expect(history[1].action).toBe('SET');
      expect(history[2].action).toBe('SET');

      tree.__timeTravel.dispose();
    });

    it('should track nested state changes', () => {
      const tree = createTimeTravelTree(initialState);

      // Update nested values
      tree.$.user.name.set('Bob');
      tree.$.user.id.set(2);

      const history = tree.__timeTravel.getHistory();
      expect(history.length).toBe(3); // INIT + 2 updates
      expect(history[1].state.user.name).toBe('Bob');
      expect(history[2].state.user.id).toBe(2);

      tree.__timeTravel.dispose();
    });

    it('should track branch-level updates', () => {
      const tree = createTimeTravelTree(initialState);

      // Use branch.set() method with proper type assertion
      (tree.$.user as any).set({ name: 'Bob', id: 2 });

      const history = tree.__timeTravel.getHistory();
      expect(history.length).toBe(2); // INIT + 1 update
      expect(history[1].action).toBe('SET');
      expect(history[1].state.user).toEqual({ name: 'Bob', id: 2 });

      tree.__timeTravel.dispose();
    });

    it('should support undo operations', () => {
      const tree = createTimeTravelTree(initialState);

      tree.$.count.set(1);
      tree.$.count.set(2);
      tree.$.count.set(3);

      expect(unwrap(tree.$).count).toBe(3);

      const undoResult = tree.__timeTravel.undo();
      expect(undoResult).toBe(true);
      expect(unwrap(tree.$).count).toBe(2);

      tree.__timeTravel.undo();
      expect(unwrap(tree.$).count).toBe(1);

      tree.__timeTravel.undo();
      expect(unwrap(tree.$).count).toBe(0);

      tree.__timeTravel.dispose();
    });

    it('should support redo operations', () => {
      const tree = createTimeTravelTree(initialState);

      tree.$.count.set(1);
      tree.$.count.set(2);

      tree.__timeTravel.undo();
      expect(unwrap(tree.$).count).toBe(1);

      const redoResult = tree.__timeTravel.redo();
      expect(redoResult).toBe(true);
      expect(unwrap(tree.$).count).toBe(2);

      tree.__timeTravel.dispose();
    });

    it('should handle undo/redo boundaries correctly', () => {
      const tree = createTimeTravelTree(initialState);

      // Can't undo from initial state
      expect(tree.__timeTravel.canUndo()).toBe(false);
      expect(tree.__timeTravel.undo()).toBe(false);

      tree.$.count.set(1);
      expect(tree.__timeTravel.canUndo()).toBe(true);

      // Can't redo when at latest state
      expect(tree.__timeTravel.canRedo()).toBe(false);
      expect(tree.__timeTravel.redo()).toBe(false);

      tree.__timeTravel.undo();
      expect(tree.__timeTravel.canRedo()).toBe(true);

      tree.__timeTravel.dispose();
    });

    it('should support jumping to specific history index', () => {
      const tree = createTimeTravelTree(initialState);

      tree.$.count.set(1);
      tree.$.count.set(2);
      tree.$.count.set(3);

      expect(tree.__timeTravel.getCurrentIndex()).toBe(3);

      const jumpResult = tree.__timeTravel.jumpTo(1);
      expect(jumpResult).toBe(true);
      expect(unwrap(tree.$).count).toBe(1);
      expect(tree.__timeTravel.getCurrentIndex()).toBe(1);

      // Invalid index
      expect(tree.__timeTravel.jumpTo(-1)).toBe(false);
      expect(tree.__timeTravel.jumpTo(10)).toBe(false);

      tree.__timeTravel.dispose();
    });

    it('should reset history', () => {
      const tree = createTimeTravelTree(initialState);

      tree.$.count.set(1);
      tree.$.count.set(2);

      expect(tree.__timeTravel.getHistory().length).toBe(3);

      tree.__timeTravel.resetHistory();
      const history = tree.__timeTravel.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].action).toBe('RESET');
      expect(tree.__timeTravel.getCurrentIndex()).toBe(0);

      tree.__timeTravel.dispose();
    });

    it('should respect max history size', () => {
      const tree = createTimeTravelTree(initialState, { maxHistorySize: 3 });

      // Add more entries than max size
      tree.$.count.set(1);
      tree.$.count.set(2);
      tree.$.count.set(3);
      tree.$.count.set(4);

      const history = tree.__timeTravel.getHistory();
      expect(history.length).toBe(3); // Max size enforced
      expect(history[history.length - 1].state.count).toBe(4); // Latest state preserved

      tree.__timeTravel.dispose();
    });

    it('should handle branching history correctly', () => {
      const tree = createTimeTravelTree(initialState);

      tree.$.count.set(1);
      tree.$.count.set(2);
      tree.$.count.set(3);

      // Go back and create new branch
      tree.__timeTravel.undo();
      tree.__timeTravel.undo();
      expect(unwrap(tree.$).count).toBe(1);

      tree.$.count.set(10);

      const history = tree.__timeTravel.getHistory();
      // Should have INIT, first update, and new branch update
      expect(history.length).toBe(3);
      expect(history[2].state.count).toBe(10);

      // Can't redo the discarded future
      expect(tree.__timeTravel.canRedo()).toBe(false);

      tree.__timeTravel.dispose();
    });

    it('should deep clone state snapshots', () => {
      const tree = createTimeTravelTree(initialState);

      (tree.$.user as any).set({ name: 'Bob', id: 2 });

      const history = tree.__timeTravel.getHistory();
      const firstEntry = history[0];

      // Modify returned state should not affect history
      firstEntry.state.user.name = 'Modified';

      const freshHistory = tree.__timeTravel.getHistory();
      expect(freshHistory[0].state.user.name).toBe('Alice'); // Original preserved

      tree.__timeTravel.dispose();
    });

    it('should not track identical state changes', () => {
      const tree = createTimeTravelTree(initialState);

      const currentCount = unwrap(tree.$).count;
      tree.$.count.set(currentCount); // Same value

      const history = tree.__timeTravel.getHistory();
      expect(history.length).toBe(1); // Only INIT, no update recorded

      tree.__timeTravel.dispose();
    });

    it('should include payload when configured', () => {
      const tree = createTimeTravelTree(initialState, { includePayload: true });

      tree.$.count.set(1);

      const history = tree.__timeTravel.getHistory();
      const updateEntry = history.find(
        (h: TimeTravelEntry<TestState>) => h.action === 'SET'
      );
      expect(updateEntry).toBeDefined();
      expect(updateEntry?.payload).toBeDefined();

      tree.__timeTravel.dispose();
    });

    it('should handle custom action names', () => {
      const tree = createTimeTravelTree(initialState, {
        actionNames: {
          set: 'CUSTOM_SET',
        },
      });

      tree.$.count.set(1);

      const history = tree.__timeTravel.getHistory();
      const updateEntry = history.find(
        (h: TimeTravelEntry<TestState>) => h.action === 'CUSTOM_SET'
      );
      expect(updateEntry).toBeDefined();

      tree.__timeTravel.dispose();
    });

    it('should properly dispose resources', () => {
      const tree = createTimeTravelTree(initialState);

      tree.$.count.set(1);
      tree.$.count.set(2);

      expect(tree.__timeTravel.canUndo()).toBe(true);

      tree.__timeTravel.dispose();

      // After disposal, operations should fail gracefully
      expect(tree.__timeTravel.undo()).toBe(false);
      expect(tree.__timeTravel.redo()).toBe(false);
      expect(tree.__timeTravel.canUndo()).toBe(false);
      expect(tree.__timeTravel.canRedo()).toBe(false);
    });
  });

  describe('enableTimeTravel convenience function', () => {
    it('should create time travel with default config', () => {
      const tree = createEnabledTimeTravelTree(initialState);

      expect(tree.__timeTravel).toBeDefined();
      tree.$.count.set(1);
      expect(tree.__timeTravel.getHistory().length).toBe(2);

      tree.__timeTravel.dispose();
    });

    it('should accept max history size parameter', () => {
      const tree = createEnabledTimeTravelTree(initialState, 2);

      tree.$.count.set(1);
      tree.$.count.set(2);
      tree.$.count.set(3);

      expect(tree.__timeTravel.getHistory().length).toBe(2);

      tree.__timeTravel.dispose();
    });
  });

  describe('getTimeTravel helper', () => {
    it('should return time travel interface from enhanced tree', () => {
      const tree = createTimeTravelTree(initialState);
      const timeTravel = getTimeTravel(tree);

      expect(timeTravel).toBeDefined();
      expect(timeTravel).toBe(tree.__timeTravel);

      tree.__timeTravel.dispose();
    });

    it('should return undefined for non-enhanced tree', () => {
      const tree = signalTree(initialState);
      const timeTravel = getTimeTravel(
        tree as SignalTree<TestState> & {
          __timeTravel?: TimeTravelInterface<TestState>;
        }
      );

      expect(timeTravel).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle complex nested state changes', () => {
      const tree = createTimeTravelTree(initialState);

      (tree.$.user as any).set({ name: 'Bob', id: 2 });
      tree.$.items.set(['a', 'b', 'c']);

      tree.__timeTravel.undo();
      expect(unwrap(tree.$).user.name).toBe('Alice');
      expect(unwrap(tree.$).items).toEqual(['a', 'b']);

      tree.__timeTravel.redo();
      expect(unwrap(tree.$).user.name).toBe('Bob');
      expect(unwrap(tree.$).items).toEqual(['a', 'b', 'c']);

      tree.__timeTravel.dispose();
    });

    it('should handle multiple rapid updates', () => {
      const tree = createTimeTravelTree(initialState);

      for (let i = 1; i <= 10; i++) {
        tree.$.count.set(i);
      }

      expect(unwrap(tree.$).count).toBe(10);
      expect(tree.__timeTravel.getHistory().length).toBe(11); // INIT + 10 updates

      // Undo 5 times
      for (let i = 0; i < 5; i++) {
        tree.__timeTravel.undo();
      }

      expect(unwrap(tree.$).count).toBe(5);

      tree.__timeTravel.dispose();
    });

    it('should handle array mutations correctly', () => {
      const tree = createTimeTravelTree(initialState);

      // Arrays are signals in v2, so we set the whole array
      tree.$.items.set(['x', 'y', 'z']);

      expect(unwrap(tree.$).items).toEqual(['x', 'y', 'z']);

      tree.__timeTravel.undo();
      expect(unwrap(tree.$).items).toEqual(['a', 'b']);

      tree.__timeTravel.redo();
      expect(unwrap(tree.$).items).toEqual(['x', 'y', 'z']);

      tree.__timeTravel.dispose();
    });

    it('should not record changes during restore', () => {
      const tree = createTimeTravelTree(initialState);

      tree.$.count.set(1);
      tree.$.count.set(2);
      tree.$.count.set(3);

      const historyBefore = tree.__timeTravel.getHistory().length;

      // Undo should not create new history entries
      tree.__timeTravel.undo();
      tree.__timeTravel.undo();
      tree.__timeTravel.redo();

      const historyAfter = tree.__timeTravel.getHistory().length;
      expect(historyAfter).toBe(historyBefore);

      tree.__timeTravel.dispose();
    });

    it('should handle mixed branch and leaf updates', () => {
      const tree = createTimeTravelTree(initialState);

      // Mix of branch-level and leaf-level updates
      tree.$.user.name.set('Bob');
      (tree.$.user as any).set({ name: 'Charlie', id: 3 });
      tree.$.count.set(5);

      const history = tree.__timeTravel.getHistory();
      expect(history.length).toBe(4); // INIT + 3 updates

      // Undo all
      tree.__timeTravel.jumpTo(0);
      expect(unwrap(tree.$)).toEqual(initialState);

      // Redo to end
      tree.__timeTravel.jumpTo(3);
      expect(unwrap(tree.$).user).toEqual({ name: 'Charlie', id: 3 });
      expect(unwrap(tree.$).count).toBe(5);

      tree.__timeTravel.dispose();
    });
  });
});
