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
import { SignalTreeError, SignalTreeRefusal } from './errors';

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
  children: Map<PropertyKey, LeafNode | BranchNode> | null = null;
  /** Whether `base` is the tree's own copy, which it may change. */
  owned: boolean;
  /** A non-plain value written over the whole branch; NONE while it holds members. */
  scalar: unknown = NONE;
  absent = false;
  snap: unknown = undefined;
  snapValid = false;
  handle: object | null = null;
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

type AnyNode = LeafNode | BranchNode;

function pathOf(node: AnyNode): PropertyKey[] {
  const path: PropertyKey[] = [];
  for (let n: AnyNode | null = node; n && n.parent; n = n.parent) path.push(n.key);
  return path.reverse();
}

// --------------------------------------------------------------- the tree

interface JournalEntry {
  readonly node: AnyNode;
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
  private readonly snapshotCache = new WeakMap<object, unknown>();
  private readonly cells = new Set<object>();
  private readonly isForeign = (value: unknown) => handles.has(value as object) || (value as Record<symbol, unknown>)[NODE] !== undefined;

  constructor(state: object, adapter: CellAdapter<Tag>) {
    if (!isPlainObject(state)) throw new SignalTreeError('ST1001', { detail: 'the initial state must be a plain object' });
    this.adapter = adapter;
    this.plain = isPlainAdapter(adapter);
    this.route = (cell, next) => this.writeLeaf((cell as Record<symbol, LeafNode>)[NODE]!, next);
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
    let node = branch.children?.get(key);
    if (node) return node;
    checkKey(key, pathOf(branch));
    const present = branch.scalar === NONE && !branch.absent && Object.prototype.hasOwnProperty.call(branch.base, key);
    const value = present ? branch.base[key] : undefined;
    if (present && isPlainObject(value) && !isLeafMarker(value)) {
      const created = new BranchNode(branch, key, value, false);
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
        else if (node) copy[key] = this.snap(node);
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
    if (typeof next !== 'object' && !node.absent) {
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
  writeBranch(branch: BranchNode, next: unknown): void {
    this.assertLive();
    const value = copyIn(next, pathOf(branch), this.isForeign);
    this.batch(() => {
      if (branch.absent) this.present(branch.parent!);
      this.applyBranch(branch, value);
    });
  }

  /** Runs `fn` as one turn: observers see its writes as one change; if it throws, every write in it is reverted (T13). */
  turn<R>(fn: () => R): R {
    this.assertLive();
    if (typeof fn !== 'function') throw new SignalTreeError('ST1006', { detail: 'turn() takes a function' });
    const outer = this.journal;
    const mark = outer ? outer.length : 0;
    const journal = outer ?? [];
    this.journal = journal;
    let result!: R;
    try {
      this.batch(() => {
        try {
          result = fn();
        } catch (error) {
          this.revert(journal, mark);
          throw error;
        }
      });
    } finally {
      this.journal = outer;
    }
    return result;
  }

  private batch(fn: () => void): void {
    this.turnDepth++;
    try {
      this.adapter.batch(fn);
    } finally {
      this.turnDepth--;
    }
  }

  private revert(journal: JournalEntry[], mark: number): void {
    for (let i = journal.length - 1; i >= mark; i--) {
      const entry = journal[i]!;
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

  private record(node: AnyNode): void {
    const journal = this.journal;
    if (!journal) return;
    if (node instanceof LeafNode) journal.push({ node, value: this.readLeaf(node), absent: node.absent });
    else journal.push({ node, value: node.scalar, absent: node.absent, base: node.base, owned: node.owned });
  }

  private commitLeaf(node: LeafNode, value: unknown, absent: boolean): void {
    if (this.journal) this.record(node);
    node.absent = absent;
    this.adapter.commit(node.cell as NativeCell<Tag, unknown>, value);
    this.invalidate(node);
  }

  /** Clears cached snapshots from `node` up to the root. */
  private invalidate(node: AnyNode): void {
    if (node instanceof BranchNode) node.snapValid = false;
    for (let branch = node.parent; branch !== null && branch.snapValid; branch = branch.parent) branch.snapValid = false;
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
      branch.scalar = value;
      branch.absent = false;
      branch.base = {};
      branch.owned = true;
      for (const node of branch.children?.values() ?? []) this.remove(node);
      this.invalidate(branch);
      return;
    }
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
      if (node instanceof LeafNode) {
        if (node.absent || !sameValue(this.readLeaf(node), incoming)) this.commitLeaf(node, incoming, false);
      } else {
        this.applyBranch(node, incoming);
      }
    }
    this.invalidate(branch);
  }

  /** Makes a materialized node absent (V1). */
  private remove(node: AnyNode): void {
    if (node instanceof LeafNode) {
      if (!node.absent) this.commitLeaf(node, undefined, true);
      return;
    }
    if (node.absent) return;
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
    if (node.handle) return node.handle;
    const methods = {
      get: () => this.snapshot(node),
      set: (value: unknown) => this.writeBranch(node, value),
      update: (fn: (current: unknown) => unknown) => {
        if (typeof fn !== 'function') throw new SignalTreeError('ST1006', { path: pathOf(node), detail: 'update() takes a function' });
        this.writeBranch(node, fn(this.snapshot(node)));
      },
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
    const plain = this.adapter as unknown as Partial<PlainAdapter>;
    for (const cell of this.cells) plain.destroyCell?.(cell);
    this.cells.clear();
  }
}

// ---------------------------------------------------------------- public API

type Opaque = ((...args: never[]) => unknown) | Date | RegExp | Map<unknown, unknown> | Set<unknown> | WeakMap<object, unknown> | WeakSet<object> | ArrayBufferView | ArrayBuffer | Promise<unknown>;

/** The handle for a value of type T: a native cell for a leaf, a branch handle for a plain object. */
export type Handle<Tag extends string, T> =
  T extends LeafMarker<infer U>
    ? NativeCell<Tag, U>
    : T extends readonly unknown[] | Opaque | null | undefined | string | number | boolean | bigint | symbol
      ? NativeCell<Tag, T>
      : T extends object
        ? BranchHandle<Tag, T>
        : NativeCell<Tag, T>;

/** Unwraps leaf() markers, the values a branch reads as. */
export type Unwrap<T> = T extends LeafMarker<infer U> ? U : T extends readonly unknown[] | Opaque ? T : T extends object ? { readonly [K in keyof T]: Unwrap<T[K]> } : T;

export interface BranchMethods<T> {
  /** A frozen snapshot of the branch. */
  get(): Unwrap<T>;
  /** Replaces the whole branch. Its members become exactly the value's own keys. */
  set(value: T): void;
  update(fn: (current: Unwrap<T>) => T): void;
}

export type BranchHandle<Tag extends string, T> = { readonly [K in keyof T]-?: Handle<Tag, T[K]> } & BranchMethods<T>;

export interface TreeOptions<Tag extends string = 'plain'> {
  /** The adapter whose native cells hold the state. Defaults to a plain adapter for this tree. */
  readonly adapter?: CellAdapter<Tag>;
}

export interface SignalTree<Tag extends string, S> {
  /** The root handle. */
  readonly $: BranchHandle<Tag, S>;
  /** Runs `fn` as one turn: observers see its writes as one change; if it throws, its writes are reverted. */
  turn<R>(fn: () => R): R;
  /** Releases every cell. Afterwards reads and writes throw. */
  destroy(): void;
}

export type SignalTreeFactory<Tag extends string> = <S extends object>(state: S, options?: TreeOptions<Tag>) => SignalTree<Tag, S>;

function buildTree<Tag extends string, S extends object>(state: S, adapter: CellAdapter<Tag>): SignalTree<Tag, S> {
  const core = new TreeCore(state, adapter);
  return {
    $: core.handle(core.root) as BranchHandle<Tag, S>,
    turn: (fn) => core.turn(fn),
    destroy: () => core.destroy(),
  };
}

/** One factory per adapter (decision 4). The `adapter` option overrides it per call, for tests. */
export function createSignalTreeFactory<Tag extends string>(adapter: CellAdapter<Tag>): SignalTreeFactory<Tag> {
  return (state, options) => buildTree(state, options?.adapter ?? adapter);
}

/** Builds a tree on plain cells, or on the adapter given in options. */
export function signalTree<S extends object>(state: S): SignalTree<'plain', S>;
export function signalTree<S extends object, Tag extends string>(state: S, options: TreeOptions<Tag>): SignalTree<Tag, S>;
export function signalTree<S extends object>(state: S, options?: TreeOptions<string>): SignalTree<string, S> {
  return buildTree(state, (options?.adapter ?? createPlainAdapter()) as CellAdapter<string>);
}
