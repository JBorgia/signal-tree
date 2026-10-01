// Undo is hand-rolled: NgRx Signals has no first-party history API (past/future stacks in state).
import { Injector } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

const Store = signalStore(
  withState({ title: 'a', past: [], future: [] }),
  withMethods((store) => ({
    setTitle: (title) =>
      patchState(store, (s) => ({
        title,
        past: [...s.past, s.title],
        future: [],
      })),
    undo: () =>
      patchState(store, (s) =>
        s.past.length
          ? {
              title: s.past.at(-1),
              past: s.past.slice(0, -1),
              future: [s.title, ...s.future],
            }
          : s
      ),
    redo: () =>
      patchState(store, (s) =>
        s.future.length
          ? {
              title: s.future[0],
              past: [...s.past, s.title],
              future: s.future.slice(1),
            }
          : s
      ),
  }))
);

const store = Injector.create({ providers: [Store] }).get(Store);
store.setTitle('b');
store.setTitle('c');
store.undo();
const afterUndo = store.title();
store.redo();
globalThis.__result = { afterUndo, afterRedo: store.title() };
