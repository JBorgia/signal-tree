import { link, signalTree, transactions, type Link } from '@signal-tree/kernel';

export interface Ticket { id: string; title: string; assignee: string; status: string }
type Editable = 'title' | 'assignee';
const fields: readonly Editable[] = ['title', 'assignee'];
export interface Conflict { field: Editable; base: string; live: string; draft: string }
export interface Review { ticket: Ticket; conflicts: Conflict[] }
interface Session { id: number; edit: number; base: Ticket; draft: Ticket }
interface Approval { session: number; edit: number; liveRevision: number; live: Ticket; review: Review }
const clone = <T>(value: T): T => structuredClone(value);
const same = (a: Ticket, b: Ticket): boolean =>
  a.id === b.id && a.title === b.title && a.assignee === b.assignee && a.status === b.status;

// Application policy; deliberately owns no proposal provenance or generic merge API.
export class TicketEditor {
  private readonly tree;
  private readonly connection: Link;
  private session: Session | undefined;
  private approval: Approval | undefined;
  private nextSession = 0;
  private liveRevision = 0;
  private closed = false;

  constructor(initial: Ticket, endpoint: (ticket: Ticket) => void | Promise<void>) {
    this.tree = signalTree(clone(initial), { enhancers: [transactions()] });
    this.connection = link(this.tree.$, { set: endpoint });
  }
  private active(): void { if (this.closed) throw new Error('editor destroyed'); }
  private editing(): Session {
    this.active();
    if (!this.session) throw new Error('no draft');
    return this.session;
  }
  live(): Ticket { this.active(); return clone(this.tree.$()); }
  draft(): Ticket { return clone(this.editing().draft); }
  open(): void {
    this.active();
    if (this.session) throw new Error('draft already open');
    const base = this.live();
    this.session = { id: ++this.nextSession, edit: 0, base, draft: clone(base) };
    this.approval = undefined;
  }
  edit(field: Editable, value: string): void {
    const session = this.editing();
    session.draft[field] = value;
    session.edit++;
    this.approval = undefined;
  }
  // Models a separate accepted local actor, not an untrusted remote conflict protocol.
  liveEdit(field: 'title' | 'status', value: string): void {
    this.active();
    if (this.tree.$[field]() !== value) this.liveRevision++;
    this.tree.$[field](value);
  }
  review(): Review {
    const session = this.editing();
    const live = this.live();
    const ticket = clone(live);
    const conflicts: Conflict[] = [];
    for (const field of fields) {
      if (session.draft[field] === session.base[field]) continue;
      if (live[field] !== session.base[field] && live[field] !== session.draft[field]) {
        conflicts.push({ field, base: session.base[field], live: live[field], draft: session.draft[field] });
      }
      ticket[field] = session.draft[field];
    }
    const review = { ticket, conflicts };
    this.approval = { session: session.id, edit: session.edit, liveRevision: this.liveRevision, live, review: clone(review) };
    return clone(review);
  }
  resolve(field: Editable, choice: 'draft' | 'live'): void {
    const session = this.editing();
    const conflict = this.review().conflicts.find(item => item.field === field);
    if (!conflict) throw new Error('field has no conflict');
    session.base[field] = conflict.live;
    if (choice === 'live') session.draft[field] = conflict.live;
    session.edit++;
    this.approval = undefined;
  }
  accept(): void {
    const session = this.editing();
    const approval = this.approval;
    if (!approval || approval.session !== session.id || approval.edit !== session.edit || approval.liveRevision !== this.liveRevision || !same(approval.live, this.live())) {
      throw new Error('review required');
    }
    if (approval.review.conflicts.length) throw new Error('resolve conflicts');
    const accepted = approval.review.ticket;
    const transaction = this.tree.transact(() => {
      this.tree.$.title(accepted.title);
      this.tree.$.assignee(accepted.assignee);
    });
    transaction.confirm();
    this.session = undefined;
    this.approval = undefined;
  }
  reject(): void { this.editing(); this.session = undefined; this.approval = undefined; }
  async suggestTitle(work: Promise<string>): Promise<'applied' | 'stale'> {
    const session = this.editing();
    const id = session.id;
    const edit = session.edit;
    const title = await work;
    if (this.closed || this.session?.id !== id || this.session.edit !== edit) return 'stale';
    this.edit('title', title);
    return 'applied';
  }
  async settled(): Promise<void> { await this.connection.settled(); }
  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.session = undefined;
    this.approval = undefined;
    this.connection.dispose();
    this.tree.destroy();
  }
}
