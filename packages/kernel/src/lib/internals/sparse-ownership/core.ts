import { deepClone } from "../utilities/deep-clone";
import { deepEqual } from "../utilities/deep-equal";
import type { TerminalRecordPlan } from "../intrinsic-mutation";
import { createMapTools, type SparseMap } from "./persistent-map";

const ABSENT = Symbol("sparse-absent");
const refBrand = Symbol("sparse-ref"),
  ownerBrand = Symbol("sparse-owner");
export type SparseKey = string | number;
export type SparsePath = readonly SparseKey[];
export interface SparseRef {
  readonly [refBrand]: true;
}
export interface SparseOwner {
  readonly [ownerBrand]: true;
}
export type SparseOperation =
  | {
      readonly kind: "set";
      readonly path: SparsePath;
      readonly value: unknown;
      readonly present?: boolean;
    }
  | {
      readonly kind: "add";
      readonly ref: SparseRef;
      readonly collection: SparseKey;
      readonly key: SparseKey;
      readonly fields: Readonly<Record<string, unknown>>;
      readonly rank: number;
    }
  | {
      readonly kind: "field";
      readonly ref: SparseRef;
      readonly field: string;
      readonly value: unknown;
    }
  | {
      readonly kind: "delete-field";
      readonly ref: SparseRef;
      readonly field: string;
    }
  | { readonly kind: "rank"; readonly ref: SparseRef; readonly rank: number }
  | { readonly kind: "rekey"; readonly ref: SparseRef; readonly key: SparseKey }
  | { readonly kind: "remove"; readonly ref: SparseRef };
export interface SparseEntityView {
  readonly ref: SparseRef;
  readonly collection: SparseKey;
  readonly key: SparseKey;
  readonly rank: number;
  readonly fields: Readonly<Record<string, unknown>>;
}
export interface SparseEntityChange {
  readonly id: number;
  readonly ref: SparseRef;
  readonly before: SparseEntityView | null;
  readonly after: SparseEntityView | null;
  readonly beforeRef?: SparseRef;
  readonly afterRef?: SparseRef;
  readonly topology: boolean;
  readonly orderChanged: boolean;
}
export type SparseDisposition =
  | "pending"
  | "superseded"
  | "committed"
  | "rejected";
export interface SparseState {
  readonly status: "pending" | "accepted" | "rejected";
  readonly authority: boolean;
  readonly dispositions: readonly SparseDisposition[];
}
export interface SparsePrepared extends TerminalRecordPlan {
  readonly base: object;
  readonly checkpoint: { readonly root: object };
  readonly targets: readonly {
    readonly path: SparsePath;
    readonly value: unknown;
    readonly present: boolean;
  }[];
  readonly entityChanges: readonly SparseEntityChange[];
  readonly affectedRefs: readonly SparseRef[];
}
export type SparseSettlement =
  | SparsePrepared
  | { readonly status: "already-settled" }
  | { readonly status: "refused"; readonly reason: string };
