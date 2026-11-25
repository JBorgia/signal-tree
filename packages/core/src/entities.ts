/**
 * entityMap: a keyed collection in insertion order (BRIEF.md 4.4, E1–E4).
 *
 * Rows are the tree's own copies. A row's fields become cells only when read
 * through a row handle (E2). A row handle belongs to one entity lifetime: it
 * follows the row through key changes and never retargets to a row that
 * reuses a removed key (E1). Every call is all-or-nothing (E3).
 */
import type { CellAdapter, NativeCell, Route } from './cell.ts';
import { NODE } from './cell.ts';
import { SignalTreeError, SignalTreeRefusal } from './errors.ts';
import type { Location, PathSegment, WriteEffect, WriteKind, WriteOp } from './seam.ts';

const ENTITY_MAP = Symbol('signal-tree.entityMap');

export type EntityKey = string | number;

export interface EntityMapConfig<E, K extends EntityKey> {
  /** The row's key. Defaults to row => row.id. */
  readonly selectId?: (row: E) => K;
  /** Rows the collection starts with, in order. */
  readonly rows?: readonly E[];
}

/** Placed in the initial state, it makes that member a keyed collection. */
export interface EntityMapMarker<E, K extends EntityKey> {
  readonly [ENTITY_MAP]: { readonly selectId: ((row: E) => K) | null; readonly rows: readonly E[] };
}

export function entityMap<E, K extends EntityKey = E extends { id: infer I extends EntityKey } ? I : EntityKey>(config: EntityMapConfig<E, K> = {}): EntityMapMarker<E, K> {
  const selectId = config.selectId ?? null;
  if (selectId !== null && typeof selectId !== 'function') throw new SignalTreeError('ST1006', { detail: 'selectId must be a function' });
  return Object.freeze({ [ENTITY_MAP]: Object.freeze({ selectId, rows: config.rows ?? [] }) }) as EntityMapMarker<E, K>;
}

export function isEntityMapMarker(value: unknown): value is EntityMapMarker<unknown, EntityKey> {
  return typeof value === 'object' && value !== null && ENTITY_MAP in value;
}

export function entityMapConfig(marker: EntityMapMarker<unknown, EntityKey>) {
  return marker[ENTITY_MAP];
}

export interface Update<E, K extends EntityKey> {
  readonly id: K;
  readonly changes: Partial<E>;
}

/** The handle of one row: its fields as cells, and the row as a whole. */
export type RowHandle<Cells> = Cells & {
  /** A frozen snapshot of the row, or undefined once the row is gone. */
  get(): unknown;
};

/** What a collection needs from its tree. */
export interface CollectionHost {
  readonly adapter: CellAdapter<string>;
  readonly fieldRoute: Route;
  assertLive(): void;
  /** Routes one collection call through the seam; `apply` makes the change and, when observed, describes it. */
  write(collection: EntityCollection, kind: WriteKind, payload: unknown, apply: (payload: unknown, op: WriteOp | null) => readonly WriteEffect[]): void;
  /** Records how to undo a change, when an explicit turn may need to revert it (T13). */
  journal(undo: () => void): void;
  /** The collection changed: snapshots that contain it are stale. */
  changed(collection: EntityCollection): void;
  copy(value: unknown, path: readonly PropertyKey[]): unknown;
  /** Captures the current writer context; the returned runner runs code under it later (ruling 6, W5). */
  capture(): (fn: () => void) => void;
  frozen(value: unknown): unknown;
  registerCell(cell: object): void;
  isPlainObject(value: unknown): value is Record<PropertyKey, unknown>;
}

class Entity {
  key: EntityKey;
  row: Record<PropertyKey, unknown>;
  alive = true;
  prev: Entity | null = null;
  next: Entity | null = null;
  cells: Map<PropertyKey, object> | null = null;
  handle: object | null = null;
  snap: unknown = undefined;
  snapValid = false;
  constructor(key: EntityKey, row: Record<PropertyKey, unknown>) {
    this.key = key;
    this.row = row;
  }
}

/** Where a field cell writes. */
export class FieldRef {
  readonly entity: Entity;
  readonly field: PropertyKey;
  readonly collection: EntityCollection;
  constructor(collection: EntityCollection, entity: Entity, field: PropertyKey) {
    this.collection = collection;
    this.entity = entity;
    this.field = field;
  }
}

