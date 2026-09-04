import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { signalTree } from '@signal-tree/angular';

interface NextConcept {
  readonly index: string;
  readonly title: string;
  readonly description: string;
  readonly route: string;
}

@Component({
  selector: 'app-fundamentals-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './fundamentals-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './fundamentals-page.component.scss',
})
export class FundamentalsPageComponent implements OnDestroy {
  readonly tree = signalTree(
    {
      cart: {
        itemCount: 2,
        unitPrice: 24,
      },
      customer: {
        name: 'Ada',
      },
    },
    {
      derived: ($) => ({
        subtotal: () => $.cart.itemCount() * $.cart.unitPrice(),
        summary: () => `${$.customer.name()} · ${$.cart.itemCount()} items`,
      }),
    }
  );

  readonly nextConcepts: readonly NextConcept[] = [
    {
      index: '05',
      title: 'Coherent operations',
      description: 'Group framework publication across related writes.',
      route: '/batching',
    },
    {
      index: '06',
      title: 'Identity & EntityMap',
      description: 'Keep keyed entity facts under one collection authority.',
      route: '/entities',
    },
    {
      index: '07',
      title: 'Restoration',
      description: 'Designate authored operations for reversible retention.',
      route: '/restoration',
    },
    {
      index: '08',
      title: 'External truth & Link',
      description: 'Separate outside authority from application orchestration.',
      route: '/external-truth',
    },
  ];

  addItem(): void {
    this.tree.$.cart.itemCount((count) => count + 1);
  }

  removeItem(): void {
    this.tree.$.cart.itemCount((count) => Math.max(0, count - 1));
  }

  setUnitPrice(value: number): void {
    if (Number.isFinite(value) && value >= 0) {
      this.tree.$.cart.unitPrice(value);
    }
  }

  ngOnDestroy(): void {
    this.tree.destroy();
  }
}
