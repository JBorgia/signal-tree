import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnDestroy,
  signal,
} from '@angular/core';
import { batching, signalTree } from '@signal-tree/angular';

type RunMode = 'idle' | 'unbatched' | 'batched';

interface BatchingState {
  users: {
    alice: {
      id: number;
      name: string;
      postCount: number;
    };
    bob: {
      id: number;
      name: string;
      postCount: number;
    };
  };
  posts: {
    featured: {
      id: number;
      title: string;
      authorId: number;
    };
  };
}

export interface PublicationObservation {
  readonly index: number;
  readonly label: string;
  readonly alicePostCount: number;
  readonly bobPostCount: number;
  readonly postAuthor: string;
  readonly coherent: boolean;
}

interface RunSummary {
  readonly publications: number;
  readonly intermediateStates: number;
  readonly coherent: boolean;
}

const ALICE_ID = 1;
const BOB_ID = 2;

const createPublicationTree = () =>
  signalTree(
    {
      users: {
        alice: { id: ALICE_ID, name: 'Alice', postCount: 4 },
        bob: { id: BOB_ID, name: 'Bob', postCount: 2 },
      },
      posts: {
        featured: {
          id: 17,
          title: 'Causal state in practice',
          authorId: ALICE_ID,
        },
      },
    } satisfies BatchingState,
    {
      enhancers: [batching({ notificationDelayMs: 0 })],
    }
  );

@Component({
  selector: 'app-batching-demo',
  standalone: true,
  templateUrl: './batching-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './batching-demo.component.scss',
})
export class BatchingDemoComponent implements OnDestroy {
  readonly tree = createPublicationTree();
  readonly alice = this.tree.$.users.alice;
  readonly bob = this.tree.$.users.bob;
  readonly featuredPost = this.tree.$.posts.featured;

  readonly activeMode = signal<RunMode>('idle');
  readonly writesPerformed = signal(0);
  readonly publicationTimeline = signal<PublicationObservation[]>([]);
  readonly unbatchedSummary = signal<RunSummary | null>(null);
  readonly batchedSummary = signal<RunSummary | null>(null);

  readonly postAuthor = computed(() =>
    this.featuredPost.authorId() === ALICE_ID ? 'Alice' : 'Bob'
  );
  readonly intermediateStatesVisible = computed(
    () => this.publicationTimeline().filter((entry) => !entry.coherent).length
  );
  readonly finalStateCoherent = computed(() => this.isCurrentStateCoherent());

  readonly writeSteps = [
    {
      path: 'users.alice.postCount',
      change: '4 -> 3',
      label: 'Alice post count published',
    },
    {
      path: 'users.bob.postCount',
      change: '2 -> 3',
      label: 'Bob post count published',
    },
    {
      path: 'posts.featured.authorId',
      change: 'Alice -> Bob',
      label: 'Post owner published',
    },
  ] as const;

  readonly nonResponsibilities = [
    'HTTP retries',
    'queues and workers',
    'delays and backoff',
    'failure recovery',
    'transactional pending state',
  ] as const;

  runUnbatched(): void {
    this.prepareRun('unbatched');

    this.decrementAlice();
    this.publish('After Alice post count');
    this.incrementBob();
    this.publish('After Bob post count');
    this.transferPost();
    this.publish('After post owner');

    this.unbatchedSummary.set(this.currentSummary());
  }

  runBatched(): void {
    this.prepareRun('batched');

    this.tree.batch(() => {
      this.decrementAlice();
      this.incrementBob();
      this.transferPost();
    });
    this.publish('After grouped publication');

    this.batchedSummary.set(this.currentSummary());
  }

  reset(): void {
    this.restoreInitialState();
    this.activeMode.set('idle');
    this.writesPerformed.set(0);
    this.publicationTimeline.set([]);
    this.unbatchedSummary.set(null);
    this.batchedSummary.set(null);
  }

  ngOnDestroy(): void {
    this.tree.destroy();
  }

  private prepareRun(mode: Exclude<RunMode, 'idle'>): void {
    this.restoreInitialState();
    this.activeMode.set(mode);
    this.writesPerformed.set(0);
    this.publicationTimeline.set([]);
  }

  private restoreInitialState(): void {
    this.tree.batch(() => {
      this.alice.postCount(4);
      this.bob.postCount(2);
      this.featuredPost.authorId(ALICE_ID);
    });
    this.tree.flushNotifications();
  }

  private decrementAlice(): void {
    this.alice.postCount((count) => count - 1);
    this.writesPerformed.update((count) => count + 1);
  }

  private incrementBob(): void {
    this.bob.postCount((count) => count + 1);
    this.writesPerformed.update((count) => count + 1);
  }

  private transferPost(): void {
    this.featuredPost.authorId(BOB_ID);
    this.writesPerformed.update((count) => count + 1);
  }

  private publish(label: string): void {
    if (!this.tree.hasPendingNotifications()) return;

    this.tree.flushNotifications();
    const entries = this.publicationTimeline();
    this.publicationTimeline.set([
      ...entries,
      {
        index: entries.length + 1,
        label,
        alicePostCount: this.alice.postCount(),
        bobPostCount: this.bob.postCount(),
        postAuthor: this.postAuthor(),
        coherent: this.isCurrentStateCoherent(),
      },
    ]);
  }

  private isCurrentStateCoherent(): boolean {
    const authorId = this.featuredPost.authorId();
    const aliceCount = this.alice.postCount();
    const bobCount = this.bob.postCount();

    return (
      (authorId === ALICE_ID && aliceCount === 4 && bobCount === 2) ||
      (authorId === BOB_ID && aliceCount === 3 && bobCount === 3)
    );
  }

  private currentSummary(): RunSummary {
    return {
      publications: this.publicationTimeline().length,
      intermediateStates: this.intermediateStatesVisible(),
      coherent: this.finalStateCoherent(),
    };
  }
}