const DEFAULT_ID = 'id';

export class EntityCollection {
  readonly host: CollectionHost;
  readonly path: Location;
  /** The node fields the tree reads: parent branch, key, and absence (V1). */
  readonly parent: unknown;
  readonly key: PropertyKey;
  absent = false;
  private readonly selector: ((row: unknown) => EntityKey) | null;
  private readonly byKey = new Map<EntityKey, Entity>();
  private head: Entity | null = null;
  private tail: Entity | null = null;
  private allCache: readonly unknown[] | null = null;
  private idsCache: readonly EntityKey[] | null = null;
  handle: object | null = null;

  constructor(host: CollectionHost, parent: unknown, key: PropertyKey, path: Location, marker: EntityMapMarker<unknown, EntityKey>) {
    this.host = host;
    this.parent = parent;
    this.key = key;
    this.path = path;
    const config = entityMapConfig(marker);
    this.selector = config.selectId as ((row: unknown) => EntityKey) | null;
    const rows = this.prepareRows(config.rows, true);
    for (const [key, row] of rows) this.link(new Entity(key, row));
  }

  // ---------------------------------------------------------------- keys

  private selectId(row: Record<PropertyKey, unknown>): EntityKey {
    const key = this.selector ? this.selector(row) : row[DEFAULT_ID];
    if (key === null || key === undefined) throw new SignalTreeRefusal('ST1012', { path: this.path });
    return key as EntityKey;
  }

  /** Copies and checks rows; refuses the whole call on any bad row or repeated key (E3, V4, V5). */
  private prepareRows(rows: unknown, refuseExisting: boolean): [EntityKey, Record<PropertyKey, unknown>][] {
    if (!Array.isArray(rows)) throw new SignalTreeError('ST1013', { path: this.path, detail: 'expected an array of rows' });
    const out: [EntityKey, Record<PropertyKey, unknown>][] = [];
    const seen = new Set<EntityKey>();
    for (let i = 0; i < rows.length; i++) {
      const row = this.prepareRow(rows[i]);
      const key = this.selectId(row);
      if (seen.has(key) || (refuseExisting && this.byKey.has(key))) throw new SignalTreeRefusal('ST1010', { path: this.path, key });
      seen.add(key);
      out.push([key, row]);
    }
    return out;
  }

  private prepareRow(row: unknown): Record<PropertyKey, unknown> {
    if (!this.host.isPlainObject(row)) {
      const key = typeof row === 'object' && row !== null ? (this.selector ? safe(() => this.selector!(row)) : (row as Record<string, unknown>)[DEFAULT_ID]) : undefined;
      throw new SignalTreeRefusal('ST1013', { path: this.path, key, detail: 'rows must be plain objects' });
    }
    return this.host.copy(row, this.path) as Record<PropertyKey, unknown>;
  }

  private entity(key: unknown): Entity {
    if (key === null || key === undefined) throw new SignalTreeRefusal('ST1012', { path: this.path });
    const entity = this.byKey.get(key as EntityKey);
    if (!entity) throw new SignalTreeRefusal('ST1011', { path: this.path, key });
    return entity;
  }

  private assertPresent(): void {
    this.host.assertLive();
    if (this.absent) throw new SignalTreeRefusal('ST1004', { path: this.path, detail: 'the collection is absent' });
  }

  // --------------------------------------------------------------- order

  private link(entity: Entity, after: Entity | null = this.tail): void {
    entity.prev = after;
    entity.next = after ? after.next : this.head;
    if (entity.next) entity.next.prev = entity;
    else this.tail = entity;
    if (after) after.next = entity;
    else this.head = entity;
    this.byKey.set(entity.key, entity);
  }

  private unlink(entity: Entity): void {
    if (entity.prev) entity.prev.next = entity.next;
    else this.head = entity.next;
    if (entity.next) entity.next.prev = entity.prev;
    else this.tail = entity.prev;
    this.byKey.delete(entity.key);
    entity.prev = entity.next = null;
  }

