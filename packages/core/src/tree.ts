/**
 * The tree: lazy structure over the initial plain state, and the write seam
 * every mutation passes through (BRIEF.md 4.2).
 *
 * Storage. Each scalar leaf that has been accessed is one native cell from the
 * adapter. Branches that have not been read stay plain objects. A branch's
 * members are the own enumerable keys of its `base`; a member that has a node
 * takes its value from the node, any other from `base`.
 *
 * The initial state is read in place and never mutated: a branch's `base` is
 * copied the first time the branch's membership changes, and each plain
 * object is validated the first time the tree reads into it (#95, adopted
 * provisionally). Every value a write supplies is copied (V5).
 */
import type { CellAdapter, NativeCell, PlainAdapter, Route } from './cell';
import { NODE, PlainCell, createPlainAdapter, isPlainAdapter } from './cell';
import type { TreeErrorEvent } from './errors';
import { SignalTreeError, SignalTreeRefusal } from './errors';
import type { Attachment, Interceptor, ObserveListener, Plugin, ScopeHandle, TurnHandle, TurnInfo, WriteEffect, WriteKind, WriteOp, WriterContext } from './seam';
import { ErrorChannel, USER_CONTEXT, isAsyncFunction, isThenable, writerContext } from './seam';
import type { CollectionHost, EntityKey, EntityMapMarker, FieldRef } from './entities';
import { EntityCollection, isEntityMapMarker } from './entities';

// ------------------------------------------------------------------ values

const LEAF = Symbol('signal-tree.leaf');

/** Marks a value as one opaque leaf: stored by identity, never walked into or copied. */
export interface LeafMarker<T> {
  readonly [LEAF]: T;
}

/** Marks `value` as an opaque leaf (V2), for values the tree would otherwise treat as a branch. */
export function leaf<T>(value: T): LeafMarker<T> {
  return Object.freeze({ [LEAF]: value }) as LeafMarker<T>;
}

/** Object.is, written out so V8 inlines it on the write path. */
function sameValue(a: unknown, b: unknown): boolean {
  return a === b ? a !== 0 || 1 / (a as number) === 1 / (b as number) : a !== a && b !== b;
}

function isLeafMarker(value: unknown): value is LeafMarker<unknown> {
  return typeof value === 'object' && value !== null && LEAF in value;
}

/** Only plain objects are branches (V2). */
function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Own enumerable string and symbol keys, in definition order. */
function memberKeys(object: object): PropertyKey[] {
  const keys: PropertyKey[] = Object.keys(object);
  for (const symbol of Object.getOwnPropertySymbols(object)) {
    if (Object.prototype.propertyIsEnumerable.call(object, symbol)) keys.push(symbol);
  }
  return keys;
}

const handles = new WeakSet<object>();

/** Refuses what may not enter a tree at `path`. */
function checkKey(key: PropertyKey, path: readonly PropertyKey[]): void {
  if (key === '__proto__') throw new SignalTreeRefusal('ST1002', { path: [...path, key] });
}

/**
 * Copies a value entering the tree (V5). Plain objects and arrays are copied
 * deeply, keeping symbol keys and non-enumerable fields; getters are read once.
 * Opaque values and leaf() values keep their identity (V2).
 */
