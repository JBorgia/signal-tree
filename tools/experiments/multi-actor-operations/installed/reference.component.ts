import { Component, computed, signal, type OnDestroy } from '@angular/core';
import { external, link, signalTree, transactions, type PendingTransaction, type PublicationReceipt } from '@signal-tree/angular';

@Component({
  selector: 'operation-reference',
  standalone: true,
  template: `
    <h1>Dispatch review</h1>
    <p>Route: {{ tree.$.route() }}</p>
    <p>Capacity: {{ tree.$.capacity() }}</p>
    <p>{{ summary() }}</p>
    <button (click)="proposeWest()">Propose west</button>
    <button (click)="confirm()">Confirm locally</button>
    <button (click)="reject()">Reject locally</button>
    <button (click)="publishIndependentNote()">Publish independent note</button>
    <p>Note admission: {{ noteAdmission() }}</p>
    <p>Last in-memory endpoint value: {{ publishedNotes().at(-1) ?? 'none' }}</p>
  `,
})
export class ReferenceComponent implements OnDestroy {
  readonly tree = signalTree({ route: 'north', capacity: 10, note: '' }, { enhancers: [transactions()] });
  readonly summary = computed(() => `${this.tree.$.route()}:${this.tree.$.capacity()}`);
  readonly publishedNotes = signal<readonly string[]>([]);
  private readonly noteConnection = link(this.tree.$.note, {
    set: value => this.publishedNotes.update(values => [...values, value]),
  });
  private noteReceipt: PublicationReceipt | undefined;
  private pending: PendingTransaction | undefined;
  proposeWest(): void {
    if (this.pending) throw new Error('Settle current proposal first');
    this.pending = this.tree.transact(() => this.tree.$.route.set('west'));
  }
  confirm(): void { this.pending?.confirm(); this.pending = undefined; }
  reject(): void { this.pending?.rollback(); this.pending = undefined; }
  ingestCapacity(value: number): void { external(() => this.tree.$.capacity.set(value)); }
  async publishIndependentNote(): Promise<void> {
    // This authored literal consumes no proposal value. A saved value or cached
    // computation would require its own complete dependency declaration.
    this.noteReceipt = this.noteConnection.declare({ kind: 'independent' }, () => {
      this.tree.$.note.set('dispatch-ready');
    });
    await this.noteConnection.settled();
  }
  // Receipts are readable snapshots, not signals or delivery acknowledgments.
  noteAdmission(): string { return this.noteReceipt?.read().state ?? 'none'; }
  ngOnDestroy(): void { this.noteConnection.dispose(); this.tree.destroy(); }
}