  private order(): Entity[] {
    const list: Entity[] = [];
    for (let e = this.head; e; e = e.next) list.push(e);
    return list;
  }

  private restoreOrder(list: readonly Entity[]): void {
    this.head = this.tail = null;
    this.byKey.clear();
    for (const entity of list) {
      entity.prev = entity.next = null;
      this.link(entity);
    }
  }

  // ---------------------------------------------------------------- reads

  count(): number {
    this.host.assertLive();
    return this.byKey.size;
  }

  ids(): readonly EntityKey[] {
    this.host.assertLive();
    if (this.idsCache) return this.idsCache;
    const ids: EntityKey[] = [];
    for (let e = this.head; e; e = e.next) ids.push(e.key);
    return (this.idsCache = Object.freeze(ids));
  }

  /** Every row as a frozen snapshot, in collection order. A result once returned never changes (E4). */
  all(): readonly unknown[] {
    this.host.assertLive();
    if (this.allCache) return this.allCache;
    const rows: unknown[] = [];
    for (let e = this.head; e; e = e.next) rows.push(this.rowSnapshot(e));
    return (this.allCache = Object.freeze(rows));
  }

  /** The row's handle, stable for its lifetime (E1), or undefined. */
  byId(key: EntityKey): object | undefined {
    this.host.assertLive();
    const entity = this.byKey.get(key);
    return entity ? this.rowHandle(entity) : undefined;
  }

  has(key: EntityKey): boolean {
    this.host.assertLive();
    return this.byKey.has(key);
  }

  snapshot(): readonly unknown[] | undefined {
    return this.absent ? undefined : this.all();
  }

  private rowSnapshot(entity: Entity): unknown {
    if (!entity.alive) return undefined;
    if (entity.snapValid) return entity.snap;
    entity.snap = this.host.frozen(entity.row);
    entity.snapValid = true;
    return entity.snap;
  }

  // -------------------------------------------------------------- handles

  private rowHandle(entity: Entity): object {
    if (entity.handle) return entity.handle;
    const methods = { get: () => (this.host.assertLive(), this.rowSnapshot(entity)) };
    const handle = new Proxy(Object.create(null) as object, {
      get: (_target, field) => {
        if (field === 'get' && !(entity.alive && Object.prototype.hasOwnProperty.call(entity.row, field))) return methods.get;
        if (field === 'then' || typeof field === 'symbol') {
          if (!(entity.alive && Object.prototype.hasOwnProperty.call(entity.row, field))) return undefined;
        }
        this.host.assertLive();
        return this.fieldCell(entity, field);
      },
      has: (_target, field) => entity.alive && Object.prototype.hasOwnProperty.call(entity.row, field),
      set: () => {
        throw new SignalTreeError('ST1004', { path: [...this.path, entity.key], detail: 'write a field through its cell, or call updateOne()' });
      },
    });
    entity.handle = handle;
    return handle;
  }

  /** The field's cell, created on first access and stable for the handle (E2). */
  private fieldCell(entity: Entity, field: PropertyKey): object {
    let cell = entity.cells?.get(field);
    if (cell) return cell;
    cell = this.host.adapter.createCell(entity.alive ? entity.row[field] : undefined, this.host.fieldRoute) as object;
    (cell as Record<symbol, unknown>)[NODE] = new FieldRef(this, entity, field);
    this.host.registerCell(cell);
    (entity.cells ??= new Map()).set(field, cell);
    return cell;
  }

  // ---------------------------------------------------------------- writes

  private touch(entity: Entity | null): void {
    if (entity) entity.snapValid = false;
    this.allCache = null;
    this.host.changed(this);
  }

  private touchOrder(): void {
    this.idsCache = null;
    this.touch(null);
  }

  /** Stores a field value and mirrors it into the field's cell, if there is one. */
  private setField(entity: Entity, field: PropertyKey, value: unknown, present: boolean): void {
    if (present) entity.row[field] = value;
    else delete entity.row[field];
    const cell = entity.cells?.get(field);
    if (cell) this.host.adapter.commit(cell as NativeCell<string, unknown>, present ? value : undefined);
  }

