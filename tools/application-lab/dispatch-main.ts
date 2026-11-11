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
import { createDispatch } from './dispatch-arm';
import { DispatchBackend } from './dispatch-backend';
import {
  dispatchRows,
  type AssignmentField,
  type Dispatch,
  type DispatchEditor,
  type DispatchJob,
  type PublicationPayload,
} from './dispatch-model';
import { seedJobs } from './model';

const count = Number(new URLSearchParams(location.search).get('rows') ?? 1000);
const fault = new URLSearchParams(location.search).get('fault');
const timings: Record<string, number> = {};
const editors = new Map<string, DispatchEditor>();
let app: ApplicationRef | undefined;
let component: DispatchApp | undefined;
let previousBackend: DispatchBackend | undefined;
let retiredBackend: DispatchBackend | undefined;

interface Session {
  store: Dispatch;
  backend: DispatchBackend;
  dispose(): Promise<void>;
}

function controls(store: Dispatch, service: DispatchBackend): Dispatch {
  if (fault === 'stale-editor')
    return {
      ...store,
      openEditor: (id) => ({
        assign: (field, value, commandId) =>
          store.assign(id, field, value, commandId),
      }),
    };
  if (fault === 'stale-preview')
    return {
      ...store,
      preview: () => {
        const preview = store.preview();
        return preview && { ...preview, pending: 0 };
      },
    };
  if (fault === 'false-rejection')
    return {
      ...store,
      operations: () =>
        store
          .operations()
          .map((operation) =>
            operation.outcome === 'unknown'
              ? { ...operation, outcome: 'rejected' as const }
              : operation
          ),
    };
  if (fault === 'drop-write') return { ...store, assign() {} };
  if (fault === 'stale-success')
    return {
      ...store,
      row(id) {
        const row = store.row(id);
        const operations = store.operations();
        return row &&
          operations.some((op) => op.id === 'A' && op.outcome === 'applied') &&
          operations.some((op) => op.id === 'C' && op.outcome === 'applied')
          ? { ...row, owner: 'Ada', ownerRevision: 11 }
          : row;
      },
    };
  if (fault === 'clobber-other-field')
    return {
      ...store,
      row(id) {
        const row = store.row(id);
        return row &&
          store
            .operations()
            .some(
              (op) =>
                op.subject === id &&
                op.field === 'status' &&
                op.outcome === 'rejected'
            )
          ? { ...row, owner: 'Operator 0' }
          : row;
      },
    };
  if (fault === 'premature-publication')
    return {
      ...store,
      publish(id, kind, subject) {
        if (kind === 'plan') {
          store.openPreview();
          const preview = store.preview();
          if (!preview) throw new Error('Missing preview');
          void service.publish(id, {
            kind,
            rows: preview.rows,
            capacity: preview.capacity,
          });
        } else store.publish(id, kind, subject);
      },
    };
  if (fault === 'blanket-block')
    return {
      ...store,
      publish(id, kind, subject) {
        if (
          kind === 'progress' &&
          store
            .operations()
            .some(
              (operation) =>
                operation.outcome === 'pending' ||
                operation.outcome === 'unknown'
            )
        )
          return;
        store.publish(id, kind, subject);
      },
    };
  return store;
}

