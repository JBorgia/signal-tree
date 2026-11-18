import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { defineStore, external, undoable } from '@signal-tree/angular';

import {
  CodeTabsComponent,
  type CodeFile,
} from '../../examples/shared/components/example-shell';
import { createOrderEditTree } from './order-edit-recipe';

const DemoOrders = defineStore(createOrderEditTree);

type Perspective = 'user' | 'developer' | 'business';
interface StoryEvent {
  actor: string;
  result: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CodeTabsComponent],
  providers: [DemoOrders],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly tree = inject(DemoOrders);
  private readonly destroyRef = inject(DestroyRef);
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  readonly orders = [
    this.tree.$.orders.byIdOrFail(101),
    this.tree.$.orders.byIdOrFail(102),
  ];
  // Instrument actual memoized readers, not DOM renders or synthetic counters.
  readonly priorityReaders = this.orders.map((order) => {
    let runs = 0;
    return computed(() => ({ value: order.priority(), runs: ++runs }));
  });
  readonly canUndo = signal(false);
  readonly message = signal('Try order 101. Order 102 stays unchanged.');
  readonly perspective = signal<Perspective>('user');
  readonly storyEvents = signal<readonly StoryEvent[]>([]);
  readonly perspectives: readonly { id: Perspective; label: string }[] = [
    { id: 'user', label: 'I use the app' },
    { id: 'developer', label: 'I build the app' },
    { id: 'business', label: 'I choose the product' },
  ];

  readonly packages = [
    {
      label: 'Angular',
      id: 'angular',
      command: 'npm install @signal-tree/angular@15',
    },
    {
      label: 'React',
      id: 'react',
      command: 'npm install @signal-tree/react@15',
    },
    { label: 'Vue', id: 'vue', command: 'npm install @signal-tree/vue@15' },
    {
      label: 'TypeScript',
      id: 'kernel',
      command: 'npm install @signal-tree/kernel@15',
    },
  ] as const;
  readonly selectedPackage = signal(
    this.packages[0] as (typeof this.packages)[number]
  );

  readonly example: CodeFile[] = [
    {
      label: 'Update a field',
      language: 'typescript',
      source: `// Angular · live example
const order = tree.$.orders.byIdOrFail(101);

order.priority(); // 'Standard'
order.priority.set('Rush');
order.priority(); // 'Rush'

// The other order stays Standard.
tree.$.orders.byIdOrFail(102).priority();`,
    },
    {
      label: 'Keep server updates',
      language: 'typescript',
      source: `// Optional: construct with enhancers: [restoration()].
// Import these APIs from '@signal-tree/angular'.

// User action: designate this edit for undo.
undoable(() => order.priority.set('Rush'));

// Later, a server response arrives.
external(() => order.status.set('Shipped'));

// On the next user action:
tree.undo();
// Priority: Standard. Server status: still Shipped.`,
    },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.refreshTimer));
  }

  prioritize(): void {
    undoable(() => this.orders[0].priority.set('Rush'));
    this.message.set('Order 101 is Rush. Order 102 stays Standard.');
    this.record('You', 'Made order 101 Rush. The other order stayed Standard.');
    this.refreshUndo();
  }

  receiveUpdate(): void {
    external(() => this.orders[0].status.set('Shipped'));
    this.message.set('Simulated server update: order 101 is Shipped.');
    this.record(
      'Shipping service',
      'Reported order 101 Shipped. Priority stayed as it was.'
    );
    this.refreshUndo();
  }

  undo(): void {
    this.tree.undo();
    this.message.set(
      `Priority restored. Order 101 is still ${this.orders[0].status()}.`
    );
    this.record(
      'You, undoing your edit',
      `Restored Standard priority. Shipping status stayed ${this.orders[0].status()}.`
    );
    this.refreshUndo();
  }

  reset(): void {
    external(() => {
      this.orders[0].priority.set('Standard');
      this.orders[0].status.set('Packing');
    });
    this.tree.resetRestorationHistory();
    this.canUndo.set(false);
    this.message.set('Try order 101. Order 102 stays unchanged.');
    this.storyEvents.set([]);
    this.refreshUndo();
  }

  private record(actor: string, result: string): void {
    // A bounded explanation of this local demonstration, not a durable audit log.
    this.storyEvents.update((events) => [
      ...events.slice(-5),
      { actor, result },
    ]);
  }

  private refreshUndo(): void {
    // Designated turns settle after the event; do not read the previous history.
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(
      () => this.canUndo.set(this.tree.canUndo()),
      0
    );
  }
}