  /** Replaces a row's fields with `row`'s; returns the effects of fields that changed. */
  private replaceRow(entity: Entity, row: Record<PropertyKey, unknown>, op: WriteOp | null, merge: boolean): WriteEffect[] {
    const before = entity.row;
    const next: Record<PropertyKey, unknown> = merge ? Object.assign(Object.create(Object.getPrototypeOf(before)), before) : row;
    if (merge) for (const field of Reflect.ownKeys(row)) copyField(next, row, field);
    const effects: WriteEffect[] = [];
    let changed = false;
    const compare = (field: PropertyKey, had: boolean) => {
      const has = Object.prototype.hasOwnProperty.call(next, field);
      const a = before[field];
      const b = next[field];
      if (had === has && Object.is(a, b)) return;
      changed = true;
      const cell = entity.cells?.get(field);
      if (cell) this.host.adapter.commit(cell as NativeCell<string, unknown>, has ? b : undefined);
      if (op) effects.push(effect([...this.path, entity.key, field], a, b, op));
    };
    const beforeKeys = Reflect.ownKeys(before);
    for (let i = 0; i < beforeKeys.length; i++) compare(beforeKeys[i]!, true);
    const nextKeys = Reflect.ownKeys(next);
    for (let i = 0; i < nextKeys.length; i++) if (!Object.prototype.hasOwnProperty.call(before, nextKeys[i]!)) compare(nextKeys[i]!, false);
    if (!changed) return effects;
    entity.row = next;
    this.host.journal(() => {
      entity.row = before;
      entity.snapValid = false;
      for (const [field, cell] of entity.cells ?? []) this.host.adapter.commit(cell as NativeCell<string, unknown>, before[field]);
      this.allCache = null;
      this.host.changed(this);
    });
    this.touch(entity);
    return effects;
  }

  private insert(key: EntityKey, row: Record<PropertyKey, unknown>, op: WriteOp | null, after: Entity | null = this.tail): WriteEffect[] {
    const entity = new Entity(key, row);
    this.link(entity, after);
    this.host.journal(() => {
      this.unlink(entity);
      entity.alive = false;
      this.touchOrder();
    });
    this.touchOrder();
    return op ? [effect([...this.path, key], undefined, this.rowSnapshot(entity), op)] : [];
  }

  private drop(entity: Entity, op: WriteOp | null): WriteEffect[] {
    const before = op ? this.rowSnapshot(entity) : undefined;
    const prev = entity.prev;
    this.unlink(entity);
    entity.alive = false;
    for (const cell of entity.cells?.values() ?? []) this.host.adapter.commit(cell as NativeCell<string, unknown>, undefined);
    this.host.journal(() => {
      entity.alive = true;
      this.link(entity, prev && prev.alive ? prev : null);
      for (const [field, cell] of entity.cells ?? []) this.host.adapter.commit(cell as NativeCell<string, unknown>, entity.row[field]);
      this.touchOrder();
    });
    this.touchOrder();
    return op ? [effect([...this.path, entity.key], before, undefined, op)] : [];
  }

  private rekey(entity: Entity, key: EntityKey, op: WriteOp | null): WriteEffect[] {
    const from = entity.key;
    this.byKey.delete(from);
    entity.key = key;
    this.byKey.set(key, entity);
    this.host.journal(() => {
      this.byKey.delete(key);
      entity.key = from;
      this.byKey.set(from, entity);
      this.touchOrder();
    });
    this.touchOrder();
    if (!op) return [];
    const snap = this.rowSnapshot(entity);
    return [effect([...this.path, from], snap, undefined, op), effect([...this.path, key], undefined, snap, op)];
  }

  private run(kind: WriteKind, payload: unknown, apply: (payload: unknown, op: WriteOp | null) => readonly WriteEffect[]): void {
    this.assertPresent();
    this.host.write(this, kind, payload, apply);
  }

  addOne(row: unknown): void {
    this.addMany([row]);
  }

  addMany(rows: readonly unknown[]): void {
    this.run('insert', rows, (payload, op) => {
      const prepared = this.prepareRows(payload, true);
      const effects: WriteEffect[] = [];
      for (const [key, row] of prepared) effects.push(...this.insert(key, row, op));
      return effects;
    });
  }

