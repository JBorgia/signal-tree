import { JsonPipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  entityMap,
  external,
  signalTree,
  restoration,
  undoable,
} from '@signal-tree/angular';

import {
  ExampleComponent,
  type CodeFile,
} from '../../../../shared/components/example-shell';

import type { RestorationMethods } from '@signal-tree/angular';

interface Person {
  id: number;
  name: string;
}

type ProfileModel = {
  name: string;
  email: string;
  [k: string]: unknown;
};

interface AppState {
  counter: number;
  message: string;
}

@Component({
  selector: 'app-restoration-demo',
  standalone: true,
  imports: [ExampleComponent, JsonPipe],
  templateUrl: './restoration-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './restoration-demo.component.scss',
})
export class RestorationDemoComponent {
  readonly entityCode: CodeFile[] = [
    {
      label: 'Undo collection edits',
      language: 'typescript',
      source: `// markerTree uses entityMap() and the restoration() enhancer.
// Each button runs in a separate user event.
undoable(() => markerTree.$.people.addOne({ id, name: \`Person \${id}\` }));

// After the event settles:
markerTree.undo(); // removes that addition
markerTree.redo(); // restores it

// Ordinary nested values use the same designation.
undoable(() => markerTree.$.job.set('LOADED'));`,
    },
  ];
  readonly codeFiles: CodeFile[] = [
    {
      label: 'User edit and undo',
      language: 'typescript',
      source: `import { signalTree, restoration, undoable, external } from '@signal-tree/angular';

const tree = signalTree(initialState, {
  enhancers: [restoration({ maxHistorySize: 50 })],
});

// One user action:
undoable(() => tree.$.counter.update((value) => value + 1));
// After that event settles, on a later user action:
tree.undo();
tree.redo();
// Call tree.destroy() when its owner is torn down.`,
    },
    {
      label: 'Incoming update',
      language: 'typescript',
      source: `// Simulated resolved server data enters synchronously.
external(() => tree.$.message.set('Updated by the server'));

// External data does not create an undo step.
// Undo may refuse an edit that conflicts with later external truth.
try {
  tree.undo();
} catch (error) {
  if (!(error instanceof Error) || !error.message.startsWith('ST1034:')) throw error;
  rollbackMessage.set(error.message);
}`,
    },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly sampleTimers = new Set<ReturnType<typeof setTimeout>>();

  // EntityMap and ordinary state participate in the same restoration model.
  private markerTree = signalTree(
    {
      people: entityMap<Person, number>({ selectId: (p) => p.id }),
      // STATUS-DEL: was `status<Error>()`. The demo only needs a changing named
      // value to show undo/redo, so ordinary store state is the minimum fixture.
      job: 'NOT_LOADED' as 'NOT_LOADED' | 'LOADED' | 'ERROR',
      profile: { name: '', email: '' } as ProfileModel,
    },
    { enhancers: [restoration({ maxHistorySize: 50 })] }
  );

  private get markerTT(): RestorationMethods {
    return this.markerTree as unknown as RestorationMethods;
  }

  private nextPersonId = 1;

  people = () => this.markerTree.$.people.all();
  peopleCount = () => this.markerTree.$.people.count();
  jobState = () => this.markerTree.$.job();
  profileValues = () => this.markerTree.$.profile();

  markerCanUndo = signal(false);
  markerCanRedo = signal(false);
  markerLog = signal<string[]>([]);

  // History is recorded ASYNCHRONOUSLY — a write marks the tree dirty and the
  // entry is committed on a later tick. Reading canUndo() synchronously right
  // after a write reads the PREVIOUS value, so the Undo button stayed disabled
  // until the next unrelated action. (The same detail is why undo-redo.spec.ts
  // awaits `flush()` between writes: without it, several writes collapse into
  // one history entry and an undo appears to do nothing.)
  private refreshMarkerState(action?: string) {
    this.schedule(() => this.commitMarkerState(action), 0);
  }

  private designateMarker(operation: () => void, action: string): void {
    undoable(operation);
    this.refreshMarkerState(action);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const timer of this.timers) clearTimeout(timer);
      for (const timer of this.sampleTimers) clearTimeout(timer);
      this.timers.clear();
      this.sampleTimers.clear();
      this.markerTree.destroy();
      this.tree.destroy();
    });
  }

  private schedule(action: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      action();
    }, delay);
    this.timers.add(timer);
  }

  private scheduleSample(action: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.sampleTimers.delete(timer);
      action();
    }, delay);
    this.sampleTimers.add(timer);
  }

  private cancelSampleActions(): void {
    for (const timer of this.sampleTimers) clearTimeout(timer);
    this.sampleTimers.clear();
  }

  private commitMarkerState(action?: string) {
    this.markerCanUndo.set(this.markerTT.canUndo());
    this.markerCanRedo.set(this.markerTT.canRedo());
    if (action) {
      this.markerLog.update((l) =>
        [
          `${action} → ${this.peopleCount()} people, job=${this.jobState()}, name="${
            this.profileValues().name
          }"`,
          ...l,
        ].slice(0, 8)
      );
    }
  }

  addPerson() {
    const id = this.nextPersonId++;
    this.designateMarker(
      () => this.markerTree.$.people.addOne({ id, name: `Person ${id}` }),
      `add person ${id}`
    );
  }

  removeLastPerson() {
    const all = this.people();
    if (!all.length) return;
    const last = all[all.length - 1];
    this.designateMarker(
      () => this.markerTree.$.people.removeOne(last.id),
      `remove person ${last.id}`
    );
  }

  markJobLoaded() {
    this.designateMarker(
      () => this.markerTree.$.job.set('LOADED'),
      'job → LOADED'
    );
  }

  markJobFailed() {
    this.designateMarker(
      () => this.markerTree.$.job.set('ERROR'),
      'job → ERROR'
    );
  }

  editProfile() {
    const n = this.people().length;
    this.designateMarker(
      () =>
        this.markerTree.$.profile({
          name: `Editor ${n}`,
          email: `e${n}@x.io`,
        }),
      'edit profile'
    );
  }

  undoMarkers() {
    this.markerTT.undo();
    this.refreshMarkerState('UNDO');
  }

  redoMarkers() {
    this.markerTT.redo();
    this.refreshMarkerState('REDO');
  }

  resetMarkers() {
    this.markerTT.resetRestorationHistory();
    this.markerLog.set([]);
    this.refreshMarkerState();
  }

  // No cast: `restoration()`'s surface arrives through the return type now that
  // the enhancer is declared rather than chained on afterwards.
  private tree = signalTree(
    {
      counter: 0,
      message: 'Hello SignalTree!',
    } as AppState,
    { enhancers: [restoration({ maxHistorySize: 50 })] }
  );

  // State signals
  counter = this.tree.$.counter;
  message = this.tree.$.message;

  // Restoration view state derives from the tree.
  history = signal(this.tree.getRestorationHistory());
  canUndo = signal(this.tree.canUndo());
  canRedo = signal(this.tree.canRedo());
  rollbackMessage = signal<string | null>(null);

  private refreshRestorationState() {
    this.history.set(this.tree.getRestorationHistory());
    this.canUndo.set(this.tree.canUndo());
    this.canRedo.set(this.tree.canRedo());
  }

  private queueRestorationStateRefresh(): void {
    this.schedule(() => this.refreshRestorationState(), 0);
  }

  private designate(operation: () => void): void {
    undoable(operation);
    this.queueRestorationStateRefresh();
  }

  historyLength = computed(() => this.history().length);

  // Counter actions
  increment() {
    this.designate(() => this.counter.update((value) => value + 1));
  }

  decrement() {
    this.designate(() => this.counter.update((value) => value - 1));
  }

  reset() {
    this.designate(() => this.counter.set(0));
  }

  // Message actions
  updateMessage(value: string) {
    this.designate(() => this.message.set(value));
  }

  // Apply the resolved server value without creating an undo step.
  refreshFromServer() {
    external(() => this.message.set('Updated by the server'));
    this.queueRestorationStateRefresh();
  }

  // Time travel actions
  undo() {
    try {
      this.rollbackMessage.set(null);
      this.tree.undo();
      this.queueRestorationStateRefresh();
    } catch (error) {
      this.handleRestorationError(error);
    }
  }

  redo() {
    try {
      this.rollbackMessage.set(null);
      this.tree.redo();
      this.queueRestorationStateRefresh();
    } catch (error) {
      this.handleRestorationError(error);
    }
  }

  goToState(index: number) {
    try {
      this.rollbackMessage.set(null);
      this.tree.jumpTo(index);
      this.queueRestorationStateRefresh();
    } catch (error) {
      this.handleRestorationError(error);
    }
  }

  private handleRestorationError(error: unknown): void {
    // Restoration conflicts are coded errors; transaction rollback has a different type.
    if (!(error instanceof Error) || !error.message.startsWith('ST1034:')) {
      throw error;
    }

    this.rollbackMessage.set(error.message);
    this.queueRestorationStateRefresh();
  }

  onHistoryItemKeyup(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.goToState(index);
    }
  }

  clearHistory() {
    this.cancelSampleActions();
    this.tree.resetRestorationHistory();
    this.refreshRestorationState();
  }

  // Generate sample actions for easy testing
  generateSampleActions() {
    this.cancelSampleActions();
    // Reset history first
    this.tree.resetRestorationHistory();
    this.refreshRestorationState();

    // Create a sequence of actions with delays for better history visualization
    this.scheduleSample(() => {
      this.designate(() => this.message.set('Starting demo...'));
    }, 100);

    this.scheduleSample(() => {
      this.designate(() => this.counter.set(1));
    }, 200);

    this.scheduleSample(() => {
      this.designate(() => this.counter.set(5));
    }, 400);

    this.scheduleSample(() => {
      this.designate(() => this.message.set('Making more changes...'));
    }, 500);

    this.scheduleSample(() => {
      this.designate(() => this.counter.set(10));
    }, 700);

    this.scheduleSample(() => {
      this.designate(() =>
        this.message.set('Demo complete. Try undo and redo now.')
      );
    }, 900);

    this.scheduleSample(() => {
      this.designate(() => this.counter.set(15));
    }, 1000);
  }

  getStatePreview(state: AppState): string {
    return `Counter: ${state.counter}, Message: "${state.message.substring(
      0,
      20
    )}..."`;
  }
}
