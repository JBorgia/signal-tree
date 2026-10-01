// Undo is hand-rolled: @ngrx/store has no first-party history API (past/future stacks in the reducer).
import { Injector, createEnvironmentInjector } from '@angular/core';
import {
  Store,
  createAction,
  createFeature,
  createReducer,
  on,
  props,
  provideStore,
} from '@ngrx/store';

const setTitle = createAction('[Undo] Set Title', props());
const undo = createAction('[Undo] Undo');
const redo = createAction('[Undo] Redo');

const undoFeature = createFeature({
  name: 'undo',
  reducer: createReducer(
    { title: 'a', past: [], future: [] },
    on(setTitle, (s, { title }) => ({
      title,
      past: [...s.past, s.title],
      future: [],
    })),
    on(undo, (s) =>
      s.past.length
        ? {
            title: s.past.at(-1),
            past: s.past.slice(0, -1),
            future: [s.title, ...s.future],
          }
        : s
    ),
    on(redo, (s) =>
      s.future.length
        ? {
            title: s.future[0],
            past: [...s.past, s.title],
            future: s.future.slice(1),
          }
        : s
    )
  ),
});

const store = createEnvironmentInjector(
  [provideStore({ [undoFeature.name]: undoFeature.reducer })],
  Injector.NULL
).get(Store);
const title = store.selectSignal(undoFeature.selectTitle);
store.dispatch(setTitle({ title: 'b' }));
store.dispatch(setTitle({ title: 'c' }));
store.dispatch(undo());
const afterUndo = title();
store.dispatch(redo());
globalThis.__result = { afterUndo, afterRedo: title() };