  /** Replaces the collection: rows keep their lifetime when their key stays; the order becomes the input's (E4). */
  setAll(rows: readonly unknown[], options?: SetAllOptions): void | Promise<void> {
    if (options?.chunk !== undefined) return this.setAllChunked(rows, options.chunk);
    this.run('set', rows, (payload, op) => this.applySetAll(this.prepareRows(payload, false), op));
  }

  /**
   * setAll in chunks that yield between them (W4). Every row is checked and
   * copied first, so a bad row rejects before anything changes. Then rows
   * missing from the input are removed, the input rows are written, and the
   * order becomes the input's; each chunk is one turn under the writer
   * context captured when setAll was called. Rows another writer adds
   * meanwhile are kept, after the input rows.
   */
  private async setAllChunked(rows: readonly unknown[], chunk: 'auto' | number): Promise<void> {
    this.assertPresent();
    if (chunk !== 'auto' && !(Number.isInteger(chunk) && chunk > 0)) throw new SignalTreeError('ST1006', { path: this.path, detail: "chunk is 'auto' or a positive whole number of rows" });
    if (!Array.isArray(rows)) throw new SignalTreeError('ST1013', { path: this.path, detail: 'expected an array of rows' });
    const run = this.host.capture();
    const input = rows.slice();
    // Only rows that exist now may be removed; rows other writers add while this runs stay.
    const existing = this.order();
    const prepared: [EntityKey, Record<PropertyKey, unknown>][] = new Array(input.length);
    const incoming = new Set<EntityKey>();
    await chunks(input.length, chunk, (start, stop) => {
      this.host.assertLive();
      let i = start;
      do {
        const row = this.prepareRow(input[i]);
        const key = this.selectId(row);
        if (incoming.has(key)) throw new SignalTreeRefusal('ST1010', { path: this.path, key });
        incoming.add(key);
        prepared[i] = [key, row];
        i++;
      } while (i < input.length && !stop(i));
      return i;
    });
    const leaving = existing.filter((entity) => entity.alive && !incoming.has(entity.key));
    await chunks(leaving.length, chunk, (start, stop) => {
      let i = start;
      run(() =>
        this.run('remove', leaving, (_payload, op) => {
          const effects: WriteEffect[] = [];
          do {
            const entity = leaving[i]!;
            if (entity.alive) effects.push(...this.drop(entity, op));
            i++;
          } while (i < leaving.length && !stop(i));
          return effects;
        }),
      );
      return i;
    });
    await chunks(prepared.length, chunk, (start, stop) => {
      let i = start;
      run(() =>
        this.run('insert', prepared, (_payload, op) => {
          const effects: WriteEffect[] = [];
          do {
            const [key, row] = prepared[i]!;
            const existing = this.byKey.get(key);
            effects.push(...(existing ? this.replaceRow(existing, row, op, false) : this.insert(key, row, op)));
            i++;
          } while (i < prepared.length && !stop(i));
          return effects;
        }),
      );
      return i;
    });
    run(() =>
      this.run('set', prepared, () => {
        const current = this.order();
        const ordered: Entity[] = [];
        for (const [key] of prepared) {
          const entity = this.byKey.get(key);
          if (entity) ordered.push(entity);
        }
        for (const entity of current) if (!incoming.has(entity.key)) ordered.push(entity);
        if (ordered.every((entity, i) => current[i] === entity)) return [];
        this.restoreOrder(ordered);
        this.host.journal(() => {
          this.restoreOrder(current);
          this.touchOrder();
        });
        this.touchOrder();
        return [];
      }),
    );
  }

  /** @internal setAll on prepared rows, also used by a whole-value write to the parent branch. */
  applySetAll(prepared: [EntityKey, Record<PropertyKey, unknown>][], op: WriteOp | null): WriteEffect[] {
    const effects: WriteEffect[] = [];
    const incoming = new Set(prepared.map(([key]) => key));
    for (const entity of this.order()) if (!incoming.has(entity.key)) effects.push(...this.drop(entity, op));
    const ordered: Entity[] = [];
    for (const [key, row] of prepared) {
      const existing = this.byKey.get(key);
      if (existing) {
        effects.push(...this.replaceRow(existing, row, op, false));
        ordered.push(existing);
      } else {
        effects.push(...this.insert(key, row, op));
        ordered.push(this.byKey.get(key)!);
      }
    }
    const current = this.order();
    if (ordered.some((entity, i) => current[i] !== entity)) {
      this.restoreOrder(ordered);
      this.host.journal(() => {
        this.restoreOrder(current);
        this.touchOrder();
      });
      this.touchOrder();
    }
    return effects;
  }

