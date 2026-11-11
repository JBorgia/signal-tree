import {
  initialCapacity,
  type Capacity,
  type Command,
  type Decision,
  type DispatchJob,
  type DispatchTransport,
  type PublicationPayload,
} from './dispatch-model';

// Deterministic test service. It is shared external infrastructure, not an app
// coordinator. Arrival, server application, reply delivery and publication ack
// are distinct driver actions. No oracle expectation is supplied to the app.
export class DispatchBackend implements DispatchTransport {
  private readonly jobs = new Map<string, DispatchJob>();
  private panel: Capacity = initialCapacity();
  private readonly decisions = new Map<
    string,
    { command: Command; decision: Decision }
  >();
  private readonly attempts: {
    command: Command;
    reached: boolean;
    resolve?: (decision: Decision) => void;
    reject?: (error: Error) => void;
    delivered: boolean;
  }[] = [];
  private readonly acknowledgements = new Map<string, () => void>();
  readonly requests: Command[] = [];
  readonly applications: Command[] = [];
  readonly starts: { id: string; payload: PublicationPayload }[] = [];
  readonly publicationAttempts: string[] = [];
  readonly acknowledged: string[] = [];
  onPublish: ((id: string, payload: PublicationPayload) => void) | undefined;

  constructor(rows: readonly DispatchJob[]) {
    for (const row of rows) this.jobs.set(row.id, { ...row });
  }
  send(command: Command): Promise<Decision> {
    const copy = structuredClone(command);
    this.requests.push(copy);
    return new Promise((resolve, reject) => {
      this.attempts.push({
        command: copy,
        reached: false,
        resolve,
        reject,
        delivered: false,
      });
    });
  }
  // Apply once without necessarily delivering the response. A retry of the same
  // command returns the original decision, including its original revision.
  process(id: string, verdict: 'accept' | 'reject' = 'accept'): Decision {
    const attempt = this.attempts.find(
      (item) => item.command.id === id && !item.reached
    );
    if (!attempt) throw new Error(`No unprocessed attempt: ${id}`);
    attempt.reached = true;
    const command = attempt.command;
    const previous = this.decisions.get(id);
    if (previous) {
      if (
        (
          [
            'id',
            'subject',
            'instance',
            'field',
            'value',
            'expectedRevision',
          ] as const
        ).some((field) => previous.command[field] !== command[field])
      ) {
        attempt.delivered = true;
        attempt.reject?.(
          new Error('Idempotency key reused with a different command')
        );
        attempt.resolve = undefined;
        attempt.reject = undefined;
        throw new Error('Idempotency key reused with a different command');
      }
      return structuredClone(previous.decision);
    }
    const row = this.jobs.get(command.subject);
    const capacity = command.field === 'capacity';
    const instance = capacity ? this.panel.instance : row?.instance;
    const revision = capacity
      ? this.panel.revision
      : command.field === 'owner'
      ? row?.ownerRevision
      : row?.statusRevision;
    const value = capacity
      ? this.panel.value
      : command.field === 'owner'
      ? row?.owner
      : row?.status;
    if (instance === undefined || revision === undefined || value === undefined)
      throw new Error('Missing server subject');
    const outcome =
      verdict === 'reject'
        ? 'rejected'
        : instance !== command.instance || revision !== command.expectedRevision
        ? 'conflict'
        : 'applied';
    if (outcome === 'applied') {
      if (capacity) {
        if (typeof command.value !== 'number')
          throw new Error('Capacity must be numeric');
        this.panel = {
          ...this.panel,
          value: command.value,
          revision: revision + 1,
        };
      } else if (command.field === 'owner') {
        if (typeof command.value !== 'string' || !row)
          throw new Error('Invalid owner');
        this.jobs.set(command.subject, {
          ...row,
          owner: command.value,
          ownerRevision: revision + 1,
        });
      } else {
        if (
          !row ||
          !['queued', 'active', 'done'].includes(String(command.value))
        )
          throw new Error('Invalid status');
        this.jobs.set(command.subject, {
          ...row,
          status: command.value as DispatchJob['status'],
          statusRevision: revision + 1,
        });
      }
      this.applications.push(structuredClone(command));
    }
    const decision: Decision = {
      commandId: id,
      instance,
      field: command.field,
      outcome,
      value: outcome === 'applied' ? command.value : value,
      revision: revision + (outcome === 'applied' ? 1 : 0),
    };
    this.decisions.set(id, { command: structuredClone(command), decision });
    return structuredClone(decision);
  }
  deliver(id: string): void {
    const attempt = this.attempts.find(
      (item) => item.command.id === id && item.reached && !item.delivered
    );
    const stored = this.decisions.get(id);
    if (!attempt || !stored) throw new Error(`No processed reply: ${id}`);
    attempt.delivered = true;
    attempt.resolve?.(structuredClone(stored.decision));
    attempt.resolve = undefined;
    attempt.reject = undefined;
  }
  // Discard one transport attempt without claiming a server outcome. This can
  // model a lost reply after process(), or a request that never arrived.
  lose(id: string): void {
    const attempt = this.attempts.find(
      (item) => item.command.id === id && !item.delivered
    );
    if (!attempt) throw new Error(`No attempt to lose: ${id}`);
    attempt.delivered = true;
    attempt.reached = true;
    attempt.resolve = undefined;
    attempt.reject = undefined;
  }
  publish(id: string, payload: PublicationPayload): Promise<void> {
    this.publicationAttempts.push(id);
    if (this.starts.some((item) => item.id === id))
      throw new Error('Duplicate publication intent');
    const copy = structuredClone(payload);
    this.starts.push({ id, payload: copy });
    const promise = new Promise<void>((resolve) =>
      this.acknowledgements.set(id, resolve)
    );
    this.onPublish?.(id, structuredClone(copy));
    return promise;
  }
  acknowledge(id: string): void {
    const resolve = this.acknowledgements.get(id);
    if (!resolve) throw new Error('Missing publication acknowledgement');
    this.acknowledgements.delete(id);
    this.acknowledged.push(id);
    resolve();
  }
  replace(id: string, row: DispatchJob): void {
    if (row.id !== id) throw new Error('Replacement ID mismatch');
    this.jobs.delete(id);
    this.jobs.set(id, structuredClone(row));
  }
  row(id: string): DispatchJob | undefined {
    const row = this.jobs.get(id);
    return row && structuredClone(row);
  }
  capacity(): Capacity {
    return { ...this.panel };
  }
}