function copyIn(value: unknown, path: readonly PropertyKey[], foreign: (v: unknown) => boolean): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (isLeafMarker(value)) return value[LEAF];
  if (foreign(value)) throw new SignalTreeRefusal('ST1001', { path, detail: 'a cell or handle cannot be written as a value' });
  if (Array.isArray(value)) {
    const out = new Array<unknown>(value.length);
    for (let i = 0; i < value.length; i++) out[i] = copyIn(value[i], [...path, i], foreign);
    return out;
  }
  if (!isPlainObject(value)) return value;
  const out: Record<PropertyKey, unknown> = Object.getPrototypeOf(value) === null ? Object.create(null) : {};
  for (const key of Reflect.ownKeys(value)) {
    checkKey(key, path);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    const read = 'value' in descriptor ? descriptor.value : descriptor.get?.call(value);
    Object.defineProperty(out, key, {
      value: copyIn(read, [...path, key], foreign),
      enumerable: descriptor.enumerable ?? false,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/** A frozen deep copy for snapshots (H2). Opaque values appear by identity. */
function frozenCopy(value: unknown, cache: WeakMap<object, unknown>): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (isLeafMarker(value)) return value[LEAF];
  const isArray = Array.isArray(value);
  if (!isArray && !isPlainObject(value)) return value;
  const cached = cache.get(value);
  if (cached !== undefined) return cached;
  let out: unknown;
  if (isArray) {
    out = Object.freeze(value.map((item) => frozenCopy(item, cache)));
  } else {
    const copy: Record<PropertyKey, unknown> = Object.getPrototypeOf(value) === null ? Object.create(null) : {};
    for (const key of memberKeys(value)) {
      if (key === '__proto__') throw new SignalTreeRefusal('ST1002', { path: [key] });
      copy[key] = frozenCopy((value as Record<PropertyKey, unknown>)[key], cache);
    }
    out = Object.freeze(copy);
  }
  cache.set(value, out);
  return out;
}

// ------------------------------------------------------------------- nodes

const NONE = Symbol('none');

class LeafNode {
  /** True when the leaf's key is not a member of its parent (V1). */
  absent = false;
  snapFor: unknown = NONE;
  snap: unknown = undefined;
  readonly parent: BranchNode;
  readonly key: PropertyKey;
  readonly cell: object;
  constructor(parent: BranchNode, key: PropertyKey, cell: object) {
    this.parent = parent;
    this.key = key;
    this.cell = cell;
  }
}

class BranchNode {
  children: Map<PropertyKey, LeafNode | BranchNode | EntityCollection> | null = null;
  /** Whether `base` is the tree's own copy, which it may change. */
  owned: boolean;
  /** A non-plain value written over the whole branch; NONE while it holds members. */
  scalar: unknown = NONE;
  absent = false;
  snap: unknown = undefined;
  snapValid = false;
  handle: object | null = null;
  /** The nearest scope covering this branch, or null: the seam's fast path checks only this. */
  scope: Scope | null = null;
  /** The plain object whose own keys are the members and whose values back unread members. */
  base: Record<PropertyKey, unknown>;
  readonly parent: BranchNode | null;
  readonly key: PropertyKey;
  constructor(parent: BranchNode | null, key: PropertyKey, base: Record<PropertyKey, unknown>, owned: boolean) {
    this.parent = parent;
    this.key = key;
    this.base = base;
    this.owned = owned;
  }
}

type AnyNode = LeafNode | BranchNode | EntityCollection;

/** Whether `value` has the branch's members, with the same values for those not yet read. */
function sameMembers(branch: BranchNode, value: Record<PropertyKey, unknown>): boolean {
  const before = memberKeys(branch.base);
  const after = memberKeys(value);
  if (before.length !== after.length) return false;
  for (const key of after) {
    if (!Object.prototype.hasOwnProperty.call(branch.base, key)) return false;
    if (!branch.children?.has(key) && !sameValue(branch.base[key], value[key])) return false;
  }
  return true;
}

function pathOf(node: AnyNode): PropertyKey[] {
  const path: PropertyKey[] = [];
  for (let n: AnyNode | null = node; n && n.parent; n = n.parent as AnyNode | null) path.push(n.key);
  return path.reverse();
}

// ------------------------------------------------------------------ scopes

/** The plugins' attachment point on one branch (BRIEF.md 4.2 layer 5). */
class Scope {
  readonly node: BranchNode;
  /** The nearest enclosing scope. */
  readonly parent: Scope | null;
  readonly interceptors: Interceptor[] = [];
  readonly observers: ObserveListener[] = [];
  constructor(node: BranchNode, parent: Scope | null) {
    this.node = node;
    this.parent = parent;
  }
}

/** A scope and its ancestors, outermost first. */
function scopeChain(scope: Scope): Scope[] {
  const chain: Scope[] = [];
  for (let s: Scope | null = scope; s; s = s.parent) chain.push(s);
  return chain.reverse();
}

// --------------------------------------------------------------- the tree

type JournalEntry = NodeEntry | { readonly undo: () => void };

interface NodeEntry {
  readonly node: LeafNode | BranchNode;
  readonly value: unknown;
  readonly absent: boolean;
  readonly base?: Record<PropertyKey, unknown>;
  readonly owned?: boolean;
}

/** @internal */
export class TreeCore<Tag extends string> {
  readonly adapter: CellAdapter<Tag>;
  readonly root: BranchNode;
  readonly route: Route;
  destroyed = false;
  /** True when the cells are this library's plain cells, whose fields the seam may read and store directly. */
  private readonly plain: boolean;
  private turnDepth = 0;
  /** Undo journal of the open explicit turn (T13); null outside one. */
  private journal: JournalEntry[] | null = null;
  private turnSerial = 0;
  readonly errors: ErrorChannel;
  /** The writer context of the code running now (W5: it never outlives the synchronous call that set it). */
  private context: WriterContext = USER_CONTEXT;
  /** The writer context the open turn was opened under. */
  private turnContext: WriterContext = USER_CONTEXT;
  /** The open turn, once something in a scope needs it. */
  private currentTurn: TurnInfo | null = null;
  /** The context, with its turn, that effects of the open turn carry. */
  private effectContextCache: { base: WriterContext; turn: TurnHandle; context: WriterContext } | null = null;
  private effects: { scope: Scope; effect: WriteEffect }[] = [];
  private publishing = false;
  private readonly publishQueue: { turn: TurnInfo; effects: { scope: Scope; effect: WriteEffect }[] }[] = [];
  private readonly attachments: { name: string; attachment: Attachment<unknown>; disposers: (() => void)[] }[] = [];
  private readonly scopes = new Map<BranchNode, Scope>();
  private readonly host: CollectionHost;
  /** Collections a whole-value write is about to change, checked before anything changes. */
  private pendingCollections: Map<EntityCollection, ReturnType<EntityCollection['prepareWhole']>> | null = null;
  private readonly snapshotCache = new WeakMap<object, unknown>();
  private readonly cells = new Set<object>();
  private readonly isForeign = (value: unknown) => handles.has(value as object) || (value as Record<symbol, unknown>)[NODE] !== undefined;

  constructor(state: object, adapter: CellAdapter<Tag>, onTreeError?: (event: TreeErrorEvent) => void) {
    this.errors = new ErrorChannel(onTreeError);
    if (!isPlainObject(state)) throw new SignalTreeError('ST1001', { detail: 'the initial state must be a plain object' });
    this.adapter = adapter;
    this.plain = isPlainAdapter(adapter);
    this.route = (cell, next) => this.writeLeaf((cell as Record<symbol, LeafNode>)[NODE]!, next);
    const fieldRoute: Route = (cell, next) => {
      const ref = (cell as Record<symbol, FieldRef>)[NODE]!;
      ref.collection.writeField(ref, next);
    };
    this.host = {
      adapter: adapter as CellAdapter<string>,
      fieldRoute,
      assertLive: () => this.assertLive(),
      write: (collection, kind, payload, apply) => {
        const scope = (collection.parent as BranchNode).scope;
        if (scope === null) this.batch(() => void apply(payload, null));
        else this.covered(scope, collection.path, kind, payload, (op) => apply(op.next, op));
      },
      journal: (undo) => {
        if (this.journal) this.journal.push({ undo });
      },
      changed: (collection) => {
        this.mutations++;
        this.invalidate(collection);
      },
      copy: (value, path) => copyIn(value, path, this.isForeign),
      frozen: (value) => frozenCopy(value, this.snapshotCache),
      registerCell: (cell) => this.cells.add(cell),
      isPlainObject,
    };
    this.root = new BranchNode(null, '', state, false);
    this.validate(this.root);
  }

  // ------------------------------------------------------------ structure

  /** Validates the members of a branch's base, the first time the tree reads into it (#95). */
  private validate(branch: BranchNode): void {
    for (const key of memberKeys(branch.base)) {
      if (key === '__proto__') throw new SignalTreeRefusal('ST1002', { path: [...pathOf(branch), key] });
      const value = branch.base[key];
      if (typeof value === 'object' && value !== null && !isLeafMarker(value) && this.isForeign(value)) {
        throw new SignalTreeRefusal('ST1001', { path: [...pathOf(branch), key], detail: 'a cell or handle of another tree' });
      }
    }
    // `__proto__` defined as an own key does not show in Object.keys when it was set by JSON.parse; check directly.
    if (Object.prototype.hasOwnProperty.call(branch.base, '__proto__')) {
      throw new SignalTreeRefusal('ST1002', { path: [...pathOf(branch), '__proto__'] });
    }
  }

  /** The node for member `key` of `branch`, created on first access. Absent members get an absent leaf. */
  child(branch: BranchNode, key: PropertyKey): AnyNode {
    let node: AnyNode | undefined = branch.children?.get(key);
    if (node) return node;
    checkKey(key, pathOf(branch));
    const present = branch.scalar === NONE && !branch.absent && Object.prototype.hasOwnProperty.call(branch.base, key);
    const value = present ? branch.base[key] : undefined;
    if (present && isEntityMapMarker(value)) {
      node = new EntityCollection(this.host, branch, key, Object.freeze([...pathOf(branch), key]), value);
    } else if (present && isPlainObject(value) && !isLeafMarker(value)) {
      const created = new BranchNode(branch, key, value, false);
      created.scope = branch.scope;
      this.validate(created);
      // Keeps the invariant invalidate() relies on: a valid snapshot's materialized children are valid too.
      if (branch.snapValid) {
        created.snap = (branch.snap as Record<PropertyKey, unknown>)[key];
        created.snapValid = true;
      }
      node = created;
    } else {
      const initial = present ? this.adopt(value, [...pathOf(branch), key]) : undefined;
      const cell = this.adapter.createCell(initial, this.route) as object;
      const created = new LeafNode(branch, key, cell);
      created.absent = !present;
      (cell as Record<symbol, LeafNode>)[NODE] = created;
      this.cells.add(cell);
      node = created;
    }
    (branch.children ??= new Map()).set(key, node);
    return node;
  }

  /** A leaf's initial value from the initial state: unwrapped, and copied if it is an array (V5). */
  private adopt(value: unknown, path: readonly PropertyKey[]): unknown {
    if (isLeafMarker(value)) return value[LEAF];
    if (Array.isArray(value)) return copyIn(value, path, this.isForeign);
    return value;
  }

  // -------------------------------------------------------------- reads

  readLeaf(node: LeafNode): unknown {
    return this.adapter.peek(node.cell as NativeCell<Tag, unknown>);
  }

  /** A frozen snapshot of a branch, shared while it is unchanged (H2). */
  snapshot(branch: BranchNode): unknown {
    this.assertLive();
    return this.snap(branch);
  }

  private snap(branch: BranchNode): unknown {
    if (branch.snapValid) return branch.snap;
    let out: unknown;
    if (branch.absent) out = undefined;
    else if (branch.scalar !== NONE) out = frozenCopy(branch.scalar, this.snapshotCache);
    else {
      const copy: Record<PropertyKey, unknown> = Object.getPrototypeOf(branch.base) === null ? Object.create(null) : {};
      for (const key of memberKeys(branch.base)) {
        const node = branch.children?.get(key);
        if (node instanceof LeafNode) copy[key] = this.snapLeaf(node);
        else if (node instanceof EntityCollection) copy[key] = node.snapshot();
        else if (node) copy[key] = this.snap(node);
        else if (isEntityMapMarker(branch.base[key])) copy[key] = (this.child(branch, key) as EntityCollection).snapshot();
        else copy[key] = frozenCopy(branch.base[key], this.snapshotCache);
      }
      out = Object.freeze(copy);
    }
    branch.snap = out;
    branch.snapValid = true;
    return out;
  }

  private snapLeaf(node: LeafNode): unknown {
    const value = this.readLeaf(node);
    if (node.snapFor === value) return node.snap;
    node.snapFor = value;
    node.snap = frozenCopy(value, this.snapshotCache);
    return node.snap;
  }

  // ------------------------------------------------------------- writes

  assertLive(): void {
    if (this.destroyed) throw new SignalTreeError('ST1003');
  }

  /** The seam for a leaf write: equality, then commit. A skipped write is not a write. */
  writeLeaf(node: LeafNode, next: unknown): void {
    if (this.destroyed) throw new SignalTreeError('ST1003');
    if (typeof next !== 'object' && !node.absent && node.parent.scope === null) {
      // The common case, allocation-free (C1): a primitive written to a present leaf.
      const cell = node.cell as NativeCell<Tag, unknown>;
      if (this.plain) {
        // The tree's own plain cells: read and store the field directly, which the adapter's commit also does.
        const plainCell = cell as unknown as PlainCell<unknown>;
        if (sameValue(plainCell._value, next)) return;
        if (this.journal !== null) this.record(node);
        if (plainCell._listeners === null) plainCell._value = next;
        else this.adapter.commit(cell, next);
      } else {
        if (sameValue(this.adapter.peek(cell), next)) return;
        if (this.journal !== null) this.record(node);
        this.adapter.commit(cell, next);
      }
      for (let branch: BranchNode | null = node.parent; branch !== null && branch.snapValid; branch = branch.parent) branch.snapValid = false;
      return;
    }
    const value = typeof next === 'object' && next !== null ? copyIn(next, pathOf(node), this.isForeign) : next;
    if (node.parent.scope !== null) {
      this.writeCovered(node, node.parent.scope, value, 'set');
      return;
    }
    this.applyLeaf(node, value);
  }

  /** Applies an already copied value to a leaf: skipped when unchanged; re-adds an absent leaf's path (V1). */
  private applyLeaf(node: LeafNode, value: unknown): void {
    if (!node.absent && sameValue(this.readLeaf(node), value)) return;
    if (node.absent) {
      this.batch(() => {
        const parent = node.parent;
        this.present(parent);
        if (!Object.prototype.hasOwnProperty.call(parent.base, node.key)) this.ownBase(parent)[node.key] = undefined;
        this.commitLeaf(node, value, false);
      });
      return;
    }
    this.commitLeaf(node, value, false);
  }

  /** A whole-value write to a branch (V1), one implicit turn. Copies and checks everything before changing anything. */
  writeBranch(branch: BranchNode, next: unknown, kind: WriteKind = 'set'): void {
    this.assertLive();
    const value = copyIn(next, pathOf(branch), this.isForeign);
    if (branch.scope !== null) {
      this.writeCovered(branch, branch.scope, value, kind);
      return;
    }
    this.batch(() => this.applyWhole(branch, value));
  }

  private applyWhole(branch: BranchNode, value: unknown): void {
    const pending = new Map<EntityCollection, ReturnType<EntityCollection['prepareWhole']>>();
    this.prepareCollections(branch, value, true, pending);
    const outer = this.pendingCollections;
    this.pendingCollections = pending;
    try {
      if (branch.absent) this.present(branch.parent!);
      this.applyBranch(branch, value);
    } finally {
      this.pendingCollections = outer;
    }
  }

  /** Checks what a whole-value write gives each collection beneath `branch`, so a bad one refuses before anything changes. */
  private prepareCollections(branch: BranchNode, value: unknown, present: boolean, out: Map<EntityCollection, ReturnType<EntityCollection['prepareWhole']>>): void {
    for (const [key, node] of branch.children ?? []) {
      const has = present && isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, key);
      const incoming = has ? (value as Record<PropertyKey, unknown>)[key] : undefined;
      if (node instanceof EntityCollection) out.set(node, node.prepareWhole(incoming, has));
      else if (node instanceof BranchNode) this.prepareCollections(node, incoming, has, out);
    }
  }

  // ------------------------------------------------------ the covered seam

  /** A write inside a scope: interceptors outermost first, then the change, then the effect for observers. */
  private writeCovered(node: LeafNode | BranchNode, scope: Scope, value: unknown, kind: WriteKind): void {
    this.covered(scope, pathOf(node), kind, value, (op) => {
      const effect = this.applyOp(node, op, value);
      return effect.changed ? [effect] : [];
    });
  }

  /** Runs one write through the interceptors in scope, then `final`, and files the effects it returns for observers. */
  private covered(scope: Scope, location: readonly PropertyKey[], kind: WriteKind, payload: unknown, final: (op: WriteOp) => readonly WriteEffect[]): void {
    this.batch(() => {
      const chain = scopeChain(scope);
      const interceptors: Interceptor[] = [];
      for (const s of chain) interceptors.push(...s.interceptors);
      const op: WriteOp = Object.freeze({ location: Object.freeze([...location]), kind, next: payload, context: this.effectContext() });
      let produced: readonly WriteEffect[] = [];
      this.runInterceptors(interceptors, 0, op, (last) => {
        produced = final(last);
        if (produced.length === 1) return produced[0]!;
        return Object.freeze({ location: last.location, before: undefined, after: undefined, changed: produced.length > 0, context: last.context });
      });
      for (const effect of produced) for (const s of chain) if (s.observers.length > 0) this.effects.push({ scope: s, effect });
    });
  }

  private runInterceptors(interceptors: Interceptor[], index: number, op: WriteOp, final: (op: WriteOp) => WriteEffect): WriteEffect {
    if (index === interceptors.length) return final(op);
    let called = false;
    return interceptors[index]!.intercept(op, (next) => {
      if (called) throw new SignalTreeError('ST1008', { path: [...op.location], detail: interceptors[index]!.name });
      called = true;
      return this.runInterceptors(interceptors, index + 1, next, final);
    });
  }

  /** The end of the interceptor chain: applies the op and describes what changed. */
  private applyOp(node: LeafNode | BranchNode, op: WriteOp, original: unknown): WriteEffect {
    const value = op.next === original ? original : copyIn(op.next, pathOf(node), this.isForeign);
    const context = op.context;
    if (node instanceof LeafNode) {
      const wasAbsent = node.absent;
      const before = this.readLeaf(node);
      this.applyLeaf(node, value);
      const after = this.readLeaf(node);
      return Object.freeze({ location: op.location, before, after, changed: wasAbsent || !sameValue(before, after), context });
    }
    const before = this.snap(node);
    const mutations = this.mutations;
    this.applyWhole(node, value);
    return Object.freeze({ location: op.location, before, after: this.snap(node), changed: this.mutations !== mutations, context });
  }

  /** The current writer context, carrying the open turn (W1). */
  private effectContext(): WriterContext {
    const turn = this.openTurnInfo().turn;
    const cache = this.effectContextCache;
    if (cache && cache.base === this.context && cache.turn === turn) return cache.context;
    const context = Object.freeze({ ...this.context, turn });
    this.effectContextCache = { base: this.context, turn, context };
    return context;
  }

  private openTurnInfo(): TurnInfo {
    return (this.currentTurn ??= Object.freeze({ turn: Object.freeze({ id: ++this.turnSerial }), context: this.turnContext }));
  }

  /** Publishes a closed turn's effects to each scope's observers, once (O2); a turn closed during publication waits its turn (O4). */
  private publish(turn: TurnInfo, effects: { scope: Scope; effect: WriteEffect }[]): void {
    this.publishQueue.push({ turn, effects });
    if (this.publishing) return;
    this.publishing = true;
    try {
      while (this.publishQueue.length > 0) {
        const next = this.publishQueue.shift()!;
        const byScope = new Map<Scope, WriteEffect[]>();
        for (const { scope, effect } of next.effects) {
          const list = byScope.get(scope);
          if (list) list.push(effect);
          else byScope.set(scope, [effect]);
        }
        for (const [scope, list] of byScope) {
          const frozen = Object.freeze(list);
          for (const observer of scope.observers.slice()) {
            try {
              observer(frozen, next.turn);
            } catch (error) {
              this.errors.observerError(error, pathOf(scope.node));
            }
          }
        }
      }
    } finally {
      this.publishing = false;
    }
  }

  /** Runs `fn` with `context` as the writer context (W1); refuses async callbacks (W5, W6). */
  as<R>(input: WriterContext, fn: () => R): R {
    this.assertLive();
    if (typeof fn !== 'function') throw new SignalTreeError('ST1006', { detail: 'as() takes a function' });
    if (isAsyncFunction(fn)) throw new SignalTreeRefusal('ST1005', { detail: 'as()' });
    const context = writerContext(input);
    const previous = this.context;
    this.context = context;
    let result: R;
    try {
      result = fn();
    } finally {
      this.context = previous;
    }
    if (isThenable(result)) {
      (result as PromiseLike<unknown>).then(undefined, () => {});
      throw new SignalTreeRefusal('ST1005', { detail: 'as() callback returned a promise; its writes after the first await would lose the writer context' });
    }
    return result;
  }

  // -------------------------------------------------------------- plugins

  /** Attaches a plugin to the scope at `node`, creating the scope on first use. */
  attach<Api>(node: BranchNode, plugin: Plugin<Api>): Api {
    this.assertLive();
    if (!plugin || typeof plugin.attach !== 'function') throw new SignalTreeError('ST1006', { path: pathOf(node), detail: 'use() takes a plugin' });
    const scope = this.scopeAt(node);
    const disposers: (() => void)[] = [];
    const removers: (() => void)[] = [];
    const handle: ScopeHandle = Object.freeze({
      path: Object.freeze(pathOf(node)),
      intercept: (interceptor: Interceptor) => {
        scope.interceptors.push(interceptor);
        const remove = () => {
          const index = scope.interceptors.indexOf(interceptor);
          if (index >= 0) scope.interceptors.splice(index, 1);
        };
        removers.push(remove);
        return remove;
      },
      observe: (listener: ObserveListener) => {
        scope.observers.push(listener);
        const remove = () => {
          const index = scope.observers.indexOf(listener);
          if (index >= 0) scope.observers.splice(index, 1);
        };
        removers.push(remove);
        return remove;
      },
      snapshot: () => this.snapshot(node),
      onDispose: (fn: () => void) => {
        disposers.push(fn);
      },
    });
    const attachment = plugin.attach(handle);
    const record = { name: plugin.name, attachment: attachment as Attachment<unknown>, disposers };
    this.attachments.push(record);
    disposers.unshift(() => {
      for (const remove of removers) remove();
    });
    return attachment.api;
  }

  private scopeAt(node: BranchNode): Scope {
    const existing = this.scopes.get(node);
    if (existing) return existing;
    const previous = node.scope;
    const scope = new Scope(node, previous);
    this.scopes.set(node, scope);
    const cover = (branch: BranchNode) => {
      if (branch.scope !== previous) return;
      branch.scope = scope;
      for (const child of branch.children?.values() ?? []) if (child instanceof BranchNode) cover(child);
    };
    cover(node);
    // Scopes attached later beneath this one keep it as their parent.
    return scope;
  }

  /** Runs `fn` as one turn: observers see its writes as one change; if it throws, every write in it is reverted (T13). */
  turn<R>(fn: () => R): R {
    this.assertLive();
    if (typeof fn !== 'function') throw new SignalTreeError('ST1006', { detail: 'turn() takes a function' });
    const outer = this.journal;
    const mark = outer ? outer.length : 0;
    const journal = outer ?? [];
    this.journal = journal;
    const effectsMark = this.effects.length;
    let result!: R;
    try {
      this.batch(() => {
        try {
          result = fn();
        } catch (error) {
          this.revert(journal, mark);
          this.effects.length = effectsMark;
          throw error;
        }
      });
    } finally {
      this.journal = outer;
    }
    return result;
  }

  private batch(fn: () => void): void {
    if (this.turnDepth === 0) this.turnContext = this.context;
    this.turnDepth++;
    try {
      this.adapter.batch(fn);
    } finally {
      this.turnDepth--;
      if (this.turnDepth === 0) this.closeTurn();
    }
  }

  private closeTurn(): void {
    const turn = this.currentTurn;
    if (turn === null) return;
    this.currentTurn = null;
    const effects = this.effects;
    if (effects.length === 0) return;
    this.effects = [];
    this.publish(turn, effects);
  }

  private revert(journal: JournalEntry[], mark: number): void {
    for (let i = journal.length - 1; i >= mark; i--) {
      const entry = journal[i]!;
      if ('undo' in entry) {
        entry.undo();
        continue;
      }
      const node = entry.node;
      if (node instanceof LeafNode) {
        node.absent = entry.absent;
        this.adapter.commit(node.cell as NativeCell<Tag, unknown>, entry.value);
      } else {
        node.absent = entry.absent;
        node.scalar = entry.value;
        node.base = entry.base!;
        node.owned = entry.owned!;
      }
      this.invalidate(node);
    }
    journal.length = mark;
  }

  private record(node: LeafNode | BranchNode): void {
    const journal = this.journal;
    if (!journal) return;
    if (node instanceof LeafNode) journal.push({ node, value: this.readLeaf(node), absent: node.absent });
    else journal.push({ node, value: node.scalar, absent: node.absent, base: node.base, owned: node.owned });
  }

  /** Counts changes, so a branch write can tell whether it changed anything. */
  private mutations = 0;

  private commitLeaf(node: LeafNode, value: unknown, absent: boolean): void {
    this.mutations++;
    if (this.journal) this.record(node);
    node.absent = absent;
    this.adapter.commit(node.cell as NativeCell<Tag, unknown>, value);
    this.invalidate(node);
  }

  /** Clears cached snapshots from `node` up to the root. */
  private invalidate(node: AnyNode): void {
    if (node instanceof BranchNode) node.snapValid = false;
    for (let branch = node.parent as BranchNode | null; branch !== null && branch.snapValid; branch = branch.parent) branch.snapValid = false;
  }

  /** The branch's own base, copied first if it is still the caller's object or was taken before this turn. */
  private ownBase(branch: BranchNode): Record<PropertyKey, unknown> {
    if (this.journal) this.record(branch);
    if (!branch.owned || this.journal) {
      const copy: Record<PropertyKey, unknown> = Object.getPrototypeOf(branch.base) === null ? Object.create(null) : {};
      for (const key of memberKeys(branch.base)) copy[key] = branch.base[key];
      branch.base = copy;
      branch.owned = true;
    }
    return branch.base;
  }

  /** Makes `branch` and its ancestors hold members again, so a write beneath an absent member re-adds only its own path (V1). */
  private present(branch: BranchNode): void {
    if (!branch.absent && branch.scalar === NONE) return;
    this.mutations++;
    if (branch.parent) {
      this.present(branch.parent);
      this.ownBase(branch.parent)[branch.key] = undefined;
    }
    if (this.journal) this.record(branch);
    branch.absent = false;
    branch.scalar = NONE;
    branch.base = {};
    branch.owned = true;
    this.invalidate(branch);
  }

  /** Applies an already copied whole value to a branch. */
  private applyBranch(branch: BranchNode, value: unknown): void {
    if (this.journal) this.record(branch);
    if (!isPlainObject(value)) {
      if (!sameValue(branch.scalar, value)) this.mutations++;
      branch.scalar = value;
      branch.absent = false;
      branch.base = {};
      branch.owned = true;
      for (const node of branch.children?.values() ?? []) this.remove(node);
      this.invalidate(branch);
      return;
    }
    if (branch.scalar !== NONE || branch.absent || !sameMembers(branch, value)) this.mutations++;
    branch.absent = false;
    branch.scalar = NONE;
    branch.base = value;
    branch.owned = true;
    for (const [key, node] of branch.children ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        this.remove(node);
        continue;
      }
      const incoming = value[key];
      if (node instanceof EntityCollection) {
        node.applyWhole(this.pendingCollections?.get(node) ?? null);
      } else if (node instanceof LeafNode) {
        if (node.absent || !sameValue(this.readLeaf(node), incoming)) this.commitLeaf(node, incoming, false);
      } else {
        this.applyBranch(node, incoming);
      }
    }
    this.invalidate(branch);
  }

  /** Makes a materialized node absent (V1). */
  private remove(node: AnyNode): void {
    if (node instanceof EntityCollection) {
      node.applyWhole(null);
      return;
    }
    if (node instanceof LeafNode) {
      if (!node.absent) this.commitLeaf(node, undefined, true);
      return;
    }
    if (node.absent) return;
    this.mutations++;
    if (this.journal) this.record(node);
    for (const child of node.children?.values() ?? []) this.remove(child);
    node.absent = true;
    node.scalar = NONE;
    node.base = {};
    node.owned = true;
    this.invalidate(node);
  }

  // -------------------------------------------------------------- handles

  handle(node: AnyNode): unknown {
    if (node instanceof LeafNode) return node.cell;
    if (node instanceof EntityCollection) {
      return (node.handle ??= Object.freeze({
        addOne: (row: unknown) => node.addOne(row),
        addMany: (rows: readonly unknown[]) => node.addMany(rows),
        setAll: (rows: readonly unknown[]) => node.setAll(rows),
        updateOne: (id: EntityKey, changes: unknown) => node.updateOne(id, changes),
        updateMany: (updates: readonly { id: EntityKey; changes: unknown }[]) => node.updateMany(updates),
        upsertOne: (row: unknown) => node.upsertOne(row),
        upsertMany: (rows: readonly unknown[]) => node.upsertMany(rows),
        removeOne: (id: EntityKey) => node.removeOne(id),
        removeMany: (ids: readonly EntityKey[]) => node.removeMany(ids),
        changeId: (from: EntityKey, to: EntityKey) => node.changeId(from, to),
        clear: () => node.clear(),
        byId: (id: EntityKey) => node.byId(id),
        ids: () => node.ids(),
        all: () => node.all(),
        count: () => node.count(),
      }));
    }
    if (node.handle) return node.handle;
    const methods = {
      get: () => this.snapshot(node),
      set: (value: unknown) => this.writeBranch(node, value),
      update: (fn: (current: unknown) => unknown) => {
        if (typeof fn !== 'function') throw new SignalTreeError('ST1006', { path: pathOf(node), detail: 'update() takes a function' });
        this.writeBranch(node, fn(this.snapshot(node)), 'update');
      },
      use: (plugin: Plugin<unknown>) => this.attach(node, plugin),
    };
    const handle = new Proxy(Object.create(null) as object, {
      get: (_target, key) => {
        const member = node.scalar === NONE && !node.absent && Object.prototype.hasOwnProperty.call(node.base, key);
        if (!member && Object.prototype.hasOwnProperty.call(methods, key)) return methods[key as keyof typeof methods];
        if (!member && (key === 'then' || typeof key === 'symbol')) return undefined;
        this.assertLive();
        return this.handle(this.child(node, key));
      },
      has: (_target, key) => {
        return node.scalar === NONE && !node.absent && Object.prototype.hasOwnProperty.call(node.base, key);
      },
      set: () => {
        throw new SignalTreeError('ST1004', { path: pathOf(node), detail: 'assign through a handle method, for example .set()' });
      },
    });
    handles.add(handle);
    node.handle = handle;
    return handle;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const { attachment, disposers } of this.attachments.splice(0).reverse()) {
      try {
        attachment.detach();
      } catch (error) {
        this.errors.observerError(error, [], 'ST2036');
      }
      for (const dispose of disposers) {
        try {
          dispose();
        } catch (error) {
          this.errors.observerError(error, [], 'ST2036');
        }
      }
    }
    for (const scope of this.scopes.values()) {
      scope.interceptors.length = 0;
      scope.observers.length = 0;
    }
    this.scopes.clear();
    this.errors.dispose();
    const plain = this.adapter as unknown as Partial<PlainAdapter>;
    for (const cell of this.cells) plain.destroyCell?.(cell);
    this.cells.clear();
  }
}