  clear(): void {
    this.run('remove', undefined, (_payload, op) => {
      const effects: WriteEffect[] = [];
      for (const entity of this.order()) effects.push(...this.drop(entity, op));
      return effects;
    });
  }

  updateOne(id: EntityKey, changes: unknown): void {
    this.updateMany([{ id, changes }]);
  }

  updateMany(updates: readonly { readonly id: EntityKey; readonly changes: unknown }[]): void {
    this.run('update', updates, (payload, op) => {
      const plan = this.planUpdates(payload);
      const effects: WriteEffect[] = [];
      for (const [entity, row, key] of plan) {
        if (key !== entity.key) effects.push(...this.rekey(entity, key, op));
        effects.push(...this.replaceRow(entity, row, op, true));
      }
      return effects;
    });
  }

  /** Checks every update before any is applied (E3); a key change onto an occupied key refuses. */
  private planUpdates(payload: unknown): [Entity, Record<PropertyKey, unknown>, EntityKey][] {
    if (!Array.isArray(payload)) throw new SignalTreeError('ST1013', { path: this.path, detail: 'expected an array of updates' });
    const seen = new Set<EntityKey>();
    const plan: [Entity, Record<PropertyKey, unknown>, EntityKey][] = [];
    for (const update of payload as { id: EntityKey; changes: unknown }[]) {
      const entity = this.entity(update?.id);
      if (seen.has(entity.key)) throw new SignalTreeRefusal('ST1010', { path: this.path, key: entity.key });
      seen.add(entity.key);
      if (!this.host.isPlainObject(update.changes)) throw new SignalTreeRefusal('ST1013', { path: this.path, key: entity.key, detail: 'changes must be a plain object' });
      const changes = this.host.copy(update.changes, [...this.path, entity.key]) as Record<PropertyKey, unknown>;
      const merged: Record<PropertyKey, unknown> = Object.assign(Object.create(Object.getPrototypeOf(entity.row)), entity.row);
      for (const field of Reflect.ownKeys(changes)) copyField(merged, changes, field);
      const key = this.selectId(merged);
      plan.push([entity, changes, key]);
    }
    const leaving = new Set(plan.filter(([entity, , key]) => key !== entity.key).map(([entity]) => entity.key));
    const arriving = new Set<EntityKey>();
    for (const [entity, , key] of plan) {
      if (key === entity.key) continue;
      if ((this.byKey.has(key) && !leaving.has(key)) || arriving.has(key)) throw new SignalTreeRefusal('ST1010', { path: this.path, key });
      arriving.add(key);
    }
    return plan;
  }

  upsertOne(row: unknown): void {
    this.upsertMany([row]);
  }

  upsertMany(rows: readonly unknown[]): void {
    this.run('insert', rows, (payload, op) => {
      const prepared = this.prepareRows(payload, false);
      const effects: WriteEffect[] = [];
      for (const [key, row] of prepared) {
        const existing = this.byKey.get(key);
        effects.push(...(existing ? this.replaceRow(existing, row, op, true) : this.insert(key, row, op)));
      }
      return effects;
    });
  }

  removeOne(id: EntityKey): void {
    this.removeMany([id]);
  }

  removeMany(ids: readonly EntityKey[]): void {
    this.run('remove', ids, (payload, op) => {
      if (!Array.isArray(payload)) throw new SignalTreeError('ST1013', { path: this.path, detail: 'expected an array of keys' });
      const seen = new Set<EntityKey>();
      const entities = (payload as EntityKey[]).map((id) => {
        const entity = this.entity(id);
        if (seen.has(id)) throw new SignalTreeRefusal('ST1010', { path: this.path, key: id });
        seen.add(id);
        return entity;
      });
      const effects: WriteEffect[] = [];
      for (const entity of entities) effects.push(...this.drop(entity, op));
      return effects;
    });
  }

