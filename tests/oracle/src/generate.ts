// fast-check arbitraries for operation sequences. Every choice comes from the
// fast-check seed; nothing reads the clock or Math.random.
import fc from 'fast-check';
import {
  LEAF_PATHS,
  LINK_SOURCES,
  OBSERVED_PATHS,
  ROW_KEYS,
  WRITE_KINDS,
  pluginForKind,
  type ControlKind,
  type DeclarationKind,
  type Op,
  type OpKind,
  type Row,
  type Sequence,
  type Step,
  type TreeConfig,
  type WriteKind,
  type WriteOp,
} from './model.js';

/** Which plugin configurations sequences use. */
export type PluginMode = 'any' | 'none' | 'all';

export interface GenerateOptions {
  /** Operation kinds to generate: normally the union of the subjects' supports. */
  readonly kinds: ReadonlySet<OpKind>;
  readonly plugins: PluginMode;
  /** Upper bound on steps per sequence. */
  readonly maxSteps: number;
}

/** Relative frequency of each operation kind. */
const WEIGHTS: Record<OpKind, number> = {
  setLeaf: 6,
  updateLeaf: 3,
  setBranch: 3,
  addOne: 6,
  addMany: 2,
  setAll: 2,
  updateOne: 5,
  updateMany: 2,
  upsertOne: 3,
  upsertMany: 2,
  removeOne: 4,
  removeMany: 2,
  changeId: 3,
  prependOne: 1,
  replaceOne: 2,
  clear: 1,
  setField: 3,
  transact: 12,
  inspect: 3,
  confirm: 4,
  rollback: 6,
  undo: 5,
  redo: 3,
  linkOpen: 4,
  linkDispose: 1,
  linkSettled: 1,
  linkRetrieve: 1,
  linkPush: 1,
  linkAck: 1,
  declare: 3,
  observerOpen: 1,
  rowHold: 2,
  rowHeldRead: 1,
  rowHeldWrite: 2,
};

const small = fc.integer({ min: 0, max: 3 });
const key = fc.constantFrom(...ROW_KEYS);
const row: fc.Arbitrary<Row> = fc.record({ id: key, n: small });
const rows = fc.array(row, { maxLength: 4 });
const keys = fc.array(key, { minLength: 1, maxLength: 3 });
const ref = fc.nat({ max: 3 });

/** First alternative is what fast-check shrinks towards. */
const weighted = <T>(first: [T, number], ...rest: [T, number][]): fc.Arbitrary<T> =>
  fc.oneof(...[first, ...rest].map(([value, weight]) => ({ arbitrary: fc.constant(value), weight })));

const WRITE_ARBS: Record<WriteKind, fc.Arbitrary<WriteOp>> = {
  setLeaf: fc.record({ kind: fc.constant('setLeaf'), path: fc.constantFrom(...LEAF_PATHS), value: small }),
  updateLeaf: fc.record({
    kind: fc.constant('updateLeaf'),
    path: fc.constantFrom(...LEAF_PATHS),
    delta: fc.integer({ min: -1, max: 2 }),
  }),
  setBranch: fc.record({ kind: fc.constant('setBranch'), p: small, q: small }),
  addOne: fc.record({ kind: fc.constant('addOne'), row }),
  addMany: fc.record({
    kind: fc.constant('addMany'),
    rows,
    mode: weighted<'strict' | 'skip' | 'overwrite'>(['strict', 2], ['skip', 1], ['overwrite', 1]),
  }),
  setAll: fc.record({ kind: fc.constant('setAll'), rows }),
  updateOne: fc.record({ kind: fc.constant('updateOne'), id: key, n: small }),
  updateMany: fc.record({ kind: fc.constant('updateMany'), ids: keys, n: small }),
  upsertOne: fc.record({ kind: fc.constant('upsertOne'), row }),
  upsertMany: fc.record({ kind: fc.constant('upsertMany'), rows }),
  removeOne: fc.record({ kind: fc.constant('removeOne'), id: key }),
  removeMany: fc.record({ kind: fc.constant('removeMany'), ids: keys }),
  changeId: fc.record({ kind: fc.constant('changeId'), from: key, to: key }),
  prependOne: fc.record({ kind: fc.constant('prependOne'), row }),
  replaceOne: fc.record({ kind: fc.constant('replaceOne'), id: key, row }),
  clear: fc.constant({ kind: 'clear' }),
  setField: fc.record({ kind: fc.constant('setField'), id: key, n: small }),
};

function writeArb(kinds: ReadonlySet<OpKind>): fc.Arbitrary<WriteOp> | undefined {
  const allowed = WRITE_KINDS.filter((kind) => kinds.has(kind));
  if (allowed.length === 0) return undefined;
  return fc.oneof(...allowed.map((kind) => ({ arbitrary: WRITE_ARBS[kind], weight: WEIGHTS[kind] })));
}

