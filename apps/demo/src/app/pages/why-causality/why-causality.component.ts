import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

interface CausalScenario {
  readonly id: 'authority' | 'atomicity' | 'identity';
  readonly label: string;
  readonly snapshot: string;
  readonly situation: string;
  readonly outcome: string;
  readonly boundary: string;
  readonly route: string;
  readonly action: string;
}

@Component({
  selector: 'app-why-causality',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './why-causality.component.html',
  styleUrl: './why-causality.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhyCausalityComponent {
  readonly scenarios: readonly CausalScenario[] = [
    {
      id: 'authority',
      label: 'Undo an edit',
      snapshot: 'priority: Rush → Standard · status: Shipped',
      situation:
        'You mark an order Rush. A server update then changes its shipping status. You want to undo your edit.',
      outcome:
        'Designate the priority edit with undoable(). Classify the server update with external(). Undo can restore the priority while keeping the unrelated shipping update.',
      boundary:
        'Restoration is optional. If newer external truth conflicts with the field being restored, undo can refuse instead of overwriting it.',
      route: '/restoration',
      action: 'Try restoration',
    },
    {
      id: 'atomicity',
      label: 'Group changes',
      snapshot: 'available: 10 → 8 · reserved: 0 → 2',
      situation:
        'Reserving two items changes available stock and the reservation together. Readers need a consistent result.',
      outcome:
        'Use a transaction to group the related changes. Framework observers receive the settled result across the affected locations.',
      boundary:
        'This coordinates application state. Database transactions, payment processing, and remote side effects remain application responsibilities.',
      route: '/examples/fundamentals',
      action: 'Try transactions',
    },
    {
      id: 'identity',
      label: 'Keep a record',
      snapshot: 'temporary ID → server ID · same held record',
      situation:
        'A newly created record receives its permanent server ID while an editor still holds a reference to it.',
      outcome:
        'EntityMap changeId() preserves the record’s identity. The held byId() handle continues to refer to that record after the key changes.',
      boundary:
        'Rekeying an existing record differs from removing it and inserting a new record. Equal values alone do not establish continuity.',
      route: '/entities',
      action: 'Try entity collections',
    },
  ];

  readonly selectedScenarioId = signal<CausalScenario['id']>('authority');
  readonly selectedScenario = computed(
    () =>
      this.scenarios.find(({ id }) => id === this.selectedScenarioId()) ??
      this.scenarios[0]
  );

  selectScenario(id: CausalScenario['id']): void {
    this.selectedScenarioId.set(id);
  }
}
