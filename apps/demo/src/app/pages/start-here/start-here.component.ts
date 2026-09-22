import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-start-here',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './start-here.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './start-here.component.scss',
})
export class StartHereComponent {
  readonly firstFeatureCode = `import { inject } from '@angular/core';
import { defineStore, signalTree } from '@signal-tree/angular';

export const OrdersStore = defineStore(() => signalTree({
  order: { customer: 'Ada', priority: 'Standard' },
}));

// Add OrdersStore to your feature component's providers.
// In that component's injection context:
const orders = inject(OrdersStore);
orders.$.order.priority(); // 'Standard'
orders.$.order.priority.set('Rush');
// The providing injector owns cleanup.`;

  readonly nextSteps = [
    {
      audience: 'Angular',
      title: 'Native signals and DI',
      description:
        'Install, provide an owned store, and expose state and operations.',
      route: '/docs',
      package: 'angular',
      cta: 'Angular setup →',
    },
    {
      audience: 'React',
      title: 'Observe selected state',
      description: 'Create an owner and subscribe through React hooks.',
      route: '/docs',
      package: 'react',
      cta: 'React setup →',
    },
    {
      audience: 'Vue',
      title: 'Native refs',
      description: 'Connect a tree to Vue and dispose it with its scope.',
      route: '/docs',
      package: 'vue',
      cta: 'Vue setup →',
    },
    {
      audience: 'TypeScript',
      title: 'Framework-neutral state',
      description: 'Use the kernel directly and own the tree lifetime.',
      route: '/docs',
      package: 'kernel',
      cta: 'TypeScript setup →',
    },
  ];
}
