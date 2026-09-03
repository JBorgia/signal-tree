import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  entityMap,
  external,
  SignalTreeRollbackError,
  signalTree,
  restoration,
  undoable,
} from '@signal-tree/angular';

import { ExampleComponent } from '../../../../shared/components/example-shell';

import type { RestorationMethods } from '@signal-tree/angular';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

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
  todos: Todo[];
}

@Component({
  selector: 'app-restoration-demo',
  standalone: true,
  imports: [FormsModule, ExampleComponent],
  templateUrl: './restoration-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './restoration-demo.component.scss',
})
export class RestorationDemoComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  newTodoText = '';

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
      this.timers.clear();
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
      todos: [
        { id: 1, title: 'Learn SignalTree', completed: true },
        { id: 2, title: 'Try restoration', completed: false },
        { id: 3, title: 'Inspect causal turns', completed: false },
      ],
    } as AppState,
    { enhancers: [restoration({ maxHistorySize: 50 })] }
  );

  // State signals
  counter = this.tree.$.counter;
  message = this.tree.$.message;
  todos = this.tree.$.todos;

  // Restoration view state derives from the tree.
  history = signal(this.tree.getRestorationHistory());
  currentIndex = signal(this.tree.getCurrentIndex());
  canUndo = signal(this.tree.canUndo());
  canRedo = signal(this.tree.canRedo());
  rollbackMessage = signal<string | null>(null);

  private refreshRestorationState() {
    this.history.set(this.tree.getRestorationHistory());
    this.currentIndex.set(this.tree.getCurrentIndex());
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

  // Computed signals
  activeTodos = computed(() => this.todos().filter((t: Todo) => !t.completed));
  completedTodos = computed(() =>
    this.todos().filter((t: Todo) => t.completed)
  );

  historyLength = computed(() => this.history().length);
  currentState = computed(() => this.history()[this.currentIndex()]);

  /**
   * How many frames you can actually travel, each way.
   *
   * `canUndo()`/`canRedo()` answer "is there anything?" — a disabled button.
   * They do not answer "how far?", which is the question you have when you are
   * hunting for a state you passed three actions ago.
   *
   * Both fall straight out of the position: `canUndo()` is `index > 0`, so the
   * number of steps back is the index itself, and the steps forward are whatever
   * sits after it. Clamped because an empty history parks the index at -1.
   */
  undosAvailable = computed(() => Math.max(0, this.currentIndex() + 1));
  redosAvailable = computed(() =>
    Math.max(0, this.historyLength() - 1 - this.currentIndex())
  );

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

  // Todo actions
  addTodo() {
    const text = this.newTodoText.trim();
    if (!text) return;

    const newTodo: Todo = {
      id: Date.now(),
      title: text,
      completed: false,
    };

    // `undoable()` marks the authored causal turn containing these writes as
    // eligible for undo. Adding a todo is a real user operation, which is the
    // bar for designation — not "it happens to change state".
    //
    // It does NOT create a turn boundary: anything else written in this same
    // tick belongs to the same operation and reverses with it.
    this.designate(() =>
      this.todos.update((todos) => [...todos, newTodo])
    );
    this.newTodoText = '';
  }

  /**
   * A server refresh — the mirror of `addTodo()`.
   *
   * `external()` says the contained writes are externally acquired truth rather
   * than work the user authored. Watch the history counter: it does NOT grow,
   * and the Undo button still points at your last real operation.
   *
   * Without it, a refresh is indistinguishable from a user edit, so Undo would
   * revert the SERVER's value back to a stale client one.
   *
   * Note the shape: acquisition is asynchronous and belongs to whatever fetches
   * (a `resource()`, an RxJS pipeline, a fetch). Only APPLYING the result is a
   * SignalTree event, and that part is synchronous — `external(async () => …)`
   * is refused with ST1035 rather than silently classifying nothing.
   */
  refreshFromServer() {
    const serverTodos: Todo[] = [
      { id: 1, title: 'Learn SignalTree', completed: true },
      { id: 2, title: 'Try Time Travel', completed: true },
      { id: 9001, title: 'Review the server refresh', completed: false },
    ];

    external(() => {
      this.todos.set(serverTodos);
    });
    this.queueRestorationStateRefresh();
  }

  toggleTodo(id: number) {
    this.designate(() =>
      this.todos.update((todos) =>
        todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      )
    );
  }

  deleteTodo(id: number) {
    this.designate(() =>
      this.todos.update((todos) => todos.filter((todo) => todo.id !== id))
    );
  }

  // Time travel actions
  undo() {
    try {
      this.rollbackMessage.set(null);
      this.tree.undo();
      this.queueRestorationStateRefresh();
    } catch (error) {
      this.handleRollbackError(error);
    }
  }

  redo() {
    try {
      this.rollbackMessage.set(null);
      this.tree.redo();
      this.queueRestorationStateRefresh();
    } catch (error) {
      this.handleRollbackError(error);
    }
  }

  goToState(index: number) {
    try {
      this.rollbackMessage.set(null);
      this.tree.jumpTo(index);
      this.queueRestorationStateRefresh();
    } catch (error) {
      this.handleRollbackError(error);
    }
  }

  private handleRollbackError(error: unknown): void {
    if (!(error instanceof SignalTreeRollbackError)) {
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
    this.tree.resetRestorationHistory();
    this.refreshRestorationState();
  }

  // Generate sample actions for easy testing
  generateSampleActions() {
    // Reset history first
    this.tree.resetRestorationHistory();
    this.refreshRestorationState();

    // Create a sequence of actions with delays for better history visualization
    this.schedule(() => {
      this.designate(() => this.message.set('Starting demo...'));
    }, 100);

    this.schedule(() => {
      this.designate(() => this.counter.set(1));
    }, 200);

    this.schedule(() => {
      this.designate(() =>
        this.todos.set([
          { id: Date.now(), title: 'First task', completed: false },
        ])
      );
    }, 300);

    this.schedule(() => {
      this.designate(() => this.counter.set(5));
    }, 400);

    this.schedule(() => {
      this.designate(() => this.message.set('Making more changes...'));
    }, 500);

    this.schedule(() => {
      this.designate(() =>
        this.todos.update((todos) => [
          ...todos,
          { id: Date.now() + 1, title: 'Second task', completed: false },
        ])
      );
    }, 600);

    this.schedule(() => {
      this.designate(() => this.counter.set(10));
    }, 700);

    this.schedule(() => {
      this.designate(() =>
        this.todos.update((todos) =>
          todos.map((todo, index) =>
            index === 0 ? { ...todo, completed: true } : todo
          )
        )
      );
    }, 800);

    this.schedule(() => {
      this.designate(() =>
        this.message.set('Demo complete. Try undo and redo now.')
      );
    }, 900);

    this.schedule(() => {
      this.designate(() => this.counter.set(15));
    }, 1000);
  }

  getStatePreview(state: AppState): string {
    return `Counter: ${state.counter}, Todos: ${
      state.todos.length
    }, Message: "${state.message.substring(0, 20)}..."`;
  }
}
