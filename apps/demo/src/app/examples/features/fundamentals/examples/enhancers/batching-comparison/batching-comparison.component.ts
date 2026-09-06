import {
  Component,
  effect,
  inject,
  Injector,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { batching, signalTree } from '@signal-tree/angular';

import { ExampleComponent } from '../../../../../shared/components/example-shell';

@Component({
  selector: 'app-batching-comparison',
  standalone: true,
  imports: [ExampleComponent],
  templateUrl: './batching-comparison.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './batching-comparison.component.scss',
})
export class BatchingComparisonComponent {
  // effect() needs an injection context; component methods run outside one,
  // so we capture the injector here and pass it explicitly (avoids NG0203).
  private readonly injector = inject(Injector);

  // Controls
  ops = signal(1000);
  batchNotificationDelayMs = signal(0);
  running = signal(false);

  // Results
  batchedTime = signal<number | null>(null);
  unbatchedTime = signal<number | null>(null);
  batchedWrites = signal(0);
  unbatchedWrites = signal(0);
  batchedRenders = signal(0);
  unbatchedRenders = signal(0);

  async runComparison(): Promise<void> {
    if (this.running()) return;
    this.running.set(true);
    try {
      await this.runUnbatched();
      await this.runBatched();
    } finally {
      this.running.set(false);
    }
  }

  private async runUnbatched(): Promise<void> {
    const tree = signalTree({ counter: 0 });

    let renders = 0;
    const ref = effect(
      () => {
        void tree.$.counter();
        renders++;
      },
      { injector: this.injector }
    );
    try {
      const n = this.ops();
      const start = performance.now();
      for (let i = 0; i < n; i++) {
        tree.$.counter.set(i + 1);
      }
      const elapsed = performance.now() - start;

      await this.settle();
      this.unbatchedTime.set(elapsed);
      this.unbatchedWrites.set(n);
      this.unbatchedRenders.set(renders);
    } finally {
      ref.destroy();
      tree.destroy();
    }
  }

  private async runBatched(): Promise<void> {
    const tree = signalTree(
      { counter: 0 },
      {
        enhancers: [
          batching({
            enabled: true,
            notificationDelayMs: this.batchNotificationDelayMs(),
          }),
        ],
      }
    );

    let renders = 0;
    const ref = effect(
      () => {
        void tree.$.counter();
        renders++;
      },
      { injector: this.injector }
    );
    try {
      const n = this.ops();
      const start = performance.now();
      // coalesce() dedupes same-path writes — only the final value is applied
      // to the underlying signal when the callback completes.
      tree.coalesce(() => {
        for (let i = 0; i < n; i++) {
          tree.$.counter.set(i + 1);
        }
      });
      const elapsed = performance.now() - start;

      await this.settle(this.batchNotificationDelayMs());
      this.batchedTime.set(elapsed);
      this.batchedWrites.set(n === 0 ? 0 : 1);
      this.batchedRenders.set(renders);
    } finally {
      ref.destroy();
      tree.destroy();
    }
  }

  /** Wait long enough for effects (and any delayed notification) to flush. */
  private settle(extraMs = 0): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, extraMs + 20));
  }
}