function controlArbs(write: fc.Arbitrary<WriteOp> | undefined): Partial<Record<ControlKind, fc.Arbitrary<Op>>> {
  const link = fc.nat({ max: 2 });
  const arbs: Partial<Record<ControlKind, fc.Arbitrary<Op>>> = {
    inspect: fc.record({ kind: fc.constant('inspect'), tx: ref }),
    confirm: fc.record({ kind: fc.constant('confirm'), tx: ref }),
    rollback: fc.record({ kind: fc.constant('rollback'), tx: ref }),
    undo: fc.constant({ kind: 'undo' }),
    redo: fc.constant({ kind: 'redo' }),
    linkOpen: fc.record({
      kind: fc.constant('linkOpen'),
      source: fc.constantFrom(...LINK_SOURCES),
      mode: weighted<'sync' | 'deferred' | 'failing'>(['sync', 3], ['deferred', 2], ['failing', 1]),
    }),
    linkDispose: fc.record({ kind: fc.constant('linkDispose'), link }),
    linkSettled: fc.record({ kind: fc.constant('linkSettled'), link }),
    linkRetrieve: fc.record({ kind: fc.constant('linkRetrieve'), link, value: small }),
    linkPush: fc.record({ kind: fc.constant('linkPush'), link, value: small }),
    linkAck: fc.record({ kind: fc.constant('linkAck'), link, ok: weighted<boolean>([true, 3], [false, 1]) }),
    observerOpen: fc.record({ kind: fc.constant('observerOpen'), path: fc.constantFrom(...OBSERVED_PATHS) }),
    rowHold: fc.record({ kind: fc.constant('rowHold'), id: key }),
    rowHeldRead: fc.record({ kind: fc.constant('rowHeldRead'), handle: ref }),
    rowHeldWrite: fc.record({ kind: fc.constant('rowHeldWrite'), handle: ref, n: small }),
  };
  if (write) {
    arbs.transact = fc.record({
      kind: fc.constant('transact'),
      body: fc.array(write, { minLength: 1, maxLength: 3 }),
      undoable: weighted<boolean>([false, 3], [true, 2]),
    });
    arbs.declare = fc.record({
      kind: fc.constant('declare'),
      link,
      declaration: weighted<DeclarationKind>(['independent', 3], ['dependent', 3], ['unknown', 2], ['malformed', 1]),
      owners: fc.array(ref, { maxLength: 2 }),
      body: fc.array(write, { minLength: 1, maxLength: 2 }),
    });
  }
  return arbs;
}

function configArb(mode: PluginMode): fc.Arbitrary<TreeConfig> {
  if (mode === 'none') return fc.constant({ transactions: false, restoration: false });
  if (mode === 'all') return fc.constant({ transactions: true, restoration: true });
  return fc.record({
    transactions: weighted<boolean>([false, 1], [true, 6]),
    restoration: weighted<boolean>([false, 1], [true, 3]),
  });
}

/**
 * Kinds to generate: everything any subject supports. A kind only some
 * support is still generated; the others report it `unsupported`.
 */
export function generationKinds(subjects: readonly { supports: ReadonlySet<OpKind> }[]): Set<OpKind> {
  return new Set(subjects.flatMap((s) => [...s.supports]));
}

/** One step drawn from every allowed operation kind, weighted by WEIGHTS. */
export function stepArb(kinds: ReadonlySet<OpKind>): fc.Arbitrary<Step> {
  const write = writeArb(kinds);
  const control = controlArbs(write);
  const alternatives: { arbitrary: fc.Arbitrary<Op>; weight: number }[] = [];
  if (write) {
    alternatives.push({
      arbitrary: fc.record({
        kind: fc.constant('write'),
        write,
        wrap: weighted<'none' | 'undoable' | 'external'>(['none', 7], ['undoable', 2], ['external', 1]),
      }),
      weight: WRITE_KINDS.filter((k) => kinds.has(k)).reduce((sum, k) => sum + WEIGHTS[k], 0),
    });
  }
  for (const [kind, arbitrary] of Object.entries(control) as [ControlKind, fc.Arbitrary<Op>][]) {
    if (kinds.has(kind)) alternatives.push({ arbitrary, weight: WEIGHTS[kind] });
  }
  if (alternatives.length === 0) throw new Error('no operation kinds to generate');
  return fc.record({
    op: fc.oneof(...alternatives),
    sameTick: weighted<boolean>([false, 9], [true, 1]),
  });
}

export function sequenceArb(options: GenerateOptions): fc.Arbitrary<Sequence> {
  const kinds = new Set(
    [...options.kinds].filter((kind) => options.plugins !== 'none' || pluginForKind(kind) === undefined)
  );
  return fc.record({
    config: configArb(options.plugins),
    // size 'max': lengths spread over the whole range, not fast-check's small default.
    steps: fc.array(stepArb(kinds), { minLength: 1, maxLength: options.maxSteps, size: 'max' }),
  });
}