// ---------------------------------------------------------------- public API

type Opaque = ((...args: never[]) => unknown) | Date | RegExp | Map<unknown, unknown> | Set<unknown> | WeakMap<object, unknown> | WeakSet<object> | ArrayBufferView | ArrayBuffer | Promise<unknown>;

/** The handle of one row: each field as a native cell, and the row as a frozen snapshot. */
export type RowHandle<Tag extends string, E> = { readonly [F in keyof E]-?: NativeCell<Tag, E[F]> } & {
  /** A frozen snapshot of the row, or undefined once it is gone. */
  get(): Readonly<E> | undefined;
};

export interface CollectionHandle<Tag extends string, E, K extends EntityKey> {
  addOne(row: E): void;
  addMany(rows: readonly E[]): void;
  /** Replaces every row. Rows whose key stays keep their handles; the order becomes the input's. */
  setAll(rows: readonly E[]): void;
  updateOne(id: K, changes: Partial<E>): void;
  updateMany(updates: readonly { readonly id: K; readonly changes: Partial<E> }[]): void;
  upsertOne(row: E): void;
  upsertMany(rows: readonly E[]): void;
  removeOne(id: K): void;
  removeMany(ids: readonly K[]): void;
  /** Sets a row's id, keeping its handle and position. Only with the default selector (row => row.id). */
  changeId(from: K, to: K): void;
  clear(): void;
  /** The row's handle, stable for the row's lifetime, or undefined. */
  byId(id: K): RowHandle<Tag, E> | undefined;
  ids(): readonly K[];
  /** Every row, in insertion order. A result once returned never changes. */
  all(): readonly Readonly<E>[];
  count(): number;
}

