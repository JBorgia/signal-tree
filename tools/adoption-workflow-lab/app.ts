import { Component, OnDestroy, signal } from '@angular/core';
import { Workspace } from './workflow';
import { functionalChecks } from './checks';
import { ARM } from './selected-arm';

@Component({
  selector: 'adoption-workspace',
  standalone: true,
  template: ` <main>
    <p>SignalTree ecosystem recipe · {{ arm }}</p>
    <h1>Keep a proposal separate from accepted work.</h1>
    <p>
      Open two editors, propose a route, receive a shipping update, then discard
      one proposal. The other editor and the accepted shipment remain.
    </p>
    <p>
      This synthetic service uses an in-memory receipt cache. It does not
      demonstrate durable recovery.
    </p>
    <button (click)="open()" [disabled]="!ready()">
      Open an editor for job 0
    </button>
    <button (click)="workspace.ship()" [disabled]="!ready()">
      Receive shipping update
    </button>
    <button (click)="workspace.externalRoute()" [disabled]="!ready()">
      Receive competing route
    </button>
    <p role="status">{{ message() }}</p>
    <section aria-label="Independent editors">
      @for (entry of workspace.editors(); track entry.key) {
      <article>
        <h2>Editor {{ entry.key }}</h2>
        <p>
          Route: <strong>{{ entry.editor.read().route }}</strong> · Shipment:
          {{ entry.editor.read().status }}
        </p>
        <p>{{ entry.outcome }}</p>
        <button
          (click)="workspace.propose(entry.key)"
          [disabled]="entry.editor.pending() || saving().has(entry.key)"
        >
          Propose West
        </button>
        <button
          (click)="workspace.reject(entry.key)"
          [disabled]="!entry.editor.pending() || saving().has(entry.key)"
        >
          Discard proposal
        </button>
        <button
          (click)="save(entry.key)"
          [disabled]="!entry.editor.pending() || saving().has(entry.key)"
        >
          Ask service to accept
        </button>
        <button (click)="workspace.close(entry.key)">Close editor</button>
      </article>
      }
    </section>
    @if (ready()) {
    <section>
      <h2>Accepted priority jobs</h2>
      <p>
        Live job/driver join with counts by region. Showing up to 30 results.
      </p>
      <ul>
        @for (group of workspace.model.view().regions; track group.region) {
        <li>{{ group.region }}: {{ group.count }}</li>
        }
      </ul>
      <table>
        <caption>
          Accepted service records
        </caption>
        <thead>
          <tr>
            <th>Job</th>
            <th>Driver</th>
            <th>Route</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          @for (row of workspace.model.view().rows.slice(0, 30); track row.id) {
          <tr>
            <td>{{ row.id }}</td>
            <td>{{ row.driver }}</td>
            <td>{{ row.route }}</td>
            <td>{{ row.status }}</td>
          </tr>
          }
        </tbody>
      </table>
    </section>
    }
  </main>`,
})
export class App implements OnDestroy {
  readonly arm = ARM;
  readonly workspace = new Workspace(1000);
  readonly ready = signal(false);
  readonly message = signal('Loading accepted data.');
  readonly saving = signal<ReadonlySet<number>>(new Set());
  constructor() {
    this.workspace.ready.then(() => {
      this.ready.set(true);
      this.message.set('Ready. Open two editors to try independent work.');
    });
    window.adoptionLab = { Workspace, functionalChecks, arm: ARM };
  }
  open(): void {
    this.workspace.open();
  }
  async save(key: number): Promise<void> {
    if (this.saving().has(key)) return;
    this.saving.update((keys) => new Set([...keys, key]));
    this.message.set('Waiting for the service result.');
    try {
      const receipt = await this.workspace.save(key);
      this.message.set(
        `Service result: ${receipt.status}${
          receipt.reason ? ' — ' + receipt.reason : ''
        }.`
      );
    } catch (error) {
      this.message.set(
        `Save was not completed: ${
          error instanceof Error ? error.message : String(error)
        }.`
      );
    } finally {
      this.saving.update(
        (keys) => new Set([...keys].filter((value) => value !== key))
      );
    }
  }
  ngOnDestroy(): void {
    void this.workspace.destroy();
  }
}
declare global {
  interface Window {
    adoptionLab: {
      Workspace: typeof Workspace;
      functionalChecks: typeof functionalChecks;
      arm: string;
    };
  }
}