export type SparseFault = (
  stage: string,
  detail: Readonly<Record<string, unknown>>
) => void;
interface Patch {
  readonly seq: number;
  readonly value: unknown;
  readonly owner: number | null;
}
interface Cell {
  readonly kind: "scalar" | "presence" | "key" | "field" | "rank";
  readonly path?: SparsePath;
  readonly entity?: number;
  readonly name?: string;
  readonly committed: Patch | null;
  readonly pending: SparseMap<Patch>;
}
interface Entity {
  readonly id: number;
  readonly ref: SparseRef;
  readonly collection: SparseKey;
  readonly fields: SparseMap<string>;
  readonly pendingCount: number;
}
interface Group {
  readonly kind: SparseOperation["kind"];
  readonly seq: number;
  readonly keys: readonly string[];
  readonly entity?: number;
}
interface Owner {
  readonly id: number;
  readonly groups: SparseMap<Group>;
}
interface Dependency {
  readonly key: string;
  readonly seq: number;
}
interface Root {
  cells: SparseMap<Cell>;
  scalars: SparseMap<SparsePath>;
  entities: SparseMap<Entity>;
  occupancy: SparseMap<number>;
  dependencies: SparseMap<SparseMap<Dependency>>;
  owners: SparseMap<Owner>;
  ordering: SparseMap<SparseMap<number>>;
  pendingRecords: number;
  dependencyRecords: number;
  fieldRecords: number;
  groupRecords: number;
}
interface RefRecord {
  readonly id: number;
  readonly used: Map<string, boolean>;
}
interface OwnerRecord {
  readonly id: number;
  readonly terminal: Map<string, SparseState>;
}
interface Draft {
  r: Root;
  readonly affected: Set<number>;
  readonly touched: Set<string>;
  readonly newRefs: RefRecord[];
}
class Conflict extends Error {}
const clone = <T>(value: T): T => (value === ABSENT ? value : deepClone(value));
const order = (n: number): string => String(n).padStart(20, "0");
function keyOf(value: SparseKey): string {
  if (
    typeof value !== "string" &&
    !(typeof value === "number" && Number.isFinite(value))
  )
    throw Error("Invalid semantic key");
  return JSON.stringify([typeof value, value]);
}
function pathOf(path: SparsePath): string {
  if (!path.length) throw Error("Empty semantic path");
  return JSON.stringify(path.map(keyOf));
}
function asKey(value: unknown): SparseKey {
  if (typeof value !== "string" && typeof value !== "number")
    throw Error("Invalid stored semantic key");
  keyOf(value);
  return value;
}
function rankKey(rank: number, id: number): string {
  if (!Number.isSafeInteger(rank) || Math.abs(rank) > 2251799813685247)
    throw Error("Ordering rank exhausted");
  return `${String(rank + 4503599627370496).padStart(16, "0")}:${order(id)}`;
}
const emptyRoot = (): Root => ({
  cells: null,
  scalars: null,
  entities: null,
  occupancy: null,
  dependencies: null,
  owners: null,
  ordering: null,
  pendingRecords: 0,
  dependencyRecords: 0,
  fieldRecords: 0,
  groupRecords: 0,
});
const counterNames = [
  "mapNodeVisits",
  "mapNodeAllocations",
  "affectedCells",
  "visitedLiveRecords",
  "dependencyEdits",
  "occupancyEdits",
  "snapshotScalarVisits",
  "snapshotEntityVisits",
  "ownerGroupCopies",
  "ownerGroupAppends",
  "operationCheckpoints",
  "checkpointValidations",
] as const;
type Counter = (typeof counterNames)[number];