/** The handle for a value of type T: a native cell for a leaf, a branch handle for a plain object. */
export type Handle<Tag extends string, T> =
  T extends EntityMapMarker<infer E, infer K>
    ? CollectionHandle<Tag, E, K>
    : T extends LeafMarker<infer U>
    ? NativeCell<Tag, U>
    : T extends readonly unknown[] | Opaque | null | undefined | string | number | boolean | bigint | symbol
      ? NativeCell<Tag, T>
      : T extends object
        ? BranchHandle<Tag, T>
        : NativeCell<Tag, T>;

/** Unwraps leaf() markers, the values a branch reads as. */
export type Unwrap<T> = T extends EntityMapMarker<infer E, EntityKey> ? readonly Readonly<E>[] : T extends LeafMarker<infer U> ? U : T extends readonly unknown[] | Opaque ? T : T extends object ? { readonly [K in keyof T]: Unwrap<T[K]> } : T;

export interface BranchMethods<T> {
  /** A frozen snapshot of the branch. */
  get(): Unwrap<T>;
  /** Replaces the whole branch. Its members become exactly the value's own keys. */
  set(value: T): void;
  update(fn: (current: Unwrap<T>) => T): void;
  /** Attaches a plugin to this branch only, and returns its API. */
  use<Api>(plugin: Plugin<Api>): Api;
}

