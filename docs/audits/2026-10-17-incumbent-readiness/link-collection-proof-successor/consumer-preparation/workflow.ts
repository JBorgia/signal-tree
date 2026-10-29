import { signalTree, entityMap, transactions, link, type PendingTransaction } from '@signal-tree/angular';

export interface WorkItem { id: string; title: string; status: string }
export type Edit =
  | { kind: 'update'; id: string; patch: Partial<Pick<WorkItem, 'title' | 'status'>> }
  | { kind: 'add'; item: WorkItem }
  | { kind: 'remove'; id: string }
  | { kind: 'rekey'; id: string; nextId: string }
  | { kind: 'order'; ids: string[] };
export interface RequestRecord { id: number; rows: WorkItem[]; state: 'sending' | 'acknowledged' | 'failed'; error?: string }

// Prepared public Angular facade consumer. NOT executed or qualified against an
// installed candidate. A component can bind rows/selection and call these actions.
export class OrderWorkflow {
  private readonly tree = signalTree({
    items: entityMap<WorkItem, string>({ selectId: item => item.id }),
    selectedId: '',
  }, { enhancers: [transactions()] });
  private readonly pending = new Map<string, PendingTransaction>();
  private readonly requests: RequestRecord[] = [];
  private readonly inFlight = new Set<AbortController>();
  private readonly connection;
  private closed = false;
  private requestId = 0;

  constructor(private readonly endpoint: string) {
    this.tree.$.items.setAll([
      { id: 'W1', title: 'Inspect scale', status: 'open' },
      { id: 'W2', title: 'Schedule truck', status: 'open' },
    ]);
    this.tree.$.selectedId.set('W1');
    this.connection = link(this.tree.$.items, { set: rows => this.send(rows) });
  }
  private active(): void { if (this.closed) throw new Error('workflow disposed'); }
  rows(): WorkItem[] { this.active(); return structuredClone(this.tree.$.items.all()); }
  selected(): WorkItem | undefined {
    this.active(); const row = this.tree.$.items.byId(this.tree.$.selectedId());
    return row ? structuredClone(row()) : undefined;
  }
  select(id: string): void {
    this.active();
    if (!this.tree.$.items.has(id)()) throw new Error('missing item');
    this.tree.$.selectedId.set(id);
  }
  requestLog(): RequestRecord[] { return structuredClone(this.requests); }
  propose(name: string, edits: readonly Edit[]): void {
    this.active(); if (this.pending.has(name)) throw new Error('proposal name already pending');
    const pending = this.tree.transact(() => {
      for (const edit of edits) {
        switch (edit.kind) {
          case 'update': this.tree.$.items.updateOne(edit.id, edit.patch); break;
          case 'add': this.tree.$.items.addOne(edit.item); break;
          case 'remove': this.tree.$.items.removeOne(edit.id); break;
          case 'rekey': this.tree.$.items.changeId(edit.id, edit.nextId); break;
          case 'order': {
            const rows = this.rows();
            if (edit.ids.length !== rows.length || new Set(edit.ids).size !== rows.length) throw new Error('order must contain each current id once');
            const ordered = edit.ids.map(id => {
              const row = rows.find(item => item.id === id);
              if (!row) throw new Error('order contains unknown id');
              return row;
            });
            this.tree.$.items.setAll(ordered); break;
          }
        }
      }
    });
    this.pending.set(name, pending);
  }
  inspect(name: string) { return this.owner(name).inspect(); }
  private owner(name: string): PendingTransaction {
    this.active(); const owner = this.pending.get(name);
    if (!owner) throw new Error('no pending proposal');
    return owner;
  }
  confirm(name: string): void { this.owner(name).confirm(); this.pending.delete(name); }
  reject(name: string): void { this.owner(name).rollback(); this.pending.delete(name); }
  // Do not substitute an ordinary write or separate tree for a declaration.
  declareIndependent(): never {
    throw new Error('BLOCKED: candidate public Link type does not expose declare');
  }
  retryFailed(): never {
    throw new Error('BLOCKED: public Link has no retry command; safe application retry/reconciliation policy remains unqualified');
  }
  async settled(): Promise<void> { await this.connection.settled(); }
  private async send(rows: WorkItem[]): Promise<void> {
    const request: RequestRecord = { id: ++this.requestId, rows: structuredClone(rows), state: 'sending' };
    this.requests.push(request);
    const controller = new AbortController(); this.inFlight.add(controller);
    try {
      const response = await fetch(this.endpoint, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rows), signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!this.closed) request.state = 'acknowledged';
    } catch (error) {
      if (!this.closed) { request.state = 'failed'; request.error = error instanceof Error ? error.message : String(error); }
      throw error;
    } finally { this.inFlight.delete(controller); }
  }
  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.connection.dispose();
    for (const controller of this.inFlight) controller.abort();
    this.inFlight.clear(); this.pending.clear(); this.tree.destroy();
  }
}
