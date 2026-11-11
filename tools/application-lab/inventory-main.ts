import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  createEnvironmentInjector,
  inject,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { createInventory } from './arm';
import { seedJobs, type Editor, type Inventory, type Job } from './model';

interface Session {
  readonly inventory: Inventory;
  destroy(): Promise<void>;
}

const timings: Record<string, number> = {};
const rowCount = Number(
  new URLSearchParams(location.search).get('rows') ?? 1000
);
const fault = new URLSearchParams(location.search).get('fault');
const heldEditors = new Map<string, Editor>();
let app: ApplicationRef | undefined;
let component: InventoryApp | undefined;
const current = (): InventoryApp => {
  if (!component) throw new Error('Session destroyed');
  return component;
};

function oracleControl(inventory: Inventory, initialCount: number): Inventory {
  // Deliberately wrong application behavior; never active in a measured arm.
  // These controls establish that the common stage assertions can fail.
  if (fault === 'drop-filter') return { ...inventory, filter() {} };
  if (fault === 'stale-count') {
    return { ...inventory, total: () => initialCount };
  }
  if (fault === 'invalid-add')
    return {
      ...inventory,
      add: (title) =>
        inventory.add(title.trim() ? title : 'invalid input was stored'),
    };
  if (fault === 'stale-editor')
    return {
      ...inventory,
      openEditor: (id) => ({ rename: (title) => inventory.rename(id, title) }),
    };
  return inventory;
}

@Component({
  selector: 'lab-inventory',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <h1>Dispatch inventory</h1>
      <section aria-label="Inventory controls">
        <label
          >Filter jobs
          <input
            data-testid="filter"
            [value]="store().query()"
            (input)="store().filter($any($event.target).value)"
        /></label>
        <label
          >New job
          <input
            data-testid="new-title"
            [value]="newTitle()"
            (input)="newTitle.set($any($event.target).value)"
        /></label>
        <button data-testid="add" (click)="add()">Add job</button>
        <output data-testid="error" aria-live="polite">{{
          store().error() ?? ''
        }}</output>
      </section>
      <p>
        <span data-testid="matched">{{ store().matched() }}</span> matching /
        <span data-testid="total">{{ store().total() }}</span> jobs. Selected:
        <span data-testid="selected">{{ store().selected() ?? 'none' }}</span>
      </p>
      <table>
        <thead>
          <tr>
            <th>Job</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (job of store().visible(); track job.instance) {
          <tr [attr.data-job]="job.id" [attr.data-instance]="job.instance">
            <td data-field="title">{{ job.title }}</td>
            <td>{{ job.owner }}</td>
            <td>{{ job.status }}</td>
            <td>
              <button
                [attr.data-testid]="'toggle-' + job.id"
                (click)="store().toggle(job.id)"
              >
                {{ job.active ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td>
              <button
                [attr.data-testid]="'select-' + job.id"
                (click)="store().select(job.id)"
              >
                Select
              </button>
              <button
                [attr.data-testid]="'remove-' + job.id"
                (click)="store().remove(job.id)"
              >
                Remove
              </button>
            </td>
          </tr>
          }
        </tbody>
      </table>
      @if (store().selected(); as id) {
      <section aria-label="Selected job">
        <label
          >Title
          <input
            data-testid="rename-title"
            [value]="editTitle()"
            (input)="editTitle.set($any($event.target).value)"
        /></label>
        <button data-testid="rename" (click)="store().rename(id, editTitle())">
          Rename
        </button>
      </section>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        font: 15px system-ui;
        color: #172b42;
        background: #f6f8fb;
        min-height: 100vh;
      }
      main {
        max-width: 1160px;
        margin: auto;
        padding: 24px;
      }
      h1 {
        margin: 0 0 24px;
      }
      section {
        display: flex;
        align-items: end;
        gap: 16px;
        flex-wrap: wrap;
        margin: 16px 0;
      }
      label {
        display: grid;
        gap: 6px;
      }
      input,
      button {
        font: inherit;
        padding: 7px 10px;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        background: white;
      }
      td,
      th {
        text-align: left;
        padding: 7px;
        border-bottom: 1px solid #dce3eb;
      }
      output {
        color: #982b22;
      }
      button {
        cursor: pointer;
      }
    `,
  ],
})
class InventoryApp {
  private readonly parent = inject(EnvironmentInjector);
  private session: Session;
  readonly store;
  readonly newTitle = signal('');
  readonly editTitle = signal('');

  constructor() {
    // Harness ownership is explicit; the destroy hook clears this reference.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    component = this;
    this.session = this.makeSession(rowCount);
    this.store = signal(this.session.inventory);
  }

  private makeSession(count: number): Session {
    const seedStart = performance.now();
    const rows = seedJobs(count);
    timings.seed = performance.now() - seedStart;
    const injector = createEnvironmentInjector([], this.parent);
    const start = performance.now();
    const inventory = runInInjectionContext(injector, () =>
      oracleControl(createInventory(rows), rows.length)
    );
    timings.factory = performance.now() - start;
    let disposal: Promise<void> | undefined;
    return {
      inventory,
      destroy() {
        if (!disposal) {
          // Stop framework-owned observers before retiring their data sources.
          injector.destroy();
          const completion = inventory.destroy();
          disposal = Promise.resolve(completion);
        }
        return disposal;
      },
    };
  }

  add(): void {
    if (this.store().add(this.newTitle()) !== null) this.newTitle.set('');
  }
  async reset(count: number): Promise<void> {
    await this.session.destroy();
    this.session = this.makeSession(count);
    this.store.set(this.session.inventory);
  }
  dispose(): Promise<void> {
    return this.session.destroy();
  }
  ngOnDestroy(): void {
    void this.session.destroy();
  }
}

async function stable(): Promise<void> {
  if (!app) throw new Error('Application unavailable');
  await app.whenStable();
  // Force layout after Angular has rendered. This is not a paint/INP measure.
  document.body.getBoundingClientRect();
}

const start = performance.now();
app = await bootstrapApplication(InventoryApp);
await stable();
timings.bootstrapToLayout = performance.now() - start;
timings.navigationToLayout = performance.now();

const lab = {
  timings,
  ready: true,
  stable,
  row: (id: string): Job | undefined => current().store().row(id),
  async reset(count = rowCount) {
    await current().reset(count);
    await stable();
  },
  holdEditor(key: string, id: string) {
    heldEditors.set(key, current().store().openEditor(id));
  },
  async editHeld(key: string, title: string) {
    const editor = heldEditors.get(key);
    if (!editor) throw new Error('No such retained editor');
    editor.rename(title);
    await stable();
  },
  async replace(id: string, row: Job) {
    current().store().replace(id, row);
    await stable();
  },
  async rename(id: string, title: string) {
    current().store().rename(id, title);
    await stable();
  },
  async measure(
    action: { kind: 'filter'; value: string } | { kind: 'click'; id: string }
  ) {
    const begin = performance.now();
    if (action.kind === 'filter') {
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="filter"]'
      );
      if (!input) throw new Error('Missing filter');
      input.value = action.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const button = document.querySelector<HTMLButtonElement>(
        `[data-testid="${action.id}"]`
      );
      if (!button) throw new Error(`Missing action ${action.id}`);
      button.click();
    }
    await stable();
    return performance.now() - begin;
  },
  async destroy() {
    if (fault === 'skip-destroy') return;
    heldEditors.clear();
    await component?.dispose();
    app?.destroy();
    component = undefined;
    app = undefined;
  },
};
Object.assign(window, { lab });