export type BranchHandle<Tag extends string, T> = { readonly [K in keyof T]-?: Handle<Tag, T[K]> } & BranchMethods<T>;

type PluginApis<P extends readonly Plugin<unknown>[]> = P extends readonly [] ? unknown : UnionToIntersection<P[number] extends Plugin<infer A> ? (A extends object ? A : unknown) : unknown>;
type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (i: infer I) => void ? I : never;

export interface TreeOptions<Tag extends string = 'plain', P extends readonly Plugin<unknown>[] = readonly Plugin<unknown>[]> {
  /** The adapter whose native cells hold the state. Defaults to a plain adapter for this tree. */
  readonly adapter?: CellAdapter<Tag>;
  /** Plugins attached to the whole tree. Their APIs join the tree object. */
  readonly plugins?: P;
  /** Receives every error an observer, subscriber or plugin throws while a change is published, and teardown errors. Defaults to console.error. */
  readonly onTreeError?: (event: TreeErrorEvent) => void;
}

export interface SignalTreeBase<Tag extends string, S> {
  /** The root handle. */
  readonly $: BranchHandle<Tag, S>;
  /** Stable for the tree's lifetime and distinct between live trees. */
  readonly id: string;
  /** Runs `fn` as one turn: observers see its writes as one change; if it throws, its writes are reverted. */
  turn<R>(fn: () => R): R;
  /** Runs `fn` with its writes attributed to `context`. `fn` must be synchronous. */
  as<R>(context: WriterContext, fn: () => R): R;
  /** Releases every cell, subscription and plugin. Afterwards reads and writes throw. */
  destroy(): void;
}

