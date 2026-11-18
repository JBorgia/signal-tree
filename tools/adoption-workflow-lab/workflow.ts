import { signal } from '@angular/core';
import { createReadModel } from './selected-read';
import { createEditor } from './selected-editor';
import {
  check,
  domainJob,
  seed,
  settle,
  type Editor,
  type Job,
  type Route,
} from './model';

export interface EditorRecord {
  key: number;
  jobId: number;
  instance: number;
  expectedRevision: number;
  editor: Editor;
  outcome: string;
  generation: number;
}
interface Receipt {
  command: string;
  status: 'applied' | 'rejected';
  reason: string;
}

/** Synthetic application authority. This map/receipt cache is NOT durable storage. */
export class Workspace {
  readonly model;
  readonly editors = signal<EditorRecord[]>([]);
  readonly message = signal(
    'Choose a job to open an independently owned editor.'
  );
  readonly ready: Promise<void>;
  private readonly server: Map<number, Job>;
  private readonly receipts = new Map<
    string,
    { editorKey: number; generation: number; receipt: Receipt }
  >();
  private readonly inFlight = new Set<number>();
  private nextEditor = 0;
  private nextCommand = 0;
  private live = true;
  effects = 0;

  constructor(readonly size: number) {
    const data = seed(size);
    this.server = new Map(data.jobs.map((row) => [row.id, { ...row }]));
    this.model = createReadModel(data.jobs, data.drivers);
    this.ready = this.model.ready;
  }
  private owned(key: number): EditorRecord {
    check(this.live, 'disposed-workspace');
    const entry = this.editors().find((item) => item.key === key);
    check(entry, 'missing-editor');
    return entry;
  }
  private publish(id: number, replacement = false): void {
    check(this.live, 'disposed-workspace');
    const value = this.server.get(id);
    check(value, 'missing-server-job');
    if (replacement) this.model.replaceJob(domainJob(value));
    else this.model.updateJob(id, domainJob(value));
    for (const entry of this.editors()) {
      if (entry.jobId !== id) continue;
      if (entry.instance !== value.instance)
        entry.outcome = 'Record replaced; reopen before saving.';
      else {
        entry.editor.receive(value);
        if (!entry.editor.pending()) entry.expectedRevision = value.revision;
      }
    }
    this.editors.update((entries) => [...entries]);
  }
  open(id = 0): number {
    check(this.live, 'disposed-workspace');
    const value = this.model.job(id);
    check(value, 'missing-job');
    const key = ++this.nextEditor;
    this.editors.update((entries) => [
      ...entries,
      {
        key,
        jobId: id,
        instance: value.instance,
        expectedRevision: value.revision,
        editor: createEditor(value),
        outcome: 'Ready to propose a route.',
        generation: 0,
      },
    ]);
    return key;
  }
  propose(key: number, route: Route = 'West'): void {
    const entry = this.owned(key);
    check(!this.inFlight.has(key), 'save-already-in-flight');
    entry.editor.propose(route);
    entry.generation++;
    entry.outcome = 'Proposed locally; not yet accepted by the service.';
    this.editors.update((entries) => [...entries]);
  }
  reject(key: number): void {
    const entry = this.owned(key);
    check(!this.inFlight.has(key), 'save-already-in-flight');
    entry.editor.rollback();
    this.refresh(entry);
    entry.outcome = 'Proposal discarded; incoming shipment updates remain.';
    this.editors.update((entries) => [...entries]);
  }
  ship(id = 0): void {
    const value = this.server.get(id);
    check(value, 'missing-server-job');
    // Route revision is field-specific: an unrelated status update must not
    // manufacture a route conflict. A real service owns this policy.
    this.server.set(id, { ...value, status: 'Shipped' });
    this.publish(id);
  }
  externalRoute(id = 0, route: Route = 'East'): void {
    const value = this.server.get(id);
    check(value, 'missing-server-job');
    this.server.set(id, { ...value, route, revision: value.revision + 1 });
    this.publish(id);
  }
  ingestJobs(changes: { id: number; changes: Partial<Job> }[]): void {
    check(this.live, 'disposed-workspace');
    for (const change of changes) {
      const current = this.server.get(change.id);
      check(current, 'missing-server-job');
      this.server.set(change.id, { ...current, ...change.changes });
    }
    this.model.updateJobs(changes);
    for (const entry of this.editors()) {
      const current = this.server.get(entry.jobId);
      if (current?.instance === entry.instance) {
        entry.editor.receive(current);
        if (!entry.editor.pending()) entry.expectedRevision = current.revision;
      }
    }
  }
  ingestJob(id: number, changes: Partial<Job>): void {
    const current = this.server.get(id);
    check(current, 'missing-server-job');
    this.server.set(id, { ...current, ...changes });
    this.publish(id);
  }
  replace(id = 0): void {
    const value = this.server.get(id);
    check(value, 'missing-server-job');
    this.server.set(id, {
      ...value,
      instance: value.instance + 1,
      route: 'North',
      revision: 0,
    });
    this.publish(id, true);
  }
  async save(
    key: number,
    command = `command-${++this.nextCommand}`,
    reject = false,
    loseReply = false
  ): Promise<Receipt> {
    const entry = this.owned(key);
    check(!this.inFlight.has(key), 'save-already-in-flight');
    const prior = this.receipts.get(command);
    if (prior) {
      check(prior.editorKey === key, 'command-belongs-to-another-editor');
      check(
        prior.generation === entry.generation,
        'command-belongs-to-another-proposal'
      );
      const receipt = prior.receipt;
      if (entry.editor.pending()) {
        if (receipt.status === 'applied') entry.editor.confirm();
        else entry.editor.rollback();
      }
      this.refresh(entry);
      entry.outcome = `Reconciled ${receipt.status} receipt.`;
      this.editors.update((entries) => [...entries]);
      return receipt;
    }
    check(entry.editor.pending(), 'save-requires-pending');
    const proposal = entry.editor.read();
    const generation = entry.generation;
    this.inFlight.add(key);
    try {
      await Promise.resolve();
      check(this.live, 'disposed-workspace');
      check(this.editors().includes(entry), 'closed-editor');
      check(
        entry.generation === generation && entry.editor.pending(),
        'proposal-changed-during-save'
      );
      const current = this.server.get(entry.jobId);
      let reason = reject ? 'service-rejection' : '';
      if (!current || current.instance !== entry.instance)
        reason = 'entity-lifetime';
      else if (current.revision !== entry.expectedRevision)
        reason = 'route-revision';
      const receipt: Receipt = {
        command,
        status: reason ? 'rejected' : 'applied',
        reason,
      };
      if (!reason && current) {
        this.server.set(current.id, {
          ...current,
          route: proposal.route,
          revision: current.revision + 1,
        });
        this.effects++;
        this.publish(current.id);
      }
      this.receipts.set(command, { editorKey: key, generation, receipt });
      if (loseReply) {
        entry.outcome =
          'Response uncertain; reconcile the same command before retrying.';
        this.editors.update((entries) => [...entries]);
        return { ...receipt, reason: 'reply-lost' };
      }
      if (reason) entry.editor.rollback();
      else entry.editor.confirm();
      this.refresh(entry);
      entry.outcome = reason
        ? `Rejected: ${reason}. Reopen from current data.`
        : 'Service accepted the route.';
      this.editors.update((entries) => [...entries]);
      return receipt;
    } finally {
      this.inFlight.delete(key);
    }
  }
  private refresh(entry: EditorRecord): void {
    const accepted = this.server.get(entry.jobId);
    if (accepted?.instance === entry.instance) {
      entry.editor.receive(accepted);
      entry.expectedRevision = accepted.revision;
    }
  }
  close(key: number): void {
    const entry = this.owned(key);
    entry.editor.destroy();
    this.editors.update((entries) =>
      entries.filter((item) => item.key !== key)
    );
  }
  async destroy(): Promise<void> {
    if (!this.live) return;
    this.editors().forEach((entry) => entry.editor.destroy());
    this.editors.set([]);
    this.live = false;
    await this.model.destroy();
    this.server.clear();
    this.receipts.clear();
  }
  async read(): Promise<ReturnType<typeof this.model.view>> {
    await this.ready;
    await settle();
    return this.model.view();
  }
}
