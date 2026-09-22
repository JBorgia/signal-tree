import {
  Component,
  computed,
  signal,
  Signal,
  ChangeDetectionStrategy,
  OnDestroy,
} from '@angular/core';
import { entityMap, signalTree } from '@signal-tree/angular';

import type { EntityMapMarker } from '@signal-tree/angular';

import {
  ExampleComponent,
  type CodeFile,
} from '../../../../shared/components/example-shell';

interface Row {
  id: number;
  value: number;
}

/** Counts computed derivation bodies for two access patterns, not DOM renders.
 * Other designs may memoize unchanged records; this is not a library ranking.
 */
@Component({
  selector: 'app-granular-reactivity-demo',
  standalone: true,
  imports: [ExampleComponent],
  template: `
    <div class="layout-frame">
      <st-example
        heading="Granular reactivity — how many derivations re-run?"
        [headingLevel]="1"
        [code]="codeFiles"
      >
        <p intro class="muted">
          Update one row and count computed bodies that run again. Compare
          per-record dependencies with a single root signal.
        </p>

        <section class="demo">
          <div class="cols">
            <div class="col">
              <h3>SignalTree <code>entityMap</code></h3>
              <button type="button" (click)="bumpTree()">
                Bump a random row
              </button>
              <p class="metric">
                derivations re-run on last change:
                <strong [class.good]="treeDelta() <= 1">{{
                  treeDelta()
                }}</strong>
                / {{ n }}
              </p>
              <p class="muted total">total since load: {{ treeTotal() }}</p>
            </div>

            <div class="col">
              <h3>Single root signal</h3>
              <button type="button" (click)="bumpRaw()">
                Bump a random row
              </button>
              <p class="metric">
                derivations re-run on last change:
                <strong [class.bad]="rawDelta() > 1">{{ rawDelta() }}</strong>
                / {{ n }}
              </p>
              <p class="muted total">total since load: {{ rawTotal() }}</p>
            </div>
          </div>

          <p class="muted">
            This measures two access patterns, not browser rendering or
            optimized library alternatives. Other designs can cache unchanged
            records and avoid repeating work.
          </p>
        </section>
      </st-example>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .demo {
        max-width: 48rem;
      }
      .muted {
        color: var(--color-neutral-500, #6b7280);
        font-size: 0.85rem;
      }
      .cols {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
        gap: 1.5rem;
        margin: 1rem 0;
      }
      .metric {
        font-variant-numeric: tabular-nums;
      }
      .metric strong {
        font-size: 1.2rem;
      }
      .good {
        color: var(--color-success, #16a34a);
      }
      .bad {
        color: var(--color-danger, #dc2626);
      }
      .total {
        margin-top: -0.25rem;
      }
      button {
        margin: 0.5rem 0;
      }
    `,
  ],
})
export class GranularReactivityDemoComponent implements OnDestroy {
  readonly codeFiles: CodeFile[] = [
    {
      label: 'Per-record dependency',
      language: 'typescript',
      source: `// One computed value per row, primed before measuring.
const value = computed(() => {
  treeBodyRuns++;
  return tree.$.rows.byId(id)?.value() ?? 0;
});

tree.$.rows.updateOne(id, { value: previous + 1 });
// Read every computed: only the changed row's body reruns.
for (const read of treeDerivations) read();`,
    },
    {
      label: 'Single root dependency',
      language: 'typescript',
      source: `const value = computed(() => {
  rawBodyRuns++;
  return rawRoot()[id]?.value ?? 0;
});

rawRoot.update((rows) => ({
  ...rows, [id]: { ...rows[id], value: rows[id].value + 1 },
}));
for (const read of rawDerivations) read();
// All bodies depend on rawRoot. Equal results can still avoid renders.
// A hand-built signal per record is another possible design.`,
    },
  ];

  readonly n = 6;

  // Body-execution counters incremented INSIDE each row's derivation.
  private treeBodyRuns = 0;
  private rawBodyRuns = 0;
  readonly treeDelta = signal(0);
  readonly rawDelta = signal(0);
  readonly treeTotal = signal(0);
  readonly rawTotal = signal(0);

  // --- SignalTree: entityMap, per-entity signals ---
  private tree = signalTree<{ rows: EntityMapMarker<Row, number> }>({
    rows: entityMap<Row, number>({ selectId: (r) => r.id }),
  });
  private treeDerivations: Signal<number>[] = [];

  // --- Naive baseline: one root signal holding all rows ---
  private rawRoot = signal<Record<number, Row>>({});
  private rawDerivations: Signal<number>[] = [];

  constructor() {
    const seed: Row[] = Array.from({ length: this.n }, (_, i) => ({
      id: i + 1,
      value: 0,
    }));
    this.tree.$.rows.addMany(seed);
    const raw: Record<number, Row> = {};
    for (const r of seed) raw[r.id] = r;
    this.rawRoot.set(raw);

    // One derivation per row. The body increments a counter so we can measure
    // exactly how many re-run per change.
    for (const r of seed) {
      const id = r.id;
      this.treeDerivations.push(
        computed(() => {
          this.treeBodyRuns++;
          return this.tree.$.rows.byId(id)?.value() ?? 0; // depends on entity `id` only
        })
      );
      this.rawDerivations.push(
        computed(() => {
          this.rawBodyRuns++;
          return this.rawRoot()[id]?.value ?? 0; // depends on the ROOT signal
        })
      );
    }
    // Prime both (initial body run for each).
    this.flush(this.treeDerivations);
    this.flush(this.rawDerivations);
    this.treeTotal.set(this.treeBodyRuns);
    this.rawTotal.set(this.rawBodyRuns);
  }

  ngOnDestroy(): void {
    this.tree.destroy();
  }

  private flush(derivs: Signal<number>[]): void {
    for (const d of derivs) d();
  }

  bumpTree(): void {
    const ids = this.tree.$.rows.ids();
    const id = ids[Math.floor(Math.random() * ids.length)];
    const before = this.treeBodyRuns;
    this.tree.$.rows.updateOne(id, {
      value: (this.tree.$.rows.byId(id)?.value() ?? 0) + 1,
    });
    this.flush(this.treeDerivations); // re-read; only dirty derivations re-run
    this.treeDelta.set(this.treeBodyRuns - before);
    this.treeTotal.set(this.treeBodyRuns);
  }

  bumpRaw(): void {
    const ids = Object.keys(this.rawRoot()).map(Number);
    const id = ids[Math.floor(Math.random() * ids.length)];
    const before = this.rawBodyRuns;
    this.rawRoot.update((m) => ({
      ...m,
      [id]: { ...m[id], value: m[id].value + 1 },
    }));
    this.flush(this.rawDerivations);
    this.rawDelta.set(this.rawBodyRuns - before);
    this.rawTotal.set(this.rawBodyRuns);
  }
}