export type SignalTree<Tag extends string, S, Api = unknown> = SignalTreeBase<Tag, S> & Api;

export type SignalTreeFactory<Tag extends string> = <S extends object, const P extends readonly Plugin<unknown>[] = []>(
  state: S,
  options?: TreeOptions<Tag, P>,
) => SignalTree<Tag, S, PluginApis<P>>;

function buildTree<Tag extends string, S extends object>(state: S, adapter: CellAdapter<Tag>, options: TreeOptions<string, readonly Plugin<unknown>[]> | undefined, ownAdapter: boolean): SignalTree<Tag, S> {
  const core = new TreeCore(state, adapter, options?.onTreeError);
  if (ownAdapter) (adapter as unknown as PlainAdapter).setListenerErrorHandler((error) => core.errors.observerError(error, []));
  const tree: Record<string, unknown> = {
    $: core.handle(core.root),
    id: core.errors.treeId,
    turn: <R>(fn: () => R) => core.turn(fn),
    as: <R>(context: WriterContext, fn: () => R) => core.as(context, fn),
    destroy: () => core.destroy(),
  };
  for (const plugin of options?.plugins ?? []) {
    const api = core.attach(core.root, plugin);
    if (api === null || typeof api !== 'object') continue;
    for (const key of Object.keys(api)) {
      if (key in tree) throw new SignalTreeError('ST1009', { detail: `${plugin.name} exposes "${key}"` });
      tree[key] = (api as Record<string, unknown>)[key];
    }
  }
  return tree as unknown as SignalTree<Tag, S>;
}