@Component({
  selector: 'lab-dispatch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <main>
    <h1>Coordinated dispatch</h1>
    <section>
      <label
        >Command ID<input
          data-testid="command-id"
          [value]="commandId()"
          (input)="commandId.set($any($event.target).value)"
      /></label>
      <label
        >Owner<input
          data-testid="owner-input"
          [value]="owner()"
          (input)="owner.set($any($event.target).value)"
      /></label>
      <button data-testid="assign-owner" (click)="assign('owner', owner())">
        Assign owner
      </button>
      <label
        >Status<select
          data-testid="status-input"
          [value]="status()"
          (change)="status.set($any($event.target).value)"
        >
          <option value="queued">Queued</option>
          <option value="active">Active</option>
          <option value="done">Done</option>
        </select></label
      ><button data-testid="assign-status" (click)="assign('status', status())">
        Change status
      </button>
    </section>
    <section>
      <label
        >Capacity<input
          data-testid="capacity-input"
          type="number"
          [value]="capacity()"
          (input)="capacity.set(+$any($event.target).value)"
      /></label>
      <button
        data-testid="draft-capacity"
        (click)="store().draftCapacity(capacity(), commandId())"
      >
        Propose capacity
      </button>
      <span data-testid="capacity">{{ store().capacity().value }}</span>
    </section>
    <section>
      <label
        >Publication ID<input
          data-testid="intent-id"
          [value]="intentId()"
          (input)="intentId.set($any($event.target).value)"
      /></label>
      <button data-testid="open-preview" (click)="store().openPreview()">
        Open plan preview
      </button>
      <button
        data-testid="publish-plan"
        (click)="store().publish(intentId(), 'plan')"
      >
        Publish plan
      </button>
      <button
        data-testid="publish-progress"
        (click)="store().publish(intentId(), 'progress', 'J-0')"
      >
        Publish progress
      </button>
    </section>
    <table>
      <thead>
        <tr>
          <th>Job</th>
          <th>Owner</th>
          <th>Status</th>
          <th>Accepted owner revision</th>
        </tr>
      </thead>
      <tbody>
        @for (id of ids(); track id) { @if (store().row(id); as row) {
        <tr [attr.data-job]="row.id" [attr.data-instance]="row.instance">
          <td>{{ row.title }}</td>
          <td data-field="owner">{{ row.owner }}</td>
          <td data-field="status">{{ row.status }}</td>
          <td data-field="owner-revision">{{ row.ownerRevision }}</td>
        </tr>
        } }
      </tbody>
    </table>
    @if (store().preview(); as preview) {
    <section aria-label="Plan preview">
      <span data-testid="preview-count">{{ preview.rows.length }}</span> jobs;
      <span data-testid="preview-pending">{{ preview.pending }}</span>
      unresolved;
      <span data-testid="preview-owner">{{ preview.rows[0]?.owner }}</span
      >; <span data-testid="preview-status">{{ preview.rows[0]?.status }}</span
      >; capacity
      <span data-testid="preview-capacity">{{ preview.capacity.value }}</span>
    </section>
    }
    <ul aria-label="Commands">
      @for (operation of store().operations(); track operation.id) {
      <li [attr.data-operation]="operation.id">
        {{ operation.value }}:
        <span data-field="outcome">{{ operation.outcome }}</span>
      </li>
      }
    </ul>
    <ul aria-label="Publications">
      @for (publication of store().publications(); track publication.id) {
      <li [attr.data-publication]="publication.id">
        {{ publication.kind }}:
        <span data-field="state">{{ publication.state }}</span>
      </li>
      }
    </ul>
  </main>`,
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
      section {
        display: flex;
        align-items: end;
        gap: 14px;
        flex-wrap: wrap;
        margin: 18px 0;
      }
      label {
        display: grid;
        gap: 6px;
      }
      input,
      button,
      select {
        font: inherit;
        padding: 7px;
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
    `,
  ],
})
class DispatchApp {
  private readonly parent = inject(EnvironmentInjector);
  session: Session;
  readonly store;
  readonly ids = signal<readonly string[]>([]);
  readonly commandId = signal('command-1');
  readonly intentId = signal('plan-1');
  readonly owner = signal('Ada');
  readonly status = signal('active');
  readonly capacity = signal(8);
  constructor() {
    // Harness ownership is explicit; destroyApplication clears this reference.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    component = this;
    this.session = this.makeSession(count);
    this.store = signal(this.session.store);
  }
  private makeSession(size: number): Session {
    const seedStart = performance.now();
    const rows = dispatchRows(seedJobs(size));
    timings.seed = performance.now() - seedStart;
    const backend = new DispatchBackend(rows);
    const injector = createEnvironmentInjector([], this.parent);
    const start = performance.now();
    const store = runInInjectionContext(injector, () =>
      controls(createDispatch(rows, backend), backend)
    );
    timings.factory = performance.now() - start;
    this.ids.set(rows.slice(0, 40).map((row) => row.id));
    let disposal: Promise<void> | undefined;
    return {
      store,
      backend,
      dispose() {
        if (!disposal) {
          if (fault === 'skip-destroy') return Promise.resolve();
          // Stop framework-owned observers before retiring their data sources.
          injector.destroy();
          const completion = store.destroy();
          disposal = Promise.resolve(completion);
        }
        return disposal;
      },
    };
  }
  assign(field: AssignmentField, value: string): void {
    this.store().assign('J-0', field, value, this.commandId());
  }
  async reset(size: number): Promise<void> {
    previousBackend = this.session.backend;
    await this.session.dispose();
    this.session = this.makeSession(size);
    this.store.set(this.session.store);
  }
  ngOnDestroy(): void {
    void this.session.dispose();
  }
}
const current = (): DispatchApp => {
  if (!component) throw new Error('Session destroyed');
  return component;
};
const backend = (): DispatchBackend => current().session.backend;
async function stable(): Promise<void> {
  if (!app) throw new Error('Application unavailable');
  await Promise.resolve(); // Deliver native Promise handlers before stabilization.
  await app.whenStable();
  document.body.getBoundingClientRect();
}
const start = performance.now();
app = await bootstrapApplication(DispatchApp);
await stable();
timings.bootstrapToLayout = performance.now() - start;
timings.navigationToLayout = performance.now();

