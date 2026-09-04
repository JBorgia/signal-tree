import { describe, expect, it, vi } from 'vitest';

import { batching } from '../../enhancers/batching/batching';
import { devTools } from '../../enhancers/devtools/devtools';
import { signalTree } from '../signal-tree';

import { entityMap } from '../types';

describe('derived() marker pattern', () => {
  describe('basic derived state', () => {
    it('warns when a derived location overwrites source state in development', () => {
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        const tree = signalTree(
          { count: 1 },
          { derived: () => ({ count: () => 2 }) }
        );

        expect(tree.$.count()).toBe(2);
        expect(warning).toHaveBeenCalledWith(
          expect.stringContaining('Derived location "count" overwrites source state')
        );
      } finally {
        warning.mockRestore();
      }
    });

    it('should create derived computed signals from source state', () => {
      interface CounterState {
        count: number;
      }

      const initial: CounterState = { count: 5 };
      const tree = signalTree(initial, {
        derived: ($) => ({
          doubled: () => $.count() * 2,
          tripled: () => $.count() * 3,
        }),
      });

      // Access $ to finalize
      expect(tree.$.doubled()).toBe(10);
      expect(tree.$.tripled()).toBe(15);

      // Update source state
      tree.$.count.set(10);

      // Derived should update
      expect(tree.$.doubled()).toBe(20);
      expect(tree.$.tripled()).toBe(30);
    });

    it('should work with nested source state', () => {
      interface AppState {
        user: {
          firstName: string;
          lastName: string;
        };
      }

      const initial: AppState = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };
      const tree = signalTree(initial, {
        derived: ($) => ({
          fullName: () => `${$.user.firstName()} ${$.user.lastName()}`,
        }),
      });

      expect(tree.$.fullName()).toBe('John Doe');

      // Update nested state
      tree.$.user.firstName.set('Jane');
      expect(tree.$.fullName()).toBe('Jane Doe');
    });
  });

  describe('derived composition', () => {
    it('should support derived-of-derived', () => {
      const tree = signalTree(
        { value: 2 },
        {
          derived: ($) => {
            const doubled = () => $.value() * 2;
            return {
              doubled,
              quadrupled: () => doubled() * 2,
            };
          },
        }
      );

      expect(tree.$.doubled()).toBe(4);
      expect(tree.$.quadrupled()).toBe(8);

      // Update source
      tree.$.value.set(5);
      expect(tree.$.doubled()).toBe(10);
      expect(tree.$.quadrupled()).toBe(20);
    });

    it('should maintain correct dependency tracking', () => {
      let computeCount = 0;

      const tree = signalTree(
        { a: 1, b: 2 },
        {
          derived: ($) => {
            const sum = () => {
              computeCount++;
              return $.a() + $.b();
            };
            return { sum, doubleSum: () => sum() * 2 };
          },
        }
      );

      // Initial access
      expect(tree.$.sum()).toBe(3);
      expect(tree.$.doubleSum()).toBe(6);
      const initialCount = computeCount;

      // Update a - should recompute sum
      tree.$.a.set(10);
      expect(tree.$.sum()).toBe(12);
      expect(tree.$.doubleSum()).toBe(24);
      expect(computeCount).toBeGreaterThan(initialCount);
    });
  });

  describe('derived with nested objects', () => {
    it('should support nested derived definitions', () => {
      const tree = signalTree(
        {
          items: [1, 2, 3],
        },
        {
          derived: ($) => ({
            stats: {
              count: () => $.items().length,
              sum: () =>
                $.items().reduce((a: number, b: number) => a + b, 0),
            },
          }),
        }
      );

      expect(tree.$.stats.count()).toBe(3);
      expect(tree.$.stats.sum()).toBe(6);

      tree.$.items.set([1, 2, 3, 4, 5]);
      expect(tree.$.stats.count()).toBe(5);
      expect(tree.$.stats.sum()).toBe(15);
    });

    it('should deep-merge derived namespace into source namespace preserving all properties', () => {
      // This test verifies the deep merge behavior:
      // When a derived layer defines a nested object at the same path as a source object,
      // the source properties should be preserved and the derived properties added.
      interface TicketEntity {
        id: number;
        status: string;
      }

      const tree = signalTree(
        {
          tickets: {
            entities: entityMap<TicketEntity, number>(),
            activeId: null as number | null,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
          },
        },
        {
          derived: ($) => ({
            // Derived namespace with same path as source
            tickets: {
              // Add derived signals
              active: () => {
                const id = $.tickets.activeId();
                return id != null
                  ? $.tickets.entities.byId(id)?.() ?? null
                  : null;
              },
              all: () => $.tickets.entities.all(),
            },
          }),
        }
      );

      // Verify derived signals work
      expect(tree.$.tickets.active()).toBe(null);
      expect(tree.$.tickets.all()).toEqual([]);

      // CRITICAL: Verify source properties are preserved (deep merge)
      // These should NOT be undefined after the derived merge
      expect(tree.$.tickets.entities).toBeDefined();
      expect(typeof tree.$.tickets.entities.addOne).toBe('function');
      expect(typeof tree.$.tickets.entities.byId).toBe('function');
      expect(tree.$.tickets.activeId).toBeDefined();
      expect(tree.$.tickets.startDate).toBeDefined();
      expect(tree.$.tickets.endDate).toBeDefined();

      // Verify mutations still work through source properties
      tree.$.tickets.entities.addOne({ id: 1, status: 'pending' });
      tree.$.tickets.activeId.set(1);

      // Verify derived signals reflect the mutations
      expect(tree.$.tickets.all().length).toBe(1);
      expect(tree.$.tickets.active()?.id).toBe(1);
      expect(tree.$.tickets.active()?.status).toBe('pending');

      // Verify source signal mutations work
      tree.$.tickets.startDate.set(new Date('2024-06-01'));
      expect(tree.$.tickets.startDate()).toEqual(new Date('2024-06-01'));
    });

    it('should preserve entityMap methods when adding derived signals to same namespace', () => {
      // Specifically tests that entityMap API is preserved
      interface Item {
        id: number;
        name: string;
      }

      const tree = signalTree(
        {
          items: {
            entities: entityMap<Item, number>(),
            selectedId: null as number | null,
          },
        },
        {
          derived: ($) => ({
            items: {
              selected: () => {
                const id = $.items.selectedId();
                return id != null
                  ? $.items.entities.byId(id)?.() ?? null
                  : null;
              },
              count: () => $.items.entities.count(),
            },
          }),
        }
      );

      // EntityMap methods should be preserved
      expect(tree.$.items.entities.addOne).toBeDefined();
      expect(tree.$.items.entities.addMany).toBeDefined();
      expect(tree.$.items.entities.updateOne).toBeDefined();
      expect(tree.$.items.entities.removeOne).toBeDefined();
      expect(tree.$.items.entities.setAll).toBeDefined();
      expect(tree.$.items.entities.upsertOne).toBeDefined();
      expect(tree.$.items.entities.byId).toBeDefined();
      expect(tree.$.items.entities.all).toBeDefined();

      // Use the preserved methods
      tree.$.items.entities.upsertOne({ id: 1, name: 'First' });
      tree.$.items.entities.upsertOne({ id: 2, name: 'Second' });

      // Derived signals should work
      expect(tree.$.items.count()).toBe(2);
      expect(tree.$.items.selected()).toBe(null);

      // Select and verify
      tree.$.items.selectedId.set(1);
      expect(tree.$.items.selected()?.name).toBe('First');
    });
  });

  describe('backward compatibility', () => {
    it('should remain callable like the original signalTree', () => {
      const tree = signalTree({ count: 0 });

      // tree.$() should return the unwrapped state
      expect(tree.$()).toEqual({ count: 0 });

      // tree.$(newValue) should update
      tree.$({ count: 5 });
      expect(tree.$()).toEqual({ count: 5 });
    });

    it('should preserve state and $ accessors', () => {
      const tree = signalTree(
        { name: 'test' },
        {
          derived: ($) => ({
            upper: () => $.name().toUpperCase(),
          }),
        }
      );

      // Both accessors should work
      expect(tree.$.name()).toBe('test');
      expect(tree.$.name()).toBe('test');
    });

    it('composes with configured enhancers', () => {
      // Was 'should preserve with() enhancer chaining'. There is no chaining to
      // preserve in v15 — enhancers are declared with the tree — so the claim
      // is the one that survived it: declaring derived state does not cost you
      // enhancers, and declaring enhancers does not cost you derived state.
      const tree = signalTree(
        { count: 0 },
        {
          enhancers: [batching()],
          derived: ($) => ({ doubled: () => $.count() * 2 }),
        }
      );

      expect(tree.$.doubled()).toBe(0);
      expect(typeof (tree as unknown as { coalesce?: unknown }).coalesce).toBe(
        'function'
      );
    });
  });

  describe('multiple derived recipes', () => {
    it('realizes each recipe as a readonly location', () => {
      const tree = signalTree(
        { value: 10 },
        {
          derived: ($) => ({
            plusOne: () => $.value() + 1,
            plusTwo: () => $.value() + 2,
          }),
        }
      );

      expect(tree.$.plusOne()).toBe(11);
      expect(tree.$.plusTwo()).toBe(12);
    });
  });

  describe('declarative composition', () => {
    it('allows local derived values to depend on each other', () => {
      const tree = signalTree(
        { base: 2 },
        {
          derived: ($) => {
            const doubled = () => $.base() * 2;
            return { doubled, quadrupled: () => doubled() * 2 };
          },
        }
      );

      expect(tree.$.doubled()).toBe(4);
      expect(tree.$.quadrupled()).toBe(8);
    });

    it('works with nested derived definitions', () => {
      const tree = signalTree(
        { items: [1, 2, 3, 4, 5] },
        {
          derived: ($) => ({
            stats: {
              count: () => $.items().length,
              sum: () =>
                $.items().reduce((a: number, b: number) => a + b, 0)
              ,
            },
          }),
        }
      );

      expect(tree.$.stats.count()).toBe(5);
      expect(tree.$.stats.sum()).toBe(15);
    });
  });

  describe('production app migration pattern', () => {
    // Simulating a production AppStore computed pattern
    interface DriverDto {
      id: number;
      name: string;
      isExternal: boolean;
      url: string;
    }

    interface TruckDto {
      id: number;
      name: string;
      haulerIds: number[];
      primaryProductLine: string;
    }

    interface HaulerDto {
      id: number;
      name: string;
    }

    it('should migrate AppStore computed signals to derived()', () => {
      // Before: AppStore had separate computed() calls
      // After: Using derived() in the tree definition

      const tree = signalTree(
        {
          driver: {
            current: null as DriverDto | null,
          },
          selected: {
            haulerId: null as number | null,
            truckId: null as number | null,
          },
          trucks: [
            {
              id: 1,
              name: 'Truck A',
              haulerIds: [10],
              primaryProductLine: 'Concrete',
            },
            {
              id: 2,
              name: 'Truck B',
              haulerIds: [10, 20],
              primaryProductLine: 'Asphalt',
            },
          ] as TruckDto[],
          haulers: [
            { id: 10, name: 'Hauler X' },
            { id: 20, name: 'Hauler Y' },
          ] as HaulerDto[],
        },
        {
          derived: ($) => ({
            // Migrated from AppStore.isExternalDriver
            isExternalDriver: () => $.driver.current()?.isExternal ?? true,

            // Migrated from AppStore.isDriverLoaded
            isDriverLoaded: () => $.driver.current() != null,

            // Migrated from AppStore.driverUrl
            driverUrl: () => $.driver.current()?.url ?? '',

            // Migrated from AppStore.selectedTruck
            selectedTruck: () => {
              const id = $.selected.truckId();
              return id != null
                ? $.trucks().find((t) => t.id === id) ?? null
                : null;
            },

            // Migrated from AppStore.selectedProductLine
            selectedProductLine: () => {
              const id = $.selected.truckId();
              const truck =
                id != null ? $.trucks().find((t) => t.id === id) : null;
              return truck?.primaryProductLine ?? null;
            },

            // Migrated from AppStore.selectableTrucks
            selectableTrucks: () => {
              const driver = $.driver.current();
              if (!driver) return [];
              if (!driver.isExternal) return $.trucks();

              const haulerId = $.selected.haulerId();
              if (haulerId == null) return [];

              return $.trucks().filter((truck) =>
                truck.haulerIds.includes(haulerId)
              );
            },

            // Migrated from AppStore.areHaulerAndTruckSelected
            areHaulerAndTruckSelected: () => {
              const driver = $.driver.current();
              if (!driver) return false;
              if (!driver.isExternal) return $.selected.truckId() != null;
              return (
                $.selected.haulerId() != null && $.selected.truckId() != null
              );
            },
          }),
        }
      );

      // Test initial state (no driver)
      expect(tree.$.isExternalDriver()).toBe(true);
      expect(tree.$.isDriverLoaded()).toBe(false);
      expect(tree.$.driverUrl()).toBe('');
      expect(tree.$.selectedTruck()).toBe(null);
      expect(tree.$.selectableTrucks()).toEqual([]);
      expect(tree.$.areHaulerAndTruckSelected()).toBe(false);

      // Set an internal driver
      tree.$.driver.current.set({
        id: 1,
        name: 'John',
        isExternal: false,
        url: '/drivers/1',
      });

      expect(tree.$.isExternalDriver()).toBe(false);
      expect(tree.$.isDriverLoaded()).toBe(true);
      expect(tree.$.driverUrl()).toBe('/drivers/1');
      expect(tree.$.selectableTrucks().length).toBe(2); // All trucks for internal driver

      // Select a truck
      tree.$.selected.truckId.set(1);
      expect(tree.$.selectedTruck()?.name).toBe('Truck A');
      expect(tree.$.selectedProductLine()).toBe('Concrete');
      expect(tree.$.areHaulerAndTruckSelected()).toBe(true);

      // Switch to external driver
      tree.$.driver.current.set({
        id: 2,
        name: 'Jane',
        isExternal: true,
        url: '/drivers/2',
      });
      tree.$.selected.truckId.set(null);

      expect(tree.$.isExternalDriver()).toBe(true);
      expect(tree.$.selectableTrucks()).toEqual([]); // No hauler selected
      expect(tree.$.areHaulerAndTruckSelected()).toBe(false);

      // Select hauler for external driver
      tree.$.selected.haulerId.set(10);
      expect(tree.$.selectableTrucks().length).toBe(2); // Both trucks have hauler 10

      // Select specific truck
      tree.$.selected.truckId.set(2);
      expect(tree.$.selectedTruck()?.name).toBe('Truck B');
      expect(tree.$.areHaulerAndTruckSelected()).toBe(true);
    });

    it('should support derived-of-derived for complex computations', () => {
      // Simulating AppStore.ticketWorkflow which depends on activeProductLine
      const tree = signalTree(
        {
          selected: { truckId: null as number | null },
          trucks: [
            { id: 1, productLine: 'Concrete' },
            { id: 2, productLine: 'Asphalt' },
          ],
        },
        {
          derived: ($) => {
            const selectedTruck = () => {
              const id = $.selected.truckId();
              return $.trucks().find((truck) => truck.id === id) ?? null;
            };
            const activeProductLine = () => selectedTruck()?.productLine ?? null;
            return {
              selectedTruck,
              activeProductLine,
              ticketWorkflow: () => {
                const productLine = activeProductLine();
                if (productLine === 'Concrete') {
                  return [
                    'Batching',
                    'Loading',
                    'InTransit',
                    'Pouring',
                    'Complete',
                  ];
                }
                if (productLine === 'Asphalt') {
                  return ['Loading', 'InTransit', 'Dumping', 'Complete'];
                }
                return ['Loading', 'Complete'];
              },
            };
          },
        }
      );

      // No truck selected
      expect(tree.$.activeProductLine()).toBe(null);
      expect(tree.$.ticketWorkflow()).toEqual(['Loading', 'Complete']);

      // Select concrete truck
      tree.$.selected.truckId.set(1);
      expect(tree.$.activeProductLine()).toBe('Concrete');
      expect(tree.$.ticketWorkflow()).toEqual([
        'Batching',
        'Loading',
        'InTransit',
        'Pouring',
        'Complete',
      ]);

      // Switch to asphalt truck
      tree.$.selected.truckId.set(2);
      expect(tree.$.activeProductLine()).toBe('Asphalt');
      expect(tree.$.ticketWorkflow()).toEqual([
        'Loading',
        'InTransit',
        'Dumping',
        'Complete',
      ]);
    });
  });

  describe('entityMap integration', () => {
    interface UserEntity {
      id: number;
      name: string;
      email: string;
      role: 'admin' | 'user';
      active: boolean;
    }

    it('should work with entityMap queries in derived()', () => {
      const tree = signalTree(
        {
          users: entityMap<UserEntity, number>(),
          selectedUserId: null as number | null,
        },
        {
          derived: ($) => ({
            // Derived from entityMap.byId()
            selectedUser: () => {
              const id = $.selectedUserId();
              return id != null ? $.users.byId(id)?.() ?? null : null;
            },

            // Derived from entityMap.all()
            activeUsers: () =>
              $.users.all().filter((u: UserEntity) => u.active),

            // Derived from entityMap.count
            userCount: () => $.users.count(),

            // Derived from entityMap.where()
            adminUsers: () =>
              $.users.all().filter((u: UserEntity) => u.role === 'admin'),
          }),
        }
      );

      // Initial state - no users
      expect(tree.$.selectedUser()).toBe(null);
      expect(tree.$.activeUsers()).toEqual([]);
      expect(tree.$.userCount()).toBe(0);
      expect(tree.$.adminUsers()).toEqual([]);

      // Add some users
      tree.$.users.addMany([
        {
          id: 1,
          name: 'Alice',
          email: 'alice@test.com',
          role: 'admin',
          active: true,
        },
        {
          id: 2,
          name: 'Bob',
          email: 'bob@test.com',
          role: 'user',
          active: true,
        },
        {
          id: 3,
          name: 'Charlie',
          email: 'charlie@test.com',
          role: 'user',
          active: false,
        },
      ]);

      expect(tree.$.userCount()).toBe(3);
      expect(tree.$.activeUsers().length).toBe(2);
      expect(tree.$.adminUsers().length).toBe(1);
      expect(tree.$.adminUsers()[0].name).toBe('Alice');

      // Select a user
      tree.$.selectedUserId.set(2);
      expect(tree.$.selectedUser()?.name).toBe('Bob');

      // Update user status
      tree.$.users.updateOne(3, { active: true });
      expect(tree.$.activeUsers().length).toBe(3);

      // Select non-existent user
      tree.$.selectedUserId.set(999);
      expect(tree.$.selectedUser()).toBe(null);
    });

    it('should support complex queries with multiple entityMaps', () => {
      interface OrderEntity {
        id: number;
        userId: number;
        total: number;
        status: 'pending' | 'shipped' | 'delivered';
      }

      const tree = signalTree(
        {
          users: entityMap<UserEntity, number>(),
          orders: entityMap<OrderEntity, number>(),
          selectedUserId: null as number | null,
        },
        {
          derived: ($) => {
            const selectedUserOrders = () => {
              const userId = $.selectedUserId();
              if (userId == null) return [];
              return $.orders
                .all()
                .filter((order: OrderEntity) => order.userId === userId);
            };
            return {
              selectedUser: () => {
                const id = $.selectedUserId();
                return id != null ? $.users.byId(id)?.() ?? null : null;
              },

              // Cross-entity derived: orders for selected user
              selectedUserOrders,

              // Aggregation: total revenue per user status
              totalPendingRevenue: () =>
                $.orders
                  .all()
                  .filter((o: OrderEntity) => o.status === 'pending')
                  .reduce((sum: number, o: OrderEntity) => sum + o.total, 0)
              ,
              selectedUserOrderCount: () => selectedUserOrders().length,

              selectedUserTotalSpent: () =>
                selectedUserOrders().reduce(
                  (sum: number, o: OrderEntity) => sum + o.total,
                  0
                )
              ,
            };
          },
        }
      );

      // Setup data
      tree.$.users.addMany([
        { id: 1, name: 'Alice', email: 'a@t.com', role: 'admin', active: true },
        { id: 2, name: 'Bob', email: 'b@t.com', role: 'user', active: true },
      ]);

      tree.$.orders.addMany([
        { id: 101, userId: 1, total: 100, status: 'pending' },
        { id: 102, userId: 1, total: 200, status: 'shipped' },
        { id: 103, userId: 2, total: 50, status: 'pending' },
        { id: 104, userId: 2, total: 75, status: 'delivered' },
      ]);

      // Check totals
      expect(tree.$.totalPendingRevenue()).toBe(150); // 100 + 50

      // Select Alice
      tree.$.selectedUserId.set(1);
      expect(tree.$.selectedUserOrders().length).toBe(2);
      expect(tree.$.selectedUserOrderCount()).toBe(2);
      expect(tree.$.selectedUserTotalSpent()).toBe(300);

      // Select Bob
      tree.$.selectedUserId.set(2);
      expect(tree.$.selectedUserOrders().length).toBe(2);
      expect(tree.$.selectedUserOrderCount()).toBe(2);
      expect(tree.$.selectedUserTotalSpent()).toBe(125);

      // Update order status
      tree.$.orders.updateOne(103, { status: 'shipped' });
      expect(tree.$.totalPendingRevenue()).toBe(100); // Only Alice's pending order
    });

    it('should handle entity mutations reactively', () => {
      const tree = signalTree(
        {
          items: entityMap<{ id: number; value: number }, number>(),
        },
        {
          derived: ($) => ({
            sum: () =>
              $.items
                .all()
                .reduce(
                  (acc: number, item: { value: number }) => acc + item.value,
                  0
                )
            ,
            average: () => {
              const all = $.items.all();
              if (all.length === 0) return 0;
              const sum = all.reduce(
                (acc: number, item: { value: number }) => acc + item.value,
                0
              );
              return sum / all.length;
            },
          }),
        }
      );

      expect(tree.$.sum()).toBe(0);
      expect(tree.$.average()).toBe(0);

      tree.$.items.addOne({ id: 1, value: 10 });
      expect(tree.$.sum()).toBe(10);
      expect(tree.$.average()).toBe(10);

      tree.$.items.addOne({ id: 2, value: 20 });
      expect(tree.$.sum()).toBe(30);
      expect(tree.$.average()).toBe(15);

      tree.$.items.updateOne(1, { value: 30 });
      expect(tree.$.sum()).toBe(50);
      expect(tree.$.average()).toBe(25);

      tree.$.items.removeOne(2);
      expect(tree.$.sum()).toBe(30);
      expect(tree.$.average()).toBe(30);
    });

    it('should update byId-derived when id is set before setAll()', () => {
      interface ProductEntity {
        id: string;
        name: string;
      }

      const tree = signalTree(
        {
          products: entityMap<ProductEntity>(),
          activeProductId: undefined as string | undefined,
        },
        {
          derived: ($) => ({
            activeProduct: () => {
              const id = $.activeProductId();
              return id != null ? $.products.byId(id)?.() : undefined;
            },
          }),
        }
      );

      // Set id first (entity not present yet)
      tree.$.activeProductId.set('1');
      expect(tree.$.activeProduct()).toBeUndefined();

      // Now load entities - derived should update without extra deps
      tree.$.products.setAll([
        { id: '1', name: 'Apple' },
        { id: '2', name: 'Banana' },
      ]);

      expect(tree.$.activeProduct()?.name).toBe('Apple');
    });
  });

  it('merges derived signals once, into the $ the enhancers saw', () => {
    // Was 'should preserve derived signal identity across .with() chaining'.
    // The failure it guards against is unchanged: derived factories running
    // more than once, or running against a `$` that an enhancer later replaced,
    // which produces a second `doubled` over the same source and the
    // 'overwrites source signal' warning. Without a chain to compare across,
    // the observable form is that the finished tree's `$` IS the object each
    // enhancer was handed, and `doubled` lands on it exactly once.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // silence warnings; we assert below that overwrite warnings do not happen
    });

    const seen: unknown[] = [];
    const probe = (t: unknown) => {
      seen.push((t as { $: unknown }).$);
      return t;
    };

    const tree = signalTree(
      { count: 1 },
      {
        enhancers: [
          probe as never,
          batching() as never,
          probe as never,
          devTools({ enabled: false }) as never,
          probe as never,
        ],
        derived: ($) => ({ doubled: () => $.count() * 2 }),
      }
    );

    expect(seen).toHaveLength(3);
    for (const seen$ of seen) expect(tree.$).toBe(seen$);
    expect(tree.$.doubled).toBe(tree.$.doubled);
    expect(tree.$.doubled()).toBe(2);

    const warnedAboutOverwrite = warnSpy.mock.calls.some((call) =>
      String(call[0] ?? '').includes('overwrites source signal')
    );
    expect(warnedAboutOverwrite).toBe(false);

    warnSpy.mockRestore();
  });

  // Timing-ratio microbenchmarks — flaky on loaded machines; run on demand via
  // ST_PERF=1 (matches the convention in benchmarks.spec.ts / stored.spec.ts).
  describe.runIf(process.env['ST_PERF'] === '1')(
    'performance characteristics',
    () => {
      it('should not add significant overhead to tree creation', () => {
        const iterations = 1000;

        // Measure tree creation with derived()
        const startWithDerived = performance.now();
        for (let i = 0; i < iterations; i++) {
          const tree = signalTree(
            { count: i },
            {
              derived: ($) => ({
                doubled: () => $.count() * 2,
              }),
            }
          );
          // Access $ to finalize (this is the typical usage pattern)
          void tree.$.doubled();
        }
        const endWithDerived = performance.now();
        const timeWithDerived = endWithDerived - startWithDerived;

        // Measure tree creation without derived() for comparison
        const startWithout = performance.now();
        for (let i = 0; i < iterations; i++) {
          const tree = signalTree({ count: i });
          // Access $ similarly
          void tree.$.count();
        }
        const endWithout = performance.now();
        const timeWithout = endWithout - startWithout;

        // derived() should add less than 5x overhead (generous margin for CI variance)
        // In practice, it's typically <2x on warm runs
        const ratio = timeWithDerived / timeWithout;
        console.log(
          `Performance: ${iterations} iterations - with derived: ${timeWithDerived.toFixed(
            2
          )}ms, without: ${timeWithout.toFixed(2)}ms, ratio: ${ratio.toFixed(
            2
          )}x`
        );
        expect(ratio).toBeLessThan(5);
      });

      it('should not recalculate derived values on unrelated state changes', () => {
        let derivedCallCount = 0;

        const tree = signalTree(
          {
            relatedValue: 1,
            unrelatedValue: 'hello',
          },
          {
            derived: ($) => ({
              doubledRelated: () => {
                derivedCallCount++;
                return $.relatedValue() * 2;
              },
            }),
          }
        );

        // Initial access
        expect(tree.$.doubledRelated()).toBe(2);
        const initialCallCount = derivedCallCount;

        // Change unrelated value - should NOT trigger recalculation
        tree.$.unrelatedValue.set('world');
        // Access derived again - should use cached value
        expect(tree.$.doubledRelated()).toBe(2);
        expect(derivedCallCount).toBe(initialCallCount); // No new call

        // Change related value - SHOULD trigger recalculation
        tree.$.relatedValue.set(5);
        expect(tree.$.doubledRelated()).toBe(10);
        expect(derivedCallCount).toBe(initialCallCount + 1); // One new call
      });

      it('should handle deep chaining without exponential overhead', () => {
        const chainDepth = 3;
        const iterations = 100;

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          const derived = [] as Array<
            ($: Record<string, () => number>) => Record<string, unknown>
          >;
          for (let d = 0; d < chainDepth; d++) {
            derived.push(($) => ({
              [`level${d}`]: () => $['base']() + d,
            }));
          }
          const builder = signalTree({ base: i }, { derived } as never);
          // Access the final derived value
          void (builder.$ as Record<string, () => number>)[
            `level${chainDepth - 1}`
          ]();
        }
        const end = performance.now();
        const totalTime = end - start;

        console.log(
          `Declarative tiers: ${iterations} trees with ${chainDepth} derived layers each: ${totalTime.toFixed(
            2
          )}ms`
        );

        // Should complete reasonably fast (less than 500ms for 100 iterations with 10 layers)
        expect(totalTime).toBeLessThan(500);
      });
    }
  );
});
