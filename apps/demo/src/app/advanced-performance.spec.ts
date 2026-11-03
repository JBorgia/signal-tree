import { signalTree } from '@signal-tree/kernel';

/**
 * Advanced SignalTree Performance Benchmarks
 * Comprehensive performance testing with detailed metrics
 */

interface DeepDataNode {
  value?: number;
  id?: string;
  [key: string]: unknown;
}

interface WideStateNode {
  [key: string]: unknown;
}

interface ComputedTestState {
  numbers: number[];
  sum: number;
  average: number;
  max: number;
  min: number;
  filtered: number[];
}

interface NestedArrayState {
  matrix: number[][];
  stats: {
    operations: number;
    lastUpdate: number;
  };
}

interface TreeNode {
  id: string;
  name: string;
  value: number;
  children: TreeNode[];
}

interface SearchState {
  root: TreeNode;
  searchResults: TreeNode[];
}

interface ChangeDetectionState {
  counters: Record<string, number>;
  filter: string;
}

let seed = 1;
function random(): number {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}
function generateCryptoId(): string { return `fixture-${seed++}`; }

describe('Advanced SignalTree Performance Benchmarks', () => {
  beforeEach(() => { seed = 1; });
  const owned: Array<{ destroy(): void }> = [];
  function createTree<T extends object>(state: T) {
    const tree = signalTree(state);
    owned.push(tree);
    return tree;
  }
  afterEach(() => { for (const tree of owned.splice(0)) tree.destroy(); });

  // Utility function to measure execution time
  function measureTime(fn: () => void, iterations = 1): number {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    return (end - start) / iterations;
  }

  function measureInitialization<T extends { destroy(): void }>(
    create: () => T, check: (tree: T) => void, iterations = 10
  ): number {
    let elapsed = 0;
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const sample = create();
      elapsed += performance.now() - start;
      try { check(sample); } finally { sample.destroy(); }
    }
    return elapsed / iterations;
  }

  it('should benchmark scalability with deep nesting', () => {
    // Test extremely deep nesting (10+ levels)
    const createDeepData = (depth: number): DeepDataNode => {
      if (depth === 0) return { value: 0.5, id: `depth-${depth}` };
      return { [`level_${depth}`]: createDeepData(depth - 1) };
    };

    const depths = [5, 10, 15, 20];
    depths.forEach((depth) => {
      const deepData = createDeepData(depth);
      const tree = createTree(deepData);

      const initTime = measureInitialization(
        () => signalTree(deepData), sample => expect(sample.$()).toEqual(deepData)
      );

      expect(initTime).toBeLessThan(20);
      expect(tree).toBeDefined();
    });
  });

  it('should benchmark wide state trees', () => {
    // Test wide state trees (many properties at same level)
    const widths = [100, 500, 1000, 2000];

    widths.forEach((width) => {
      const wideState: WideStateNode = {};
      for (let i = 0; i < width; i++) {
        wideState[`prop_${i}`] = i;
      }

      const tree = createTree(wideState);

      const initTime = measureInitialization(
        () => signalTree(wideState), sample => expect(sample.$()).toEqual(wideState)
      );

      expect(initTime).toBeLessThan(50);
      expect(tree).toBeDefined();
    });
  });

  it('should benchmark reactive computation performance', () => {
    // Test complex computations with cascading updates
    const computedData: ComputedTestState = {
      numbers: Array.from({ length: 1000 }, () =>
        Math.floor(random() * 1000)
      ),
      sum: 0,
      average: 0,
      max: 0,
      min: 0,
      filtered: [] as number[],
    };

    const tree = createTree(computedData);

    // Test cascading updates performance
    const cascadingUpdateTime = measureTime(() => {
      const newNumbers = Array.from({ length: 1000 }, () =>
        Math.floor(random() * 1000)
      );
      tree.$(() => ({
        numbers: newNumbers,
        sum: newNumbers.reduce((a, b) => a + b, 0),
        average: newNumbers.reduce((a, b) => a + b, 0) / newNumbers.length,
        max: Math.max(...newNumbers),
        min: Math.min(...newNumbers),
        filtered: newNumbers.filter((n) => n > 500),
      }));
    }, 100);

    // Test partial state updates
    const partialUpdateTime = measureTime(() => {
      // Use the updater form and preserve other properties.
      tree.$((current) => ({ ...current, sum: random() * 10000 }));
    }, 1000);

    expect(cascadingUpdateTime).toBeLessThan(10);
    expect(partialUpdateTime).toBeLessThan(1);
  });

  it('should benchmark array handling and nested structures', () => {
    const nestedArrayData: NestedArrayState = {
      matrix: Array.from({ length: 100 }, () =>
        Array.from({ length: 100 }, () => random())
      ),
      stats: {
        operations: 0,
        lastUpdate: Date.now(),
      },
    };

    const tree = createTree(nestedArrayData);

    // Test array updates
    const arrayUpdateTime = measureTime(() => {
      tree.$((currentState) => ({
        ...currentState,
        matrix: currentState.matrix.map((row) => row.map((cell) => cell * 1.1)),
        stats: {
          operations: currentState.stats.operations + 1,
          lastUpdate: Date.now(),
        },
      }));
    }, 50);

    expect(arrayUpdateTime).toBeLessThan(10);
  });

  it('should benchmark tree search and traversal', () => {
    // Create a complex tree structure
    const createTreeNode = (id: string, depth: number): TreeNode => ({
      id,
      name: `Node ${id}`,
      value: random() * 1000,
      children:
        depth > 0
          ? Array.from({ length: 3 }, (_, i) =>
              createTreeNode(`${id}-${i}`, depth - 1)
            )
          : [],
    });

    const searchData: SearchState = {
      root: createTreeNode('root', 4),
      searchResults: [],
    };

    const tree = createTree(searchData);

    // Test search performance
    const searchTime = measureTime(() => {
      const findInTree = (
        node: TreeNode,
        predicate: (n: TreeNode) => boolean
      ): TreeNode[] => {
        const results: TreeNode[] = [];
        if (predicate(node)) results.push(node);
        for (const child of node.children) {
          results.push(...findInTree(child, predicate));
        }
        return results;
      };

      tree.$((state) => ({
        ...state,
        searchResults: findInTree(state.root, (node) => node.value > 500),
      }));
    }, 100);

    expect(searchTime).toBeLessThan(5);
  });

  it('should update ten populated trees within the workload budget', () => {
    // Create multiple large trees
    const trees = Array.from({ length: 10 }, () => {
      const data = {
        id: generateCryptoId(),
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: `item-${i}`,
          name: `Item ${i}`,
          value: random(),
          metadata: {
            created: Date.now(),
            tags: [`tag-${i % 10}`, `category-${Math.floor(i / 100)}`],
          },
        })),
      };
      return createTree(data);
    });


    // Perform updates on all trees
    const updateTime = measureTime(() => {
      trees.forEach((tree) => {
        tree.$((state) => ({
          ...state,
          data: state.data.map((item) => ({ ...item, value: random() })),
        }));
      });
    }, 1);


    expect(updateTime).toBeLessThan(100);
    for (const tree of trees) expect(tree.$.data()).toHaveLength(1000);
  });

  it('should benchmark repeated whole-root replacement with 100 counters', () => {
    const changeDetectionData: ChangeDetectionState = {
      counters: Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`counter_${i}`, 0])
      ),
      filter: '',
    };

    const tree = createTree(changeDetectionData);

    // Kernel replacement work, including traversal of unchanged counters; no Angular rendering.
    const rapidUpdates = measureTime(() => {
      for (let i = 0; i < 100; i++) {
        // Use the updater form to avoid losing other required fields.
        tree.$((current) => ({ ...current, filter: `Item ${i}` }));
      }
    }, 100);

    expect(tree.$.filter()).toBe('Item 99');
    expect(Object.keys(tree.$.counters())).toHaveLength(100);
    expect(rapidUpdates).toBeLessThan(50);
  });


});