async function destroyApplication(): Promise<void> {
  editors.clear();
  previousBackend = undefined;
  await component?.session.dispose();
  app?.destroy();
  component = undefined;
  app = undefined;
}

Object.assign(window, {
  lab: {
    ready: true,
    timings,
    stable,
    row: (id: string) => current().store().row(id),
    async reset(size = count) {
      await current().reset(size);
      await stable();
    },
    snapshot() {
      const store = current().store();
      return {
        row: store.row('J-0'),
        canonical: store.canonical('J-0'),
        capacity: store.capacity(),
        preview: store.preview(),
        operations: store.operations(),
        publications: store.publications(),
        requests: backend().requests,
        applications: backend().applications,
        starts: backend().starts,
        publicationAttempts: backend().publicationAttempts,
        acknowledged: backend().acknowledged,
        serverRow: backend().row('J-0'),
        serverCapacity: backend().capacity(),
      };
    },
    async process(
      id: string,
      verdict: 'accept' | 'reject' = 'accept',
      deliver = true
    ) {
      const result = backend().process(id, verdict);
      if (deliver) backend().deliver(id);
      await stable();
      return result;
    },
    async deliver(id: string) {
      backend().deliver(id);
      await stable();
    },
    async lose(id: string) {
      backend().lose(id);
      current().store().timeout(id);
      await stable();
    },
    async retry(id: string) {
      current().store().retry(id);
      await stable();
    },
    async acknowledge(id: string) {
      backend().acknowledge(id);
      await stable();
    },
    async assign(
      id: string,
      field: AssignmentField,
      value: string,
      commandId: string
    ) {
      current().store().assign(id, field, value, commandId);
      await stable();
    },
    async publish(
      id: string,
      kind: PublicationPayload['kind'],
      subject?: string
    ) {
      current().store().publish(id, kind, subject);
      await stable();
    },
    async replace(id: string, row: DispatchJob) {
      backend().replace(id, row);
      current().store().replace(id, row);
      await stable();
    },
    holdEditor(key: string, id: string) {
      editors.set(key, current().store().openEditor(id));
    },
    async editHeld(
      key: string,
      field: AssignmentField,
      value: string,
      id: string
    ) {
      const editor = editors.get(key);
      if (!editor) throw new Error('Missing editor');
      editor.assign(field, value, id);
      await stable();
    },
    reenter(first: string, second: string) {
      backend().onPublish = (id) => {
        if (id !== first || fault === 'drop-reentry') return;
        current()
          .store()
          .assign('J-0', 'status', 'done', second + '-edit');
        current().store().publish(second, 'progress', 'J-0');
      };
    },
    async deliverPrevious(id: string) {
      if (!previousBackend) throw new Error('Missing previous backend');
      previousBackend.process(id);
      previousBackend.deliver(id);
      await stable();
      return {
        starts: previousBackend.starts,
        applications: previousBackend.applications,
      };
    },
    async dismissSettled() {
      current().store().dismissSettled();
      await stable();
    },
    async measure(
      action:
        | { kind: 'click'; id: string }
        | { kind: 'response'; id: string; verdict: 'accept' | 'reject' }
        | { kind: 'ack'; id: string }
    ) {
      const start = performance.now();
      if (action.kind === 'click') {
        const button = document.querySelector<HTMLButtonElement>(
          `[data-testid="${action.id}"]`
        );
        if (!button) throw new Error('Missing action');
        button.click();
      } else if (action.kind === 'ack') backend().acknowledge(action.id);
      else {
        backend().process(action.id, action.verdict);
        backend().deliver(action.id);
      }
      await stable();
      return performance.now() - start;
    },
    async destroy() {
      retiredBackend = undefined;
      await destroyApplication();
    },
    async destroyPending() {
      retiredBackend = backend();
      await destroyApplication();
    },
    async deliverRetired(id: string) {
      const service = retiredBackend;
      retiredBackend = undefined;
      if (!service) throw new Error('No retained test backend');
      service.process(id);
      service.deliver(id);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        applications: service.applications.length,
        starts: service.starts.length,
        publicationAttempts: service.publicationAttempts.length,
      };
    },
  },
});
