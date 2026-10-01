import { Injector, createEnvironmentInjector } from '@angular/core';
import { createEntityAdapter } from '@ngrx/entity';
import {
  Store,
  createAction,
  createFeature,
  createReducer,
  on,
  props,
  provideStore,
} from '@ngrx/store';

const adapter = createEntityAdapter();
const setAll = createAction('[Entities] Set All', props());
const addOne = createAction('[Entities] Add', props());
const rename = createAction('[Entities] Rename', props());
const removeOne = createAction('[Entities] Remove', props());

const entitiesFeature = createFeature({
  name: 'entities',
  reducer: createReducer(
    adapter.getInitialState(),
    on(setAll, (s, { all }) => adapter.setAll(all, s)),
    on(addOne, (s, { entity }) => adapter.addOne(entity, s)),
    on(rename, (s, { id, name }) =>
      adapter.updateOne({ id, changes: { name } }, s)
    ),
    on(removeOne, (s, { id }) => adapter.removeOne(id, s))
  ),
});
const { selectIds, selectEntities, selectAll } = adapter.getSelectors(
  entitiesFeature.selectEntitiesState
);

const store = createEnvironmentInjector(
  [provideStore({ [entitiesFeature.name]: entitiesFeature.reducer })],
  Injector.NULL
).get(Store);
store.dispatch(
  setAll({
    all: [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' },
    ],
  })
);
store.dispatch(addOne({ entity: { id: 4, name: 'd' } }));
store.dispatch(rename({ id: 2, name: 'B' }));
store.dispatch(removeOne({ id: 3 }));
globalThis.__result = {
  ids: [...store.selectSignal(selectIds)()],
  two: { ...store.selectSignal(selectEntities)()[2] },
  all: store
    .selectSignal(selectAll)()
    .map((e) => ({ ...e })),
};
