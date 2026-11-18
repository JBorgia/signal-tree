import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FrameworkRealization {
  readonly id: string;
  readonly name: string;
  readonly realization: string;
  readonly primitive: string;
  readonly install: string;
  readonly read: string;
  readonly write: string;
}

/**
 * Choose the application facade before starting a feature. Historical residue
 * figures remain in Git/audit records; they do not describe this candidate's
 * application cost. Keep this page about current adoption and observable work.
 */
@Component({
  selector: 'app-frameworks',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './frameworks.component.html',
  styleUrl: './frameworks.component.scss',
})
export class FrameworksComponent {
  readonly shipping: readonly FrameworkRealization[] = [
    {
      id: 'angular',
      name: 'Angular',
      realization: 'Native Angular realization',
      primitive: 'signal() — callable, tracked, writable',
      install: '@signal-tree/angular — use the qualified v16 candidate',
      read: 'tree.$.count()',
      write: 'tree.$.count.set(1)',
    },
    {
      id: 'vue',
      name: 'Vue',
      realization: 'Native Vue realization',
      primitive: 'shallowRef with a reader',
      install: '@signal-tree/vue — use the qualified v16 candidate',
      read: 'tree.$.count.value',
      write: 'tree.$.count.value = 1',
    },
    {
      id: 'solid',
      name: 'Solid',
      realization: 'Native Solid realization',
      primitive: 'createSignal — tracked getter and setter',
      install: '@signal-tree/solid — use the qualified v16 candidate',
      read: 'tree.$.count()',
      write: 'tree.$.count.set(1)',
    },
    {
      id: 'react',
      name: 'React',
      realization: 'Portable / external-store realization',
      primitive: 'useSignalTree() selects a stable snapshot',
      install: '@signal-tree/react — use the qualified v16 candidate',
      read: 'tree.$.count()',
      write: 'tree.$.count(1)',
    },
  ];

  /** The same semantics, expressed in each framework's own idiom. */
  readonly semantics: readonly { name: string; detail: string }[] = [
    {
      name: 'Entity lifetime',
      detail:
        'A held record belongs to one entity lifetime. Removing it and adding a new record with the same ID does not redirect the old handle.',
    },
    {
      name: 'User edits and incoming truth',
      detail:
        'The application designates user edits and accepted external updates. Optional undo can preserve unrelated incoming changes.',
    },
    {
      name: 'Transactions and rollback',
      detail:
        'Transaction changes are visible immediately. A successful rollback compensates through existing handles; the application must handle a refusal according to the v16 pending-handle failure contract.',
    },
    {
      name: 'Restoration',
      detail:
        'Opt in to restoration when the workflow needs undo. Test overlap, incoming updates and recovery with the actual feature.',
    },
    {
      name: 'External truth',
      detail:
        'external() lands accepted results. link() maintains an endpoint relationship. Fetching, authorization and persistence stay in the application and backend.',
    },
  ];
}
