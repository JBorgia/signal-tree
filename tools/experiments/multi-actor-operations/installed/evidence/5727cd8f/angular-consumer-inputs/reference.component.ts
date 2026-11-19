import { Component, computed, type OnDestroy } from '@angular/core';
import { external, signalTree, transactions, type PendingTransaction } from '@signal-tree/angular';

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
  `,
})
export class ReferenceComponent implements OnDestroy {
  readonly tree = signalTree({ route: 'north', capacity: 10, note: '' }, { enhancers: [transactions()] });
  readonly summary = computed(() => `${this.tree.$.route()}:${this.tree.$.capacity()}`);
  private pending: PendingTransaction | undefined;
  proposeWest(): void {
    if (this.pending) throw new Error('Settle current proposal first');
    this.pending = this.tree.transact(() => this.tree.$.route.set('west'));
  }
  confirm(): void { this.pending?.confirm(); this.pending = undefined; }
  reject(): void { this.pending?.rollback(); this.pending = undefined; }
  ingestCapacity(value: number): void { external(() => this.tree.$.capacity.set(value)); }
  ngOnDestroy(): void { this.tree.destroy(); }
}
