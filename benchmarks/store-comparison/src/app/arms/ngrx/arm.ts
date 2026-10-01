/**
 * NgRx SignalStore arm (@ngrx/signals 22). Idioms used, and why each is the documented/cheapest form:
 *
 * - `signalStore(withEntities<Row>(), withComputed, withMethods)`: the documented keyed-collection
 *   feature (state is `{ entityMap, ids }`, id selected from `entity.id`, so no selectId needed).
 * - `patchState(store, setAllEntities(rows))`: the documented full replace (one patch, one notify).
 * - `patchState(store, updateEntity({ id, changes }))`: first-party single-entity patch; also
 *   `removeEntity(id)`. They clone entityMap (and ids) internally; that O(n) immutable rebuild is
 *   NgRx's architecture and is left alone (METHODOLOGY rule 7).
 * - `updateMany`: `updateEntities({ ids, changes: (e) => patchById.get(e.id) })`. `changes` may be a
 *   function of the entity, so different patches per id go in ONE updater: entity state is cloned
 *   once (vs once per `updateEntity`). Repeated ids are merged in order first, so it equals `update`
 *   applied per patch; passing explicit `ids` avoids the predicate scan over all rows.
 * - `row(id)`: `computed(() => store.entityMap()[id])`, the documented way to select one entity
 *   (entityMap is the state record; `entities` would build an array first, so it is not used).
 * - `move`: no first-party reorder updater exists. Idiomatic workaround: a plain `patchState`
 *   state-updater function that writes a re-ordered copy of `ids` only (entityMap untouched).
 * - `statusCounts`: `withComputed` over `ids` + `entityMap` (skips the `entities` array allocation)
 *   with a shallow `equal` so an unchanged tally does not notify the footer (Angular computed option).
 * - Scoping: the store is a `signalStore()` class provided in a child EnvironmentInjector created
 *   from the caller's injector (`createEnvironmentInjector`); `destroy()` destroys that injector,
 *   which releases the store (and its DestroyRef hooks). Per-editor seed arrives via an
 *   InjectionToken so the store is a normal DI-constructed class.
 * - Editor: flat `withState(seed.fields)` so each field is its own state signal (`store[key]`, zero
 *   wrapper), lines via `withEntities<Line>()` seeded in `withHooks({ onInit })`; `total`/`dirty`
 *   are `withComputed`.
 * - `snapshot()`/`result()` use the documented `getState(store)`.
 */
