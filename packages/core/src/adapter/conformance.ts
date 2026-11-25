/**
 * The adapter conformance kit. Each case is a plain function that throws when
 * the adapter breaks the contract, so any test runner can run them:
 *
 *   for (const c of conformanceCases(myAdapter, harness)) it(c.name, c.run);
 */
import type { CellAdapter, NativeCell, Route } from '../cell.ts';

export interface ConformanceHarness<Tag extends string> {
  /** Writes through the cell's own public API (for example .set() or .value =). */
  write(cell: NativeCell<Tag, unknown>, value: unknown): void;
  /** Subscribes to the cell the way framework code observes it; returns the function that stops. */
  observe(cell: NativeCell<Tag, unknown>, onChange: () => void): () => void;
  /** Runs any pending framework work (effects, microtasks) so observers have run. */
  settle?(): void | Promise<void>;
  /** A framework cell holding `value`, if the adapter adopts cells. */
  foreignCell?(value: unknown): unknown;
  /**
   * Writes to the cell without its public setter, for every known bypass path
   * of the framework. Adapters that intercept at the primitive level (4.5 a)
   * or detect drift (4.5 b) must show that the write reaches route().
   */
  bypasses?: readonly { readonly name: string; write(cell: NativeCell<Tag, unknown>, value: unknown): void }[];
}

export interface ConformanceCase {
  readonly name: string;
  run(): void | Promise<void>;
}

function fail(message: string): never {
  throw new Error(`Adapter conformance: ${message}`);
}

function same(actual: unknown, expected: unknown, what: string): void {
  if (!Object.is(actual, expected)) fail(`${what}: expected ${String(expected)}, got ${String(actual)}`);
}

/** The cases every adapter must pass. */
export function conformanceCases<Tag extends string>(adapter: CellAdapter<Tag>, harness: ConformanceHarness<Tag>): ConformanceCase[] {
  const recorder = () => {
    const routed: { cell: object; next: unknown }[] = [];
    const route: Route = (cell, next) => {
      routed.push({ cell, next });
    };
    return { routed, route };
  };

  const cases: ConformanceCase[] = [
    {
      name: 'createCell holds the initial value',
      run() {
        const { route } = recorder();
        const marker = {};
        const cell = adapter.createCell<unknown>(marker, route);
        same(adapter.peek(cell), marker, 'peek after createCell');
      },
    },
    {
      name: 'commit stores the value, and peek reads it',
      run() {
        const { route } = recorder();
        const cell = adapter.createCell<unknown>(1, route);
        adapter.commit(cell, 2);
        same(adapter.peek(cell), 2, 'peek after commit');
      },
    },
    {
      name: "a write through the cell's own API goes to route and stores nothing",
      run() {
        const { routed, route } = recorder();
        const cell = adapter.createCell<unknown>(1, route);
        harness.write(cell as NativeCell<Tag, unknown>, 5);
        same(routed.length, 1, 'route calls');
        same(routed[0]!.cell, cell, 'routed cell');
        same(routed[0]!.next, 5, 'routed value');
        same(adapter.peek(cell), 1, 'stored value after an unrouted write');
      },
    },
    {
      name: 'route is the shared function given to createCell, called with the cell',
      run() {
        const { routed, route } = recorder();
        const a = adapter.createCell<unknown>(1, route);
        const b = adapter.createCell<unknown>(1, route);
        harness.write(a as NativeCell<Tag, unknown>, 2);
        harness.write(b as NativeCell<Tag, unknown>, 3);
        same(routed[0]!.cell, a, 'first routed cell');
        same(routed[1]!.cell, b, 'second routed cell');
      },
    },
    {
      name: 'observers see a commit',
      async run() {
        const { route } = recorder();
        const cell = adapter.createCell<unknown>(1, route);
        let runs = 0;
        const stop = harness.observe(cell as NativeCell<Tag, unknown>, () => runs++);
        await harness.settle?.();
        const before = runs;
        adapter.commit(cell, 2);
        await harness.settle?.();
        stop();
        if (runs <= before) fail('an observer did not see a commit');
      },
    },
    {
      name: 'observers see every commit inside batch as one change',
      async run() {
        const { route } = recorder();
        const a = adapter.createCell<unknown>(1, route);
        const b = adapter.createCell<unknown>(1, route);
        let runs = 0;
        let seenInconsistent = false;
        const check = () => {
          runs++;
          if (adapter.peek(a) !== adapter.peek(b)) seenInconsistent = true;
        };
        const stopA = harness.observe(a as NativeCell<Tag, unknown>, check);
        const stopB = harness.observe(b as NativeCell<Tag, unknown>, check);
        await harness.settle?.();
        const before = runs;
        adapter.batch(() => {
          adapter.commit(a, 2);
          adapter.commit(b, 2);
        });
        await harness.settle?.();
        stopA();
        stopB();
        if (runs <= before) fail('no observer ran after the batch');
        if (seenInconsistent) fail('an observer saw part of a batch applied');
      },
    },
  ];

  if (adapter.matches && adapter.adopt && harness.foreignCell) {
    const matches = adapter.matches.bind(adapter);
    const adopt = adapter.adopt.bind(adapter);
    const foreignCell = harness.foreignCell;
    cases.push(
      {
        name: 'matches recognises framework cells and nothing else',
        run() {
          if (!matches(foreignCell(1))) fail('matches rejected a framework cell');
          for (const value of [1, 'a', null, undefined, {}, [], () => 1]) {
            if (matches(value)) fail(`matches accepted ${String(value)}`);
          }
        },
      },
      {
        name: 'adopt keeps the framework cell and its value without copying',
        run() {
          const { routed, route } = recorder();
          const value = {};
          const foreign = foreignCell(value);
          const cell = adopt<unknown>(foreign, route);
          same(adapter.peek(cell), value, 'peek after adopt');
          harness.write(cell as NativeCell<Tag, unknown>, 7);
          same(routed.length, 1, 'route calls after a write to an adopted cell');
        },
      },
    );
  }

  for (const bypass of harness.bypasses ?? []) {
    cases.push({
      name: `bypass "${bypass.name}" reaches route`,
      async run() {
        const { routed, route } = recorder();
        const cell = adapter.createCell<unknown>(1, route);
        bypass.write(cell as NativeCell<Tag, unknown>, 9);
        await harness.settle?.();
        // Drift detection (4.5 b) reports the write when the seam next reads the cell.
        adapter.peek(cell);
        if (!routed.some((r) => r.cell === cell && Object.is(r.next, 9))) fail(`the "${bypass.name}" write never reached route`);
      },
    });
  }

  return cases;
}
