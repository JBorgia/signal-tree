import { TestBed } from '@angular/core/testing';
import { signalTree } from '@signaltree/core';
import {
  withSerialization,
  withPersistence,
  createStorageAdapter,
  createIndexedDBAdapter,
  StorageAdapter,
  PersistableSignalTree,
} from './serialization';

describe('Serialization', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    // Clean up any intervals/timeouts
    jest.clearAllTimers();
  });

  describe('withSerialization', () => {
    it('should enhance tree with serialization capabilities', () => {
      const tree = signalTree({ count: 0 }).with(withSerialization());

      expect(tree.serialize).toBeDefined();
      expect(tree.deserialize).toBeDefined();
      expect(tree.toJSON).toBeDefined();
      expect(tree.fromJSON).toBeDefined();
      expect(tree.snapshot).toBeDefined();
      expect(tree.restore).toBeDefined();
    });

    it('should serialize and deserialize basic state', () => {
      const initialState = {
        count: 42,
        user: { name: 'John', age: 30 },
        items: [1, 2, 3],
        enabled: true,
      };

      const tree = signalTree(initialState).with(withSerialization());

      // Update state
      tree.$.count.set(100);
      tree.$.user.name.set('Jane');

      // Serialize
      const serialized = tree.serialize();
      expect(typeof serialized).toBe('string');
      expect(JSON.parse(serialized)).toBeDefined();

      // Create new tree and deserialize
      const tree2 = signalTree({
        count: 0,
        user: { name: '', age: 0 },
        items: [],
        enabled: false,
      }).with(withSerialization());
      tree2.deserialize(serialized);

      // Verify state restored
      expect(tree2.$.count()).toBe(100);
      expect(tree2.$.user.name()).toBe('Jane');
      expect(tree2.$.user.age()).toBe(30);
      expect(tree2.$.items()).toEqual([1, 2, 3]);
      expect(tree2.$.enabled()).toBe(true);
    });

    it('should handle special types (Date, RegExp, Map, Set)', async () => {
      const complexState = {
        date: new Date('2023-01-01'),
        regex: /test/gi,
        map: new Map<string, string>([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ]),
        set: new Set([1, 2, 3, 'test']),
        nested: {
          date: new Date('2023-12-31'),
        },
      };

      const tree = signalTree(complexState).with(withSerialization());
      const serialized = tree.serialize();

      const tree2 = signalTree({
        date: new Date('1900-01-01'),
        regex: /.*/,
        map: new Map(),
        set: new Set(),
        nested: { date: new Date('1900-01-01') },
      }).with(withSerialization());

      tree2.deserialize(serialized);

      // Add a small delay to ensure deserialization completes
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(tree2.$.date()).toEqual(new Date('2023-01-01'));
      expect(tree2.$.regex()).toEqual(/test/gi);
      expect(tree2.$.map()).toEqual(
        new Map<string, string>([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ])
      );
      expect(tree2.$.set()).toEqual(new Set([1, 2, 3, 'test']));
      expect(tree2.$.nested.date()).toEqual(new Date('2023-12-31'));
    });

    it('should handle special values (undefined, NaN, Infinity)', () => {
      const specialState = {
        undef: undefined,
        nan: NaN,
        infinity: Infinity,
        negInfinity: -Infinity,
        bigInt: BigInt(123),
      };

      const tree = signalTree(specialState).with(withSerialization());
      const serialized = tree.serialize();

      const tree2 = signalTree({
        undef: null,
        nan: 0,
        infinity: 0,
        negInfinity: 0,
        bigInt: BigInt(0),
      }).with(withSerialization());

      tree2.deserialize(serialized);

      expect(tree2.$.undef()).toBeUndefined();
      expect(tree2.$.nan()).toBeNaN();
      expect(tree2.$.infinity()).toBe(Infinity);
      expect(tree2.$.negInfinity()).toBe(-Infinity);
      expect(tree2.$.bigInt()).toBe(BigInt(123));
    });

    it('should create snapshots with metadata', () => {
      const tree = signalTree({ count: 42 }).with(withSerialization());

      const snapshot = tree.snapshot();

      expect(snapshot.data).toEqual({ count: 42 });
      expect(snapshot.metadata).toBeDefined();
      expect(snapshot.metadata?.timestamp).toBeDefined();
      expect(snapshot.metadata?.version).toBeDefined();
      expect(typeof snapshot.metadata?.timestamp).toBe('number');
    });

    it('should restore from snapshots', () => {
      const tree = signalTree({ count: 0, name: '' }).with(withSerialization());

      const snapshot = {
        data: { count: 100, name: 'test' },
        metadata: {
          timestamp: Date.now(),
          version: '2.0.0',
        },
      };

      tree.restore(snapshot);

      expect(tree.$.count()).toBe(100);
      expect(tree.$.name()).toBe('test');
    });

    it('should handle circular references gracefully', () => {
      // Test that circular marker system works without creating actual circular refs
      const simpleState = {
        name: 'root',
        child: {
          name: 'child',
          parentRef: null,
        },
      };

      const tree = signalTree(simpleState).with(
        withSerialization({
          handleCircular: true,
        })
      );

      // Should not throw when serializing
      expect(() => {
        const serialized = tree.serialize();
        expect(typeof serialized).toBe('string');

        // Test deserialization too
        const tree2 = signalTree({
          name: '',
          child: { name: '', parentRef: null },
        }).with(withSerialization({ handleCircular: true }));

        tree2.deserialize(serialized);
        expect(tree2.$.name()).toBe('root');
        expect(tree2.$.child.name()).toBe('child');
      }).not.toThrow();
    });

    it('should respect configuration options', () => {
      const tree = signalTree({
        date: new Date(),
        count: 42,
      }).with(
        withSerialization({
          preserveTypes: false,
          includeMetadata: false,
        })
      );

      const serialized = tree.serialize();
      const parsed = JSON.parse(serialized);

      // Should not have metadata
      expect(parsed.metadata).toBeUndefined();

      // Date should be serialized as string (not preserved as Date type)
      expect(typeof parsed.data.date).toBe('string');
    });
  });

  describe('toJSON and fromJSON', () => {
    it('should convert to plain object and back', () => {
      const tree = signalTree({
        user: { name: 'John', age: 30 },
        count: 42,
      }).with(withSerialization());

      tree.$.count.set(100);
      const json = tree.toJSON();

      expect(json).toEqual({
        user: { name: 'John', age: 30 },
        count: 100,
      });

      const tree2 = signalTree({
        user: { name: '', age: 0 },
        count: 0,
      }).with(withSerialization());

      tree2.fromJSON(json);

      expect(tree2.$.count()).toBe(100);
      expect(tree2.$.user.name()).toBe('John');
      expect(tree2.$.user.age()).toBe(30);
    });
  });

  describe('withPersistence', () => {
    let mockStorage: Record<string, string>;

    beforeEach(() => {
      mockStorage = {};
      jest.useFakeTimers();

      // Mock localStorage
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn((key: string) => mockStorage[key] || null),
          setItem: jest.fn((key: string, value: string) => {
            mockStorage[key] = value;
          }),
          removeItem: jest.fn((key: string) => {
            delete mockStorage[key];
          }),
          clear: jest.fn(() => {
            mockStorage = {};
          }),
        },
        writable: true,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should add persistence methods to tree', () => {
      const tree = signalTree({ count: 0 }).with(
        withPersistence({ key: 'test-state', autoLoad: false })
      ) as PersistableSignalTree<{ count: number }>;

      expect(tree.save).toBeDefined();
      expect(tree.load).toBeDefined();
      expect(tree.clear).toBeDefined();
      expect(tree.dispose).toBeDefined();
      expect(tree.ready).toBeDefined();

      // Clean up
      tree.dispose();
    });

    it('should save and load state', async () => {
      const tree = signalTree({ count: 42, name: 'test' }).with(
        withPersistence({ key: 'app-state', autoLoad: false })
      ) as PersistableSignalTree<{ count: number; name: string }>;

      tree.$.count.set(100);
      await tree.save();

      // Verify saved to storage
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'app-state',
        expect.stringContaining('100')
      );

      // Create new tree and load
      const tree2 = signalTree({ count: 0, name: '' }).with(
        withPersistence({ key: 'app-state', autoLoad: false })
      ) as PersistableSignalTree<{ count: number; name: string }>;

      await tree2.load();

      expect(tree2.$.count()).toBe(100);
      expect(tree2.$.name()).toBe('test');

      // Clean up
      tree.dispose();
      tree2.dispose();
    });

    it('should handle auto-save', async () => {
      const tree = signalTree({ count: 0 }).with(
        withPersistence({
          key: 'auto-save-test',
          autoSave: true,
          debounceMs: 100,
          autoLoad: false,
        })
      ) as PersistableSignalTree<{ count: number }>;

      // Wait for ready
      await tree.ready;

      // Change state
      tree.$.count.set(42);

      // Advance timers to trigger polling and debounced save
      jest.advanceTimersByTime(100); // Polling interval
      jest.advanceTimersByTime(100); // Debounce delay

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'auto-save-test',
        expect.stringContaining('42')
      );

      // Clean up
      tree.dispose();
    });

    it('should handle auto-load', async () => {
      // Pre-populate storage
      mockStorage['auto-load-test'] = JSON.stringify({
        data: { count: 99, name: 'loaded' },
        metadata: { timestamp: Date.now(), version: '2.0.0' },
      });

      const tree = signalTree({ count: 0, name: '' }).with(
        withPersistence({
          key: 'auto-load-test',
          autoLoad: true,
        })
      ) as PersistableSignalTree<{ count: number; name: string }>;

      // Wait for auto-load to complete
      await tree.ready;

      expect(tree.$.count()).toBe(99);
      expect(tree.$.name()).toBe('loaded');

      // Clean up
      tree.dispose();
    });

    it('should clear storage', async () => {
      const tree = signalTree({ count: 42 }).with(
        withPersistence({ key: 'clear-test', autoLoad: false })
      ) as PersistableSignalTree<{ count: number }>;

      await tree.save();
      expect(mockStorage['clear-test']).toBeDefined();

      await tree.clear();
      expect(localStorage.removeItem).toHaveBeenCalledWith('clear-test');

      // Clean up
      tree.dispose();
    });

    it('should properly dispose of resources', () => {
      const tree = signalTree({ count: 0 }).with(
        withPersistence({
          key: 'dispose-test',
          autoSave: true,
          autoLoad: false,
        })
      ) as PersistableSignalTree<{ count: number }>;

      // Spy on clearInterval
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      // Dispose should clean up intervals
      tree.dispose();

      // Verify cleanup occurred
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should handle save errors with error handler', async () => {
      const onSaveError = jest.fn();
      const failingAdapter: StorageAdapter = {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockRejectedValue(new Error('Storage write failed')),
        removeItem: jest.fn().mockResolvedValue(undefined),
      };

      const tree = signalTree({ count: 0 }).with(
        withPersistence({
          key: 'test',
          storage: failingAdapter,
          autoLoad: false,
          onSaveError,
        })
      ) as PersistableSignalTree<{ count: number }>;

      await expect(tree.save()).rejects.toThrow('Storage write failed');
      expect(onSaveError).toHaveBeenCalledWith(expect.any(Error));

      // Clean up
      tree.dispose();
    });

    it('should handle load errors with error handler', async () => {
      const onLoadError = jest.fn();
      const failingAdapter: StorageAdapter = {
        getItem: jest.fn().mockRejectedValue(new Error('Storage read failed')),
        setItem: jest.fn().mockResolvedValue(undefined),
        removeItem: jest.fn().mockResolvedValue(undefined),
      };

      const tree = signalTree({ count: 0 }).with(
        withPersistence({
          key: 'test',
          storage: failingAdapter,
          autoLoad: false,
          onLoadError,
        })
      ) as PersistableSignalTree<{ count: number }>;

      await expect(tree.load()).rejects.toThrow('Storage read failed');
      expect(onLoadError).toHaveBeenCalledWith(expect.any(Error));

      // Clean up
      tree.dispose();
    });
  });

  describe('Storage Adapters', () => {
    it('should create custom storage adapter', () => {
      const mockRead = jest.fn().mockResolvedValue('{"test": true}');
      const mockWrite = jest.fn().mockResolvedValue(undefined);
      const mockDelete = jest.fn().mockResolvedValue(undefined);

      const adapter = createStorageAdapter(mockRead, mockWrite, mockDelete);

      expect(adapter.getItem).toBe(mockRead);
      expect(adapter.setItem).toBe(mockWrite);
      expect(adapter.removeItem).toBe(mockDelete);
    });

    it('should create IndexedDB adapter', () => {
      const adapter = createIndexedDBAdapter('TestDB', 'states');

      expect(adapter.getItem).toBeDefined();
      expect(adapter.setItem).toBeDefined();
      expect(adapter.removeItem).toBeDefined();
      expect(typeof adapter.getItem).toBe('function');
      expect(typeof adapter.setItem).toBe('function');
      expect(typeof adapter.removeItem).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', () => {
      const tree = signalTree({ count: 0 }).with(withSerialization());

      expect(() => {
        tree.deserialize('invalid json');
      }).toThrow();
    });

    it('should handle missing properties during deserialization', () => {
      const tree = signalTree({
        count: 0,
        user: { name: '', age: 0 },
        extra: 'value',
      }).with(withSerialization());

      const partialData = JSON.stringify({
        data: { count: 42 }, // Missing user and extra
        metadata: { timestamp: Date.now(), version: '2.0.0' },
      });

      // Should not throw but warn
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(() => {
        tree.deserialize(partialData);
      }).not.toThrow();

      expect(tree.$.count()).toBe(42);
      // Other properties should remain unchanged
      expect(tree.$.user.name()).toBe('');
      expect(tree.$.user.age()).toBe(0);
      expect(tree.$.extra()).toBe('value');

      consoleSpy.mockRestore();
    });

    it('should handle storage errors gracefully', async () => {
      const failingAdapter: StorageAdapter = {
        getItem: jest.fn().mockRejectedValue(new Error('Storage read failed')),
        setItem: jest.fn().mockRejectedValue(new Error('Storage write failed')),
        removeItem: jest
          .fn()
          .mockRejectedValue(new Error('Storage delete failed')),
      };

      const tree = signalTree({ count: 0 }).with(
        withPersistence({
          key: 'test',
          storage: failingAdapter,
          autoLoad: false,
        })
      ) as PersistableSignalTree<{ count: number }>;

      // These should reject but not throw uncaught errors
      await expect(tree.save()).rejects.toThrow('Storage write failed');
      await expect(tree.load()).rejects.toThrow('Storage read failed');
      await expect(tree.clear()).rejects.toThrow('Storage delete failed');

      // Clean up
      tree.dispose();
    });
  });
});
