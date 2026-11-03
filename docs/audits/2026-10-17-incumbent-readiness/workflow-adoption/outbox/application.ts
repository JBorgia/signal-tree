import { signalTree, transactions, type PendingTransaction } from '@signal-tree/kernel';
import { activeTransactionContext, transactionLifecycleReader } from '@signal-tree/kernel/internals';

export type Command =
  | { kind: 'dispatch'; shipment: string; truck: string; dock: number }
  | { kind: 'audit'; shipment: string; note: string };
type OwnerState = 'pending' | 'confirmed' | 'rejected' | 'unknown';
export interface Owner { readonly id: number; readonly handle: PendingTransaction; state: OwnerState }
export type Disposition = 'queued' | 'sending' | 'sent' | 'uncertain' | 'cancelled' | 'superseded' | 'abandoned';
export interface Entry { readonly id: string; readonly command: Readonly<Command>; readonly owners: readonly Owner[]; status: Disposition; attempts: number; error?: unknown }

// Research application service. Owner declarations are assertions, not provenance.
export class DispatchService {
  readonly tree = signalTree({ shipment: 'S-104', truck: 'T-1', dock: 1 }, { enhancers: [transactions()] });
  private readonly lifecycle = transactionLifecycleReader(this.tree)!;
  private readonly owners = new Map<number, Owner>();
  private opening = false;
  private closed = false;
  private worker: Promise<void> | undefined;
  readonly entries = new Map<string, Entry>();
  private readonly stop = this.lifecycle.subscribe(event => {
    const owner = this.owners.get(event.transactionId);
    if (owner && event.kind === 'confirmed') owner.state = 'confirmed';
    if (owner && event.kind === 'rolled-back') owner.state = 'rejected';
  });
  constructor(private readonly endpoint: (command: Readonly<Command>, id: string) => Promise<void>) {}
  begin(write: () => void): Owner {
    if (this.closed || this.opening) throw new Error('closed or reentrant begin');
    this.opening = true;
    let id: number | undefined;
    try {
      const handle = this.tree.transact(() => {
        id = activeTransactionContext()?.id;
        if (id === undefined) throw new Error('missing transaction context');
        write();
      });
      const owner: Owner = { id: id!, handle, state: 'pending' };
      this.owners.set(owner.id, owner);
      return owner;
    } finally { this.opening = false; }
  }

  settle(owner: Owner, action: 'confirm' | 'rollback'): void {
    if (this.closed || this.owners.get(owner.id) !== owner) throw new Error('invalid owner');
    try { owner.handle[action](); }
    finally {
      const pending = this.lifecycle.snapshot().pending.some(p => p.transactionId === owner.id);
      if (pending) owner.state = 'pending';
      else if (owner.state === 'pending') owner.state = 'unknown';
    }
  }
  enqueue(id: string, command: Command, owners: readonly Owner[]): Entry {
    if (this.closed || this.entries.has(id)) throw new Error('closed or duplicate command');
    if (owners.some(owner => this.owners.get(owner.id) !== owner)) throw new Error('foreign owner');
    const entry: Entry = { id, command: Object.freeze(structuredClone(command)), owners: [...owners], status: 'queued', attempts: 0 };
    this.entries.set(id, entry);
    return entry;
  }
  supersede(id: string): void {
    const entry = this.entries.get(id);
    if (!entry || entry.status !== 'queued') throw new Error('only unsent queued command can be superseded');
    entry.status = 'superseded';
  }
  retry(id: string): void {
    const entry = this.entries.get(id);
    if (this.closed || !entry || entry.status !== 'uncertain') throw new Error('retry unavailable');
    // Explicit authorization may duplicate a command applied before its ack failed.
    entry.status = 'queued';
  }
  drain(): Promise<void> {
    if (this.worker) return this.worker;
    if (this.closed) return Promise.resolve();
    // Defer work until worker is assigned, including reentrant endpoint callers.
    const work = Promise.resolve().then(() => this.run());
    this.worker = work.finally(() => { this.worker = undefined; });
    return this.worker;
  }
  private async run(): Promise<void> {
    for (const entry of this.entries.values()) {
      if (this.closed) return;
      if (entry.status !== 'queued') continue;
      if (entry.owners.some(owner => owner.state === 'rejected')) { entry.status = 'cancelled'; continue; }
      if (entry.owners.some(owner => owner.state !== 'confirmed')) continue;
      entry.status = 'sending'; entry.attempts++;
      try {
        await this.endpoint(entry.command, entry.id);
        if (!this.closed) entry.status = 'sent';
      } catch (error) { entry.error = error; entry.status = 'uncertain'; }
    }
  }
  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    for (const entry of this.entries.values()) {
      if (entry.status === 'queued') entry.status = 'abandoned';
      if (entry.status === 'sending') entry.status = 'uncertain';
    }
    this.stop(); this.tree.destroy(); this.owners.clear();
  }
}