  /** Changes a row's id field, keeping its lifetime and position (E1, E4). Only with the default selector. */
  changeId(from: EntityKey, to: EntityKey): void {
    if (this.selector !== null) throw new SignalTreeError('ST1014', { path: this.path });
    this.assertPresent();
    if (to === null || to === undefined) throw new SignalTreeRefusal('ST1012', { path: this.path });
    const entity = this.entity(from);
    if (from === to) return;
    if (this.byKey.has(to)) throw new SignalTreeRefusal('ST1010', { path: this.path, key: to });
    this.run('changeId', { from, to }, (payload, op) => {
      const { to: key } = payload as { to: EntityKey };
      if (this.byKey.has(key) && this.byKey.get(key) !== entity) throw new SignalTreeRefusal('ST1010', { path: this.path, key });
      return [...this.rekey(entity, key, op), ...this.replaceRow(entity, { [DEFAULT_ID]: key }, op, true)];
    });
  }

  /** A write through a field cell: one update of that row (a key change when it changes selectId's result). */
  writeField(ref: FieldRef, value: unknown): void {
    this.host.assertLive();
    const entity = ref.entity;
    if (!entity.alive) throw new SignalTreeRefusal('ST1004', { path: [...this.path, entity.key, ref.field], detail: 'the row has been removed' });
    const present = Object.prototype.hasOwnProperty.call(entity.row, ref.field);
    if (present && Object.is(entity.row[ref.field], value) && (typeof value !== 'object' || value === null)) return;
    this.updateOne(entity.key, { [ref.field]: value });
  }

  // ------------------------------------------------- whole-value writes (V1)

  /** Checks a value a whole-value parent write would give this collection, before anything changes. */
  prepareWhole(value: unknown, present: boolean): [EntityKey, Record<PropertyKey, unknown>][] | null {
    if (!present) return null;
    if (!Array.isArray(value)) throw new SignalTreeRefusal('ST1013', { path: this.path, detail: 'a collection takes an array of rows' });
    return this.prepareRows(value, false);
  }

  applyWhole(prepared: [EntityKey, Record<PropertyKey, unknown>][] | null): void {
    const wasAbsent = this.absent;
    if (prepared === null) {
      for (const entity of this.order()) this.drop(entity, null);
      this.absent = true;
    } else {
      this.absent = false;
      this.applySetAll(prepared, null);
    }
    if (wasAbsent !== this.absent) {
      this.host.journal(() => {
        this.absent = wasAbsent;
        this.touchOrder();
      });
      this.touchOrder();
    }
  }
}

export interface SetAllOptions {
  /** 'auto' sizes chunks to a few milliseconds of work; a number sets the rows per chunk. */
  readonly chunk: 'auto' | number;
}

/** Milliseconds of work an 'auto' chunk aims for: at 4× CPU throttle, with garbage collection on top, still under a 50 ms long task. */
const SLICE_MS = 5;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Lets the host run other work between chunks. */
function yieldToHost(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === 'function') return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Runs `body` over [0, total) in chunks, yielding between them. `body` gets the
 * first index and a `stop(i)` test, does at least one item, and returns the
 * next index.
 */
async function chunks(total: number, size: 'auto' | number, body: (start: number, stop: (i: number) => boolean) => number): Promise<void> {
  let index = 0;
  while (index < total) {
    const started = now();
    const limit = size === 'auto' ? Infinity : index + size;
    const stop = size === 'auto' ? (i: number) => (i & 31) === 0 && now() - started >= SLICE_MS : (i: number) => i >= limit;
    index = body(index, stop);
    if (index < total) await yieldToHost();
  }
}

function copyField(target: Record<PropertyKey, unknown>, source: Record<PropertyKey, unknown>, field: PropertyKey): void {
  const descriptor = Object.getOwnPropertyDescriptor(source, field)!;
  Object.defineProperty(target, field, { value: descriptor.value, enumerable: descriptor.enumerable ?? true, writable: true, configurable: true });
}

function effect(location: PathSegment[], before: unknown, after: unknown, op: WriteOp): WriteEffect {
  return Object.freeze({ location: Object.freeze(location), before, after, changed: true, context: op.context });
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