/** One indexed ownership root. Native installation pairs its root write with physical state. */
export function createSparseOwnership(
  options: { readonly fault?: SparseFault | null } = {}
) {
  const work: Record<Counter, number> = {
    mapNodeVisits: 0,
    mapNodeAllocations: 0,
    affectedCells: 0,
    visitedLiveRecords: 0,
    dependencyEdits: 0,
    occupancyEdits: 0,
    snapshotScalarVisits: 0,
    snapshotEntityVisits: 0,
    ownerGroupCopies: 0,
    ownerGroupAppends: 0,
    operationCheckpoints: 0,
    checkpointValidations: 0,
  };
  const map = createMapTools((k) => work[k]++);
  const tokens = new WeakMap<SparseRef, RefRecord>(),
    handles = new WeakMap<SparseOwner, OwnerRecord>();
  const installed = new Map<string, Root>([["state", emptyRoot()]]);
  let seq = 0,
    refSeq = 0,
    ownerSeq = 0,
    destroyed = false,
    planning = false,
    fault = options.fault ?? null;
  const root = (): Root => {
    const r = installed.get("state");
    if (!r) throw Error("Missing ownership root");
    return r;
  };
  const alive = (mutating = false): void => {
    if (destroyed) throw Error("Ownership destroyed");
    if (mutating && planning)
      throw Error("Mutation during ownership preparation");
  };
  const hook = (
    stage: string,
    detail: Readonly<Record<string, unknown>>
  ): void => {
    fault?.(stage, detail);
  };
  const makeRef = (): SparseRef => {
    alive(true);
    const ref: SparseRef = Object.freeze<SparseRef>({ [refBrand]: true });
    tokens.set(ref, { id: ++refSeq, used: new Map() });
    return ref;
  };
  const idOf = (ref: SparseRef): number => {
    const rec = tokens.get(ref);
    if (!rec) throw new Conflict("Foreign lifetime");
    return rec.id;
  };
  const entityAt = (r: Root, id: number): Entity | undefined => {
    work.visitedLiveRecords++;
    return map.get(r.entities, order(id));
  };
  const requireEntity = (r: Root, id: number): Entity => {
    const e = entityAt(r, id);
    if (!e) throw Error("Missing indexed entity");
    return e;
  };
  const cellAt = (r: Root, key: string): Cell | undefined =>
    map.get(r.cells, key);
  const winner = (c: Cell | undefined): Patch => {
    if (!c) return { value: ABSENT, seq: -Infinity, owner: null };
    const p = map.last(c.pending);
    return p && (!c.committed || p.seq > c.committed.seq)
      ? p
      : c.committed ?? { value: ABSENT, seq: -Infinity, owner: null };
  };
  const pkey = (id: number): string => `E${order(id)}:P`,
    kkey = (id: number): string => `E${order(id)}:K`,
    rkey = (id: number): string => `E${order(id)}:R`,
    fkey = (id: number, name: string): string =>
      `E${order(id)}:F${JSON.stringify(name)}`;
  const presence = (r: Root, id: number): Patch => winner(cellAt(r, pkey(id)));
  const location = (r: Root, id: number): unknown =>
    presence(r, id).value === true ? winner(cellAt(r, kkey(id))).value : ABSENT;
  const entityRank = (r: Root, id: number): number | undefined => {
    const v = winner(cellAt(r, rkey(id))).value;
    if (v === ABSENT) return undefined;
    if (typeof v !== "number") throw Error("Invalid indexed rank");
    return v;
  };
  const occupancyKey = (collection: SparseKey, key: SparseKey): string =>
    JSON.stringify([keyOf(collection), keyOf(key)]);
  const depKey = (key: string, w: Patch): string => `${order(w.seq)}:${key}`;
  const transaction = (): Draft => ({
    r: { ...root() },
    affected: new Set(),
    touched: new Set(),
    newRefs: [],
  });
  function stageCell(t: Draft, key: string, c: Cell): void {
    const prior = cellAt(t.r, key),
      before = winner(prior),
      after = winner(c);
    t.r.pendingRecords += map.size(c.pending) - map.size(prior?.pending);
    t.r.cells = map.set(t.r.cells, key, c);
    work.affectedCells++;
    hook("cell", { key });
    if (c.entity !== undefined) {
      const id = c.entity;
      t.affected.add(id);
      const e = requireEntity(t.r, id);
      t.r.entities = map.set(t.r.entities, order(id), {
        ...e,
        pendingCount:
          e.pendingCount + map.size(c.pending) - map.size(prior?.pending),
      });
      if (c.kind !== "presence") {
        let deps = map.get(t.r.dependencies, order(id)) ?? null;
        const priorSize = map.size(deps);
        if (before.value !== ABSENT)
          deps = map.remove(deps, depKey(key, before));
        if (after.value !== ABSENT)
          deps = map.set(deps, depKey(key, after), { key, seq: after.seq });
        t.r.dependencies = deps
          ? map.set(t.r.dependencies, order(id), deps)
          : map.remove(t.r.dependencies, order(id));
        t.r.dependencyRecords += map.size(deps) - priorSize;
        work.dependencyEdits++;
        hook("dependency", { entity: id, key });
      }
    }
    t.touched.add(key);
  }
  function finalize(t: Draft): void {
    for (const id of t.affected) {
      const old = location(root(), id);
      if (old !== ABSENT) {
        const e = requireEntity(root(), id),
          key = occupancyKey(e.collection, asKey(old));
        if (map.get(t.r.occupancy, key) === id)
          t.r.occupancy = map.remove(t.r.occupancy, key);
        work.occupancyEdits++;
        hook("occupancy", { entity: id, action: "remove" });
      }
    }
    for (const id of t.affected) {
      const now = location(t.r, id),
        present = presence(t.r, id);
      if (now !== ABSENT) {
        const e = requireEntity(t.r, id),
          key = occupancyKey(e.collection, asKey(now)),
          occupied = map.get(t.r.occupancy, key);
        if (occupied !== undefined && occupied !== id)
          throw new Conflict("Business key occupied");
        t.r.occupancy = map.set(t.r.occupancy, key, id);
        work.occupancyEdits++;
        hook("occupancy", { entity: id, action: "install" });
      } else {
        const dep = map.last(map.get(t.r.dependencies, order(id)) ?? null);
        if (dep && dep.seq > present.seq)
          throw new Conflict("Surviving facts require lifetime existence");
      }
    }
    for (const id of t.affected) {
      const e = entityAt(t.r, id) ?? requireEntity(root(), id),
        namespace = keyOf(e.collection),
        oldRank = entityRank(root(), id),
        nextRank = entityRank(t.r, id);
      let index = map.get(t.r.ordering, namespace) ?? null;
      if (presence(root(), id).value === true && oldRank !== undefined) {
        index = map.remove(index, rankKey(oldRank, id));
        hook("ordering", { entity: id, action: "remove" });
      }
      if (presence(t.r, id).value === true && nextRank !== undefined) {
        index = map.set(index, rankKey(nextRank, id), id);
        hook("ordering", { entity: id, action: "install" });
      }
      t.r.ordering = index
        ? map.set(t.r.ordering, namespace, index)
        : map.remove(t.r.ordering, namespace);
    }
    for (const key of t.touched) {
      const c = cellAt(t.r, key);
      if (c && !c.pending && (!c.committed || c.committed.value === ABSENT)) {
        if (c.kind === "scalar") {
          t.r.cells = map.remove(t.r.cells, key);
          t.r.scalars = map.remove(t.r.scalars, key);
        } else if (
          c.kind === "field" &&
          c.entity !== undefined &&
          c.name !== undefined
        ) {
          const e = requireEntity(t.r, c.entity);
          t.r.cells = map.remove(t.r.cells, key);
          t.r.entities = map.set(t.r.entities, order(c.entity), {
            ...e,
            fields: map.remove(e.fields, c.name),
          });
          t.r.fieldRecords--;
          hook("retire", { entity: c.entity, field: c.name });
        }
      }
    }
    for (const id of t.affected) {
      const e = entityAt(t.r, id);
      if (e && presence(t.r, id).value !== true && e.pendingCount === 0) {
        for (const key of [
          pkey(id),
          kkey(id),
          rkey(id),
          ...[...map.entries(e.fields)].map(([, key]) => key),
        ])
          t.r.cells = map.remove(t.r.cells, key);
        t.r.entities = map.remove(t.r.entities, order(id));
        t.r.fieldRecords -= map.size(e.fields);
        t.r.dependencyRecords -= map.size(map.get(t.r.dependencies, order(id)));
        t.r.dependencies = map.remove(t.r.dependencies, order(id));
        hook("retire", { entity: id });
      }
    }
  }
  const freshCell = (
    kind: Cell["kind"],
    extra: Pick<Cell, "entity" | "name" | "path"> = {}
  ): Cell => ({ kind, ...extra, committed: null, pending: null });
  function applyOps(
    t: Draft,
    ops: readonly SparseOperation[],
    owner: number | null
  ): Group[] {
    const groups: Group[] = [];
    for (const op of ops) {
      const authored = ++seq,
        keys: string[] = [];
      let entity: number | undefined;
      const put = (key: string, value: unknown, initial?: Cell): void => {
        const c = cellAt(t.r, key) ?? initial;
        if (!c) throw Error("Missing operation cell");
        const patch: Patch = { seq: authored, value: clone(value), owner };
        stageCell(
          t,
          key,
          owner === null
            ? { ...c, committed: patch }
            : { ...c, pending: map.set(c.pending, order(authored), patch) }
        );
        keys.push(key);
      };
      if (op.kind === "set") {
        const key = `S${pathOf(op.path)}`;
        if (!cellAt(t.r, key))
          t.r.scalars = map.set(t.r.scalars, key, [...op.path]);
        put(
          key,
          op.present === false ? ABSENT : op.value,
          freshCell("scalar", { path: [...op.path] })
        );
      } else if (op.kind === "add") {
        const id = idOf(op.ref),
          record = tokens.get(op.ref);
        if (!record || record.used.get("used") || entityAt(t.r, id))
          throw new Conflict("Lifetime already installed or retired");
        keyOf(op.collection);
        keyOf(op.key);
        rankKey(op.rank, id);
        t.newRefs.push(record);
        entity = id;
        t.r.entities = map.set(t.r.entities, order(id), {
          id,
          ref: op.ref,
          collection: op.collection,
          fields: null,
          pendingCount: 0,
        });
        t.affected.add(id);
        put(pkey(id), true, freshCell("presence", { entity: id }));
        put(kkey(id), op.key, freshCell("key", { entity: id }));
        put(rkey(id), op.rank, freshCell("rank", { entity: id }));
        for (const [name, value] of Object.entries(op.fields)) {
          const key = fkey(id, name),
            current = requireEntity(t.r, id);
          t.r.fieldRecords++;
          t.r.entities = map.set(t.r.entities, order(id), {
            ...current,
            fields: map.set(current.fields, name, key),
          });
          put(key, value, freshCell("field", { entity: id, name }));
        }
      } else {
        const id = idOf(op.ref),
          e = entityAt(t.r, id);
        if (!e || presence(t.r, id).value !== true)
          throw new Conflict("Referenced lifetime is absent");
        entity = id;
        if (op.kind === "remove") put(pkey(id), false);
        else if (op.kind === "rekey") {
          keyOf(op.key);
          put(kkey(id), op.key);
        } else if (op.kind === "rank") {
          rankKey(op.rank, id);
          put(rkey(id), op.rank);
        } else {
          const key = fkey(id, op.field);
          if (!map.get(e.fields, op.field)) {
            t.r.fieldRecords++;
            t.r.entities = map.set(t.r.entities, order(id), {
              ...e,
              fields: map.set(e.fields, op.field, key),
            });
          }
          put(
            key,
            op.kind === "delete-field" ? ABSENT : op.value,
            freshCell("field", { entity: id, name: op.field })
          );
        }
      }
      groups.push({ kind: op.kind, seq: authored, keys, entity });
    }
    return groups;
  }
  function entityView(r: Root, id: number): SparseEntityView | null {
    const e = entityAt(r, id);
    if (!e || presence(r, id).value !== true) return null;
    const fields: Record<string, unknown> = {};
    for (const [name, key] of map.entries(e.fields)) {
      const w = winner(cellAt(r, key));
      if (w.value !== ABSENT)
        Object.defineProperty(fields, name, {
          value: clone(w.value),
          enumerable: true,
          writable: true,
          configurable: true,
        });
    }
    const rank = entityRank(r, id);
    if (rank === undefined) throw Error("Live lifetime has no ordering rank");
    return {
      ref: e.ref,
      collection: e.collection,
      key: asKey(location(r, id)),
      rank,
      fields,
    };
  }
  function exportPrepared(
    t: Draft,
    extra: TerminalRecordPlan["writes"] = []
  ): SparsePrepared {
    finalize(t);
    hook("precommit", {});
    const targets: SparsePrepared["targets"][number][] = [];
    for (const key of t.touched) {
      const c = cellAt(t.r, key) ?? cellAt(root(), key);
      if (c?.kind !== "scalar" || !c.path) continue;
      const w = winner(cellAt(t.r, key));
      targets.push({
        path: [...c.path],
        value: w.value === ABSENT ? undefined : clone(w.value),
        present: w.value !== ABSENT,
      });
    }
    const changed = new Map<
      number,
      { topology: boolean; orderChanged: boolean }
    >();
    for (const key of t.touched) {
      const c = cellAt(t.r, key) ?? cellAt(root(), key);
      if (
        c?.entity === undefined ||
        deepEqual(
          winner(cellAt(t.r, key)).value,
          winner(cellAt(root(), key)).value
        )
      )
        continue;
      const flags = changed.get(c.entity) ?? {
        topology: false,
        orderChanged: false,
      };
      flags.topology ||= c.kind !== "field";
      flags.orderChanged ||=
        c.kind === "rank" &&
        presence(root(), c.entity).value === true &&
        presence(t.r, c.entity).value === true;
      changed.set(c.entity, flags);
    }
    const entityChanges: SparseEntityChange[] = [];
    for (const [id, flags] of changed) {
      const before = entityView(root(), id),
        after = entityView(t.r, id),
        e = entityAt(t.r, id) ?? requireEntity(root(), id);
      let beforeRef: SparseRef | undefined, afterRef: SparseRef | undefined;
      if (after) {
        const index = map.get(t.r.ordering, keyOf(e.collection)) ?? null,
          key = rankKey(after.rank, id),
          predecessor = map.neighbor(index, key, -1),
          successor = map.neighbor(index, key, 1);
        beforeRef =
          predecessor === undefined
            ? undefined
            : entityAt(t.r, predecessor)?.ref;
        afterRef =
          successor === undefined ? undefined : entityAt(t.r, successor)?.ref;
      }
      entityChanges.push({
        id,
        ref: e.ref,
        before,
        after,
        beforeRef,
        afterRef,
        ...flags,
      });
    }
    const affectedRefs: SparseRef[] = [];
    for (const id of t.affected) {
      const e = entityAt(t.r, id) ?? entityAt(root(), id);
      if (e) affectedRefs.push(e.ref);
    }
    work.operationCheckpoints++;
    const base = root();
    return {
      base,
      checkpoint: Object.freeze({ root: base }),
      targets,
      entityChanges,
      affectedRefs,
      writes: [
        { map: installed, key: "state", value: t.r },
        ...t.newRefs.map((rec) => ({
          map: rec.used,
          key: "used",
          value: true,
        })),
        ...extra,
      ],
      adds: [],
    };
  }
  function groupIndex(
    groups: readonly Group[],
    prior: SparseMap<Group> = null
  ): SparseMap<Group> {
    let index = prior;
    for (const g of groups) {
      index = map.set(index, order(g.seq), g);
      work.ownerGroupAppends++;
    }
    return index;
  }
  function disposition(r: Root, g: Group): "superseded" | undefined {
    const death =
      g.entity === undefined ? undefined : cellAt(r, pkey(g.entity))?.committed;
    if (death?.value === false && death.seq > g.seq) return "superseded";
    return g.keys.some(
      (key) => (cellAt(r, key)?.committed?.seq ?? -Infinity) > g.seq
    )
      ? "superseded"
      : undefined;
  }
  function openOwner(): SparseOwner {
    alive(true);
    planning = true;
    try {
      const t = transaction(),
        id = ++ownerSeq,
        handle: SparseOwner = Object.freeze<SparseOwner>({
          [ownerBrand]: true,
        });
      t.r.owners = map.set(t.r.owners, order(id), { id, groups: null });
      hook("owner", { id, action: "open" });
      hook("precommit", {});
      handles.set(handle, { id, terminal: new Map() });
      installed.set("state", t.r);
      return handle;
    } finally {
      planning = false;
    }
  }
  function prepareScalarWrite(
    handle: SparseOwner | null,
    ops: readonly SparseOperation[]
  ): SparsePrepared {
    alive(true);
    planning = true;
    try {
      const t = transaction();
      let owner: Owner | undefined;
      if (handle) {
        const rec = handles.get(handle);
        if (!rec || rec.terminal.has("state")) throw Error("Owner not open");
        owner = map.get(root().owners, order(rec.id));
        if (!owner) throw Error("Owner not installed");
      }
      const groups = applyOps(t, ops, owner?.id ?? null);
      if (owner) {
        t.r.owners = map.set(t.r.owners, order(owner.id), {
          id: owner.id,
          groups: groupIndex(groups, owner.groups),
        });
        t.r.groupRecords += groups.length;
        hook("owner", { id: owner.id, action: "append" });
      }
      return exportPrepared(t);
    } finally {
      planning = false;
    }
  }
  function prepareSettlement(
    handle: SparseOwner,
    decision: "accept" | "reject"
  ): SparseSettlement {
    alive(true);
    const rec = handles.get(handle);
    if (!rec) throw Error("Foreign handle");
    if (rec.terminal.has("state")) return { status: "already-settled" };
    const owner = map.get(root().owners, order(rec.id));
    if (!owner) throw Error("Missing active owner");
    planning = true;
    try {
      const t = transaction();
      for (const [, g] of map.entries(owner.groups))
        for (const key of g.keys) {
          const c = cellAt(t.r, key);
          if (!c) throw Error("Missing owned cell");
          const patch = map.get(c.pending, order(g.seq));
          if (!patch) throw Error("Missing ownership patch");
          const next: Cell = {
            ...c,
            pending: map.remove(c.pending, order(g.seq)),
            committed:
              decision === "accept" &&
              (!c.committed || patch.seq > c.committed.seq)
                ? { ...patch, owner: null }
                : c.committed,
          };
          stageCell(t, key, next);
        }
      t.r.owners = map.remove(t.r.owners, order(rec.id));
      t.r.groupRecords -= map.size(owner.groups);
      hook("owner", { id: rec.id, action: "retire" });
      hook("retire", { owner: rec.id });
      const summary: SparseState = {
        status: decision === "accept" ? "accepted" : "rejected",
        authority: false,
        dispositions: [...map.entries(owner.groups)].map(
          ([, g]) =>
            disposition(t.r, g) ??
            (decision === "accept" ? "committed" : "rejected")
        ),
      };
      return exportPrepared(t, [
        { map: rec.terminal, key: "state", value: summary },
      ]);
    } catch (error) {
      if (error instanceof Conflict)
        return { status: "refused", reason: error.message };
      throw error;
    } finally {
      planning = false;
    }
  }
  function assertPrepared(plan: SparsePrepared): void {
    alive(true);
    work.checkpointValidations++;
    if (plan.checkpoint.root !== plan.base || plan.base !== root())
      throw Error("Prepared sparse root is stale");
  }
  function installPrepared(plan: SparsePrepared): void {
    assertPrepared(plan);
    for (const w of plan.writes) w.map.set(w.key, w.value);
    for (const a of plan.adds) a.set.add(a.value);
  }
  function state(handle: SparseOwner): SparseState {
    alive();
    const rec = handles.get(handle);
    if (!rec) throw Error("Foreign handle");
    const summary = rec.terminal.get("state");
    if (summary) return clone(summary);
    const owner = map.get(root().owners, order(rec.id));
    if (!owner) throw Error("Missing pending owner");
    return {
      status: "pending",
      authority: true,
      dispositions: [...map.entries(owner.groups)].map(
        ([, g]) => disposition(root(), g) ?? "pending"
      ),
    };
  }
  function obligation(ref: SparseRef) {
    alive();
    const id = idOf(ref),
      e = entityAt(root(), id);
    return {
      retained: !!e,
      pendingPatches: e?.pendingCount ?? 0,
      present: !!e && presence(root(), id).value === true,
    };
  }
  function stats() {
    alive();
    const r = root();
    return {
      active: map.size(r.owners),
      locations: map.size(r.cells),
      entityRecords: map.size(r.entities),
      occupancyRecords: map.size(r.occupancy),
      dependencyEntities: map.size(r.dependencies),
      orderingCollections: map.size(r.ordering),
      pendingPatches: r.pendingRecords,
      dependencyRecords: r.dependencyRecords,
      fieldRecords: r.fieldRecords,
      operationGroups: r.groupRecords,
    };
  }
  function inspect() {
    alive();
    const r = root();
    map.validate(r.cells);
    map.validate(r.scalars);
    map.validate(r.entities);
    map.validate(r.occupancy);
    map.validate(r.dependencies);
    map.validate(r.owners);
    map.validate(r.ordering);
    for (const [, c] of map.entries(r.cells)) map.validate(c.pending);
    for (const [, e] of map.entries(r.entities)) map.validate(e.fields);
    for (const [, o] of map.entries(r.owners)) map.validate(o.groups);
    for (const [, d] of map.entries(r.dependencies)) map.validate(d);
    for (const [, o] of map.entries(r.ordering)) map.validate(o);
    return clone({
      cells: [...map.entries(r.cells)],
      owners: [...map.entries(r.owners)],
      entities: [...map.entries(r.entities)],
      occupancy: [...map.entries(r.occupancy)],
      dependencies: [...map.entries(r.dependencies)],
      ordering: [...map.entries(r.ordering)],
    });
  }
  function read() {
    alive();
    const values: Array<{ path: SparsePath; value: unknown }> = [],
      entities: SparseEntityView[] = [];
    for (const [key, path] of map.entries(root().scalars)) {
      work.snapshotScalarVisits++;
      const w = winner(cellAt(root(), key));
      if (w.value !== ABSENT)
        values.push({ path: [...path], value: clone(w.value) });
    }
    for (const [, e] of map.entries(root().entities)) {
      work.snapshotEntityVisits++;
      const view = entityView(root(), e.id);
      if (view) entities.push(view);
    }
    return { values, entities };
  }
  return {
    makeRef,
    openOwner,
    prepareScalarWrite,
    prepareSettlement,
    assertPrepared,
    installPrepared,
    state,
    obligation,
    stats,
    inspect,
    read,
    hasScalar(path: SparsePath) {
      alive();
      return map.get(root().scalars, `S${pathOf(path)}`) !== undefined;
    },
    readPoint(path: SparsePath) {
      alive();
      const value = winner(cellAt(root(), `S${pathOf(path)}`)).value;
      return value === ABSENT ? undefined : clone(value);
    },
    counters: () => ({ ...work }),
    resetCounters() {
      for (const name of counterNames) work[name] = 0;
    },
    setFault(next: SparseFault | null) {
      alive(true);
      fault = next;
    },
    destroy() {
      alive(true);
      installed.set("state", emptyRoot());
      destroyed = true;
    },
  };
}