import {
  EnvironmentInjector,
  InjectionToken,
  Signal,
  computed,
  createEnvironmentInjector,
  inject,
  type Type,
} from '@angular/core';
import {
  getState,
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  removeEntity,
  setAllEntities,
  updateEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import {
  EDITOR_FIELDS,
  STATUSES,
  type Arm,
  type EditorField,
  type EditorFields,
  type EditorResult,
  type EditorSeed,
  type EditorStore,
  type GridStore,
  type Line,
  type LinePatch,
  type Row,
  type RowPatch,
  type RowUpdate,
  type Status,
} from '../../contract';
import { armRoutes } from '../../shared/arm-routes';

type Counts = Readonly<Record<Status, number>>;

function sameCounts(a: Counts, b: Counts): boolean {
  for (const s of STATUSES) if (a[s] !== b[s]) return false;
  return true;
}

const GridState = signalStore(
  withEntities<Row>(),
  withComputed(({ ids, entityMap }) => ({
    statusCounts: computed<Counts>(
      () => {
        const map = entityMap();
        const counts = {
          scheduled: 0,
          loading: 0,
          enroute: 0,
          onsite: 0,
          returning: 0,
          complete: 0,
        };
        for (const id of ids()) counts[map[id].status]++;
        return counts;
      },
      { equal: sameCounts }
    ),
  })),
  withMethods((store) => ({
    setAll(rows: readonly Row[]): void {
      patchState(store, setAllEntities(rows as Row[]));
    },
    update(id: string, changes: RowPatch): void {
      patchState(store, updateEntity({ id, changes }));
    },
    updateMany(patches: readonly RowUpdate[]): void {
      const byId = new Map<string, RowPatch>();
      for (const { id, patch } of patches)
        byId.set(id, { ...byId.get(id), ...patch });
      patchState(
        store,
        updateEntities({
          ids: [...byId.keys()],
          changes: (row: Row) => byId.get(row.id)!,
        })
      );
    },
    remove(id: string): void {
      patchState(store, removeEntity(id));
    },
    move(id: string, index: number): void {
      patchState(store, (state) => {
        const from = state.ids.indexOf(id);
        if (from < 0) return {};
        const next = state.ids.slice();
        next.splice(from, 1);
        next.splice(Math.max(0, Math.min(index, next.length)), 0, id);
        return { ids: next };
      });
    },
  }))
);

const EDITOR_SEED = new InjectionToken<EditorSeed>('ngrx-bench-editor-seed');

const EditorState = signalStore(
  withState<EditorFields>(() => inject(EDITOR_SEED).fields),
  withEntities<Line>(),
  withHooks((store) => {
    const seed = inject(EDITOR_SEED);
    return {
      onInit() {
        patchState(store, setAllEntities(seed.lines as Line[]));
      },
    };
  }),
  withMethods((store) => ({
    setField(key: EditorField, value: EditorFields[EditorField]): void {
      patchState(store, { [key]: value } as Partial<EditorFields>);
    },
    updateLine(id: string, changes: LinePatch): void {
      patchState(store, updateEntity({ id, changes }));
    },
  })),
  withComputed(({ ids, entityMap, ...fields }) => {
    const seed = inject(EDITOR_SEED);
    const seedLines = new Map(seed.lines.map((l) => [l.id, l] as const));
    const signals = fields as unknown as Record<EditorField, Signal<unknown>>;
    return {
      total: computed(() => {
        const map = entityMap();
        let sum = 0;
        for (const id of ids()) sum += map[id].qty * map[id].price;
        return sum;
      }),
      dirty: computed(() => {
        for (const k of EDITOR_FIELDS)
          if (signals[k]() !== seed.fields[k]) return true;
        const map = entityMap();
        const cur = ids();
        if (cur.length !== seedLines.size) return true;
        for (const id of cur) {
          const a = map[id];
          const b = seedLines.get(id as string);
          if (
            !b ||
            a.product !== b.product ||
            a.qty !== b.qty ||
            a.price !== b.price
          )
            return true;
        }
        return false;
      }),
    };
  })
);

/** A store class provided in its own child environment injector; destroying it releases the store. */
function scoped<T>(token: Type<T>) {
  const injector = createEnvironmentInjector(
    [token],
    inject(EnvironmentInjector)
  );
  return { store: injector.get(token), injector };
}

function createGrid(): GridStore {
  const { store, injector } = scoped(GridState);
  return {
    ids: store.ids as unknown as Signal<readonly string[]>,
    row: (id) => computed(() => store.entityMap()[id] as Row | undefined),
    statusCounts: store.statusCounts,
    setAll: (rows) => store.setAll(rows),
    update: (id, patch) => store.update(id, patch),
    updateMany: (patches) => store.updateMany(patches),
    remove: (id) => store.remove(id),
    move: (id, index) => store.move(id, index),
    snapshot() {
      const s = getState(store);
      return s.ids.map((id) => s.entityMap[id]);
    },
    destroy: () => injector.destroy(),
  };
}

function createEditor(seed: EditorSeed): EditorStore {
  const injector = createEnvironmentInjector(
    [EditorState, { provide: EDITOR_SEED, useValue: seed }],
    inject(EnvironmentInjector)
  );
  const store = injector.get(EditorState);
  const fieldSignals = store as unknown as Record<EditorField, Signal<unknown>>;
  return {
    field: <K extends EditorField>(key: K) =>
      fieldSignals[key] as Signal<EditorFields[K]>,
    set: (key, value) => store.setField(key, value),
    lineIds: store.ids as unknown as Signal<readonly string[]>,
    line: (id) => computed(() => store.entityMap()[id] as Line | undefined),
    updateLine: (id, patch) => store.updateLine(id, patch),
    total: store.total,
    dirty: store.dirty,
    result(): EditorResult {
      const s = getState(store);
      const fields = {} as Record<EditorField, unknown>;
      for (const k of EDITOR_FIELDS) fields[k] = s[k];
      return {
        rowId: seed.rowId,
        fields: fields as unknown as EditorFields,
        lines: s.ids.map((id) => s.entityMap[id]),
      };
    },
    destroy: () => injector.destroy(),
  };
}

const ARM: Arm = {
  id: 'ngrx',
  label: 'NgRx SignalStore',
  library: { name: '@ngrx/signals', specifier: '@ngrx/signals' },
  createGrid,
  createEditor,
};
export const ROUTES = armRoutes(ARM);