/** One factory per adapter (decision 4). The `adapter` option overrides it per call, for tests. */
export function createSignalTreeFactory<Tag extends string>(adapter: CellAdapter<Tag>): SignalTreeFactory<Tag> {
  return ((state: object, options?: TreeOptions<Tag, readonly Plugin<unknown>[]>) =>
    buildTree(state, options?.adapter ?? adapter, options as TreeOptions<string, readonly Plugin<unknown>[]>, false)) as SignalTreeFactory<Tag>;
}

/** Builds a tree on plain cells, or on the adapter given in options. */
export function signalTree<S extends object, const P extends readonly Plugin<unknown>[] = []>(state: S, options?: TreeOptions<'plain', P>): SignalTree<'plain', S, PluginApis<P>>;
export function signalTree<S extends object, Tag extends string, const P extends readonly Plugin<unknown>[] = []>(
  state: S,
  options: TreeOptions<Tag, P> & { readonly adapter: CellAdapter<Tag> },
): SignalTree<Tag, S, PluginApis<P>>;
export function signalTree(state: object, options?: TreeOptions<string, readonly Plugin<unknown>[]>): unknown {
  const own = options?.adapter === undefined;
  const adapter = (options?.adapter ?? createPlainAdapter()) as CellAdapter<string>;
  return buildTree(state, adapter, options, own);
}
