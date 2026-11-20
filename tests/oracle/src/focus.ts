// Focused sequence shapes. Uniform draws over the vocabulary rarely line up
// the several steps some behaviors need (two overlapping transactions rolled
// back in a chosen order, a row removed by newer truth after a transaction
// rekeyed it, a held handle whose key is reused). Each shape lays out those
// steps with random parameters; random steps from the uniform vocabulary are
// mixed in between, and one focused sequence in five ends with destroy() and
// a few operations after it (D1). Shapes only arrange operations: what any
// outcome should be is still decided by the behavior properties alone.
import fc from 'fast-check';
import type { PluginMode } from './generate.js';
import {
  LEAF_PATHS,
  OBSERVED_PATHS,
  ROW_KEYS,
  type LeafPath,
  type LinkSource,
  type Op,
  type OpKind,
  type Reaction,
  type Reader,
  type Row,
  type RowKey,
  type Sequence,
  type Step,
  type WriteOp,
  type Wrap,
} from './model.js';

interface Shape {
  /** Operation kinds the shape uses; it is left out when any is not generated. */
  readonly needs: readonly OpKind[];
  /** Relative frequency among the shapes; 2 when absent (so a newer shape can be drawn half as often as the others). */
  readonly weight?: number;
  readonly plugins: boolean;
  /** Segments; random steps may be mixed in between them. */
  readonly segments: fc.Arbitrary<Step[][]>;
}

const step = (op: Op, sameTick = false): Step => ({ op, sameTick });
const write = (w: WriteOp, wrap: Wrap = 'none'): Op => ({ kind: 'write', write: w, wrap });
const transact = (body: WriteOp[], undoable = false): Op => ({ kind: 'transact', body, undoable });
const settle = (kind: 'confirm' | 'rollback' | 'inspect', tx: number): Op => ({ kind, tx });
const one = (op: Op): Step[] => [step(op)];

const key = fc.constantFrom(...ROW_KEYS);
const twoKeys = fc.tuple(key, key).filter(([a, b]) => a !== b);
const leaf = fc.constantFrom(...LEAF_PATHS);
const value = fc.integer({ min: 1, max: 3 });
/** A value in 1..3 other than `v`. */
const other = (v: number) => (v % 3) + 1;

/** A location two transactions both change: a leaf, or a row added first. */
const location = fc.oneof(
  leaf.map((path) => ({
    setup: [] as WriteOp[],
    write: (v: number, read: boolean): WriteOp =>
      read ? { kind: 'updateLeaf', path, delta: v } : { kind: 'setLeaf', path, value: v },
  })),
  key.map((id) => ({
    setup: [{ kind: 'addOne', row: { id, n: 0, m: 0 } }] as WriteOp[],
    write: (v: number): WriteOp => ({ kind: 'updateOne', id, field: 'n', value: v }),
  }))
);

/** Two overlapping transactions settled in a chosen order (T2, T3, T4, T7, T9, X1). */
const overlapping = (inspect: boolean): Shape => ({
  needs: ['transact', 'confirm', 'rollback', 'setLeaf', 'updateLeaf', 'addOne', 'updateOne'],
  plugins: true,
  segments: fc
    .record({
      at: location,
      v: value,
      read: fc.boolean(),
      undoable: fc.boolean(),
      order: fc.constantFrom('older-first', 'newer-first', 'confirm-newer'),
      look: fc.boolean(),
    })
    .map(({ at, v, read, undoable, order, look }) => {
      const peek = (tx: number) => (inspect && look ? [step(settle('inspect', tx)), step(settle('inspect', tx))] : []);
      const segments: Step[][] = [];
      if (at.setup.length) segments.push(at.setup.map((w) => step(write(w))));
      segments.push(one(transact([at.write(v, false)], undoable)), one(transact([at.write(other(v), read)], undoable)));
      if (order === 'older-first') {
        segments.push(one(settle('rollback', 0)), one(settle('rollback', 1)), [step(settle('rollback', 0)), ...peek(0)]);
      } else if (order === 'newer-first') {
        segments.push(one(settle('rollback', 1)), [step(settle('rollback', 0)), ...peek(1)]);
      } else {
        segments.push(one(settle('confirm', 1)), one(settle('rollback', 0)), one(settle('confirm', 0)));
      }
      return segments;
    }),
});

/** A transaction, then newer truth that removes or updates its row, then rollback (T4, T5, T6). */
const newerTruth: Shape = {
  needs: ['transact', 'rollback', 'confirm', 'addOne', 'updateOne', 'removeOne', 'changeId', 'setLeaf'],
  plugins: true,
  segments: fc
    .record({
      keys: twoKeys,
      n: value,
      variant: fc.constantFrom('remove', 'update', 'rekey-remove', 'rekey-update'),
      leafToo: fc.boolean(),
      v: value,
    })
    .map(({ keys: [from, to], n, variant, leafToo, v }) => {
      const rekey = variant.startsWith('rekey');
      const body: WriteOp[] = [rekey ? { kind: 'changeId', from, to } : { kind: 'updateOne', id: from, field: 'n', value: n }];
      if (leafToo) body.push({ kind: 'setLeaf', path: 'a', value: v });
      const id: RowKey = rekey ? to : from;
      const truth: WriteOp = variant.endsWith('remove')
        ? { kind: 'removeOne', id }
        : { kind: 'updateOne', id, field: 'n', value: other(n) };
      return [
        one(write({ kind: 'addOne', row: { id: from, n: 0, m: 0 } })),
        one(transact(body)),
        one(write(truth, 'external')),
        one(settle('rollback', 0)),
        one(settle('confirm', 0)),
      ];
    }),
};

/**
 * A transaction, then one later write that touches its locations in a way T4
 * counts (an unread overwrite, a re-insert, a same-value row replace, setAll,
 * clear, an inbound link value), or only another field of its row (T5), by
 * an ordinary write or newer truth, optionally in the rollback's own turn;
 * then rollback (T4, T5, T7).
 */
const laterTouch: Shape = {
  needs: [
    'transact',
    'rollback',
    'confirm',
    'setLeaf',
    'addOne',
    'updateOne',
    'removeOne',
    'replaceOne',
    'setAll',
    'clear',
    'linkOpen',
    'linkPush',
  ],
  plugins: true,
  segments: fc
    .record({
      k: key,
      v: value,
      variant: fc.constantFrom('unread-leaf', 'unread-field', 'other-field', 'same-row', 'reinsert', 'set-all', 'clear', 'link'),
      truth: fc.boolean(),
      sameTurn: fc.boolean(),
    })
    .map(({ k, v, variant, truth, sameTurn }) => {
      const row = (n: number): Row => ({ id: k, n, m: 0 });
      const field = (f: 'n' | 'm', value: number): WriteOp => ({ kind: 'updateOne', id: k, field: f, value });
      const setup: Step[] = [step(write({ kind: 'addOne', row: row(0) }))];
      let body: WriteOp[] = [field('n', v)];
      let later: WriteOp | undefined;
      switch (variant) {
        case 'unread-leaf':
          body = [{ kind: 'setLeaf', path: 'a', value: v }];
          later = { kind: 'setLeaf', path: 'a', value: other(v) };
          break;
        case 'unread-field':
          later = field('n', other(v));
          break;
        case 'other-field':
          later = field('m', v);
          break;
        case 'same-row':
          later = { kind: 'replaceOne', id: k, row: row(v) };
          break;
        case 'reinsert':
          body = [{ kind: 'removeOne', id: k }];
          later = { kind: 'addOne', row: row(0) };
          break;
        case 'set-all':
          later = { kind: 'setAll', rows: [row(v)] };
          break;
        case 'clear':
          later = { kind: 'clear' };
          break;
        case 'link':
          setup.push(step({ kind: 'linkOpen', source: 'a', mode: 'sync' }));
          body = [{ kind: 'setLeaf', path: 'a', value: v }];
          break;
      }
      const touch: Op = later ? write(later, truth ? 'external' : 'none') : { kind: 'linkPush', link: 0, value: other(v) };
      const rollback = step(settle('rollback', 0));
      return [
        setup,
        one(transact(body)),
        ...(sameTurn ? [[step(touch, true), rollback]] : [one(touch), [rollback]]),
        one(settle('confirm', 0)),
      ];
    }),
};

/** A held row handle whose key is removed and reused (E1, E2). */
const heldRow: Shape = {
  needs: ['addOne', 'upsertOne', 'removeOne', 'rowHold', 'rowHeldRead', 'rowHeldWrite'],
  plugins: false,
  segments: fc
    .record({ k: key, n: value, reuse: fc.constantFrom<'addOne' | 'upsertOne'>('addOne', 'upsertOne'), early: fc.boolean() })
    .map(({ k, n, reuse, early }) => [
      one(write({ kind: 'addOne', row: { id: k, n: 0, m: 0 } })),
      [step({ kind: 'rowHold', id: k }), ...(early ? [step({ kind: 'rowHeldRead', handle: 0 })] : [])],
      one(write({ kind: 'removeOne', id: k })),
      one(write({ kind: reuse, row: { id: k, n, m: 0 } })),
      one({ kind: 'rowHeldWrite', handle: 0, n: other(n) }),
      one({ kind: 'rowHeldRead', handle: 0 }),
    ]),
};

/** An undoable write, a newer write, then undo (R1, R2, R3, X1). */
const undoOverNewer: Shape = {
  needs: ['undo', 'redo', 'setLeaf', 'updateLeaf'],
  plugins: true,
  segments: fc
    .record({
      path: leaf,
      v: value,
      newer: fc.constantFrom('same', 'read', 'elsewhere', 'shared-turn'),
      redo: fc.boolean(),
    })
    .map(({ path, v, newer, redo }) => {
      const elsewhere: LeafPath = path === 'a' ? 'cfg.p' : 'a';
      const marked = step(write({ kind: 'setLeaf', path, value: v }, 'undoable'));
      const segments: Step[][] =
        newer === 'shared-turn'
          ? [[step(write({ kind: 'setLeaf', path: elsewhere, value: v }), true), marked]]
          : [
              [marked],
              one(
                write(
                  newer === 'same'
                    ? { kind: 'setLeaf', path, value: other(v) }
                    : newer === 'read'
                      ? { kind: 'updateLeaf', path, delta: 1 }
                      : { kind: 'setLeaf', path: elsewhere, value: v }
                )
              ),
            ];
      segments.push(one({ kind: 'undo' }));
      if (redo) segments.push(one({ kind: 'redo' }), one({ kind: 'undo' }));
      return segments;
    }),
};

/** An undoable transaction confirmed or rolled back, then undo and redo around a newer write (R3). */
const undoAroundTransaction: Shape = {
  needs: ['transact', 'confirm', 'rollback', 'undo', 'redo', 'setLeaf'],
  plugins: true,
  segments: fc
    .record({
      path: leaf,
      v: value,
      both: fc.boolean(),
      how: fc.constantFrom<'confirm' | 'rollback'>('confirm', 'rollback'),
      newer: fc.constantFrom('none', 'before-undo', 'before-redo'),
      redo: fc.boolean(),
    })
    .map(({ path, v, both, how, newer, redo }) => {
      const second: LeafPath = path === 'a' ? 'cfg.p' : 'a';
      const body: WriteOp[] = [{ kind: 'setLeaf', path, value: v }];
      if (both) body.push({ kind: 'setLeaf', path: second, value: v });
      const newerWrite = one(write({ kind: 'setLeaf', path, value: other(v) }));
      const segments: Step[][] = [one(transact(body, true)), one(settle(how, 0))];
      if (newer === 'before-undo') segments.push(newerWrite);
      segments.push(one({ kind: 'undo' }));
      if (newer === 'before-redo') segments.push(newerWrite);
      if (redo || newer === 'before-redo') segments.push(one({ kind: 'redo' }));
      return segments;
    }),
};

/** A throwing observer on a location a transaction writes (T10). */
const throwingObserver: Shape = {
  needs: ['observerOpen', 'transact', 'confirm', 'rollback', 'setLeaf'],
  plugins: true,
  segments: fc
    .record({ path: fc.constantFrom(...OBSERVED_PATHS), v: value, how: fc.constantFrom<'confirm' | 'rollback'>('confirm', 'rollback') })
    .map(({ path, v, how }) => {
      const target: LeafPath = path === 'cfg' ? 'cfg.p' : path;
      return [
        one({ kind: 'observerOpen', path }),
        one(transact([{ kind: 'setLeaf', path: target, value: v }])),
        one(settle(how, 0)),
        one(write({ kind: 'setLeaf', path: target, value: other(v) })),
      ];
    }),
};

/** A link disposed while a transaction on its source is pending (L1). */
const disposedLink: Shape = {
  needs: ['linkOpen', 'linkDispose', 'linkAck', 'transact', 'confirm', 'setLeaf', 'setBranch'],
  plugins: true,
  segments: fc
    .record({
      source: fc.constantFrom<LinkSource>('a', 'cfg'),
      mode: fc.constantFrom<'sync' | 'deferred'>('sync', 'deferred'),
      v: value,
    })
    .map(({ source, mode, v }) => {
      const w = (n: number): WriteOp => (source === 'a' ? { kind: 'setLeaf', path: 'a', value: n } : { kind: 'setBranch', p: n, q: n });
      return [
        one({ kind: 'linkOpen', source, mode }),
        one(transact([w(v)])),
        one({ kind: 'linkDispose', link: 0 }),
        one(settle('confirm', 0)),
        one(write(w(other(v)))),
        one({ kind: 'linkAck', link: 0, ok: true }),
      ];
    }),
};

/**
 * Observers on a leaf and on a row, some throwing or writing reentrantly, then
 * writes that reach them, skip them (the same value again, another row,
 * another field) or publish a whole turn (a transaction rolled back, an undo)
 * (O1, O2, O4, X3).
 */
const observed: Shape = {
  needs: ['observe', 'addOne', 'setLeaf', 'updateOne', 'setField', 'transact', 'rollback', 'undo'],
  weight: 2,
  plugins: true,
  segments: fc
    .record({
      keys: twoKeys,
      v: value,
      watchers: fc.integer({ min: 0, max: 2 ** 9 - 1 }),
      order: fc.array(fc.nat({ max: 6 }), { minLength: 3, maxLength: 6 }),
    })
    .map(({ keys: [k, second], v, watchers, order }) => {
      const watch = (reader: Reader, react: Reaction = { kind: 'none' }): Op => ({ kind: 'observe', reader, react });
      const all: Op[] = [
        watch({ kind: 'leaf', path: 'a' }),
        watch({ kind: 'leaf', path: 'a' }, { kind: 'throw' }),
        watch({ kind: 'leaf', path: 'a' }, { kind: 'write', path: 'cfg.q' }),
        watch({ kind: 'leaf', path: 'cfg.q' }),
        watch({ kind: 'field', id: k, field: 'n' }),
        watch({ kind: 'field', id: k, field: 'n' }, { kind: 'throw' }),
        watch({ kind: 'field', id: k, field: 'm' }, { kind: 'write', path: 'a' }),
        watch({ kind: 'all' }),
        watch({ kind: 'count' }),
        // Subscribed after the writers, so it runs after their reentrant writes (O4).
        watch({ kind: 'leaf', path: 'a' }),
      ];
      // The first and last observers on `a`, and a writer on `a` three times in four.
      const chosen = all.filter((_, i) => i === 0 || i === all.length - 1 || (i === 2 && watchers % 4 !== 0) || (watchers >> i) % 2 === 1);
      const writes: Step[][] = [
        one(write({ kind: 'setLeaf', path: 'a', value: v })),
        one(write({ kind: 'setLeaf', path: 'a', value: v })),
        one(write({ kind: 'updateOne', id: second, field: 'n', value: v })),
        one(write({ kind: 'setField', id: k, field: 'n', value: 0 })),
        one(write({ kind: 'updateOne', id: k, field: 'm', value: v })),
        [
          step(transact([{ kind: 'setLeaf', path: 'a', value: other(v) }, { kind: 'setLeaf', path: 'cfg.p', value: v }])),
          step(settle('rollback', 0)),
        ],
        [step(write({ kind: 'setLeaf', path: 'a', value: other(v) }, 'undoable')), step({ kind: 'undo' })],
      ];
      return [
        [step(write({ kind: 'addOne', row: { id: k, n: 0, m: 0 } })), step(write({ kind: 'addOne', row: { id: second, n: 0, m: 0 } }))],
        chosen.map((op) => step(op)),
        ...order.map((i) => writes[i] as Step[]),
      ];
    }),
};

/** An awaiting transact() or undoable() scope, then the rollback or undo that would reverse it (W5). */
const awaitScope: Shape = {
  needs: ['scopeAwait', 'setLeaf', 'updateOne', 'addOne', 'rollback', 'undo'],
  weight: 3,
  plugins: true,
  segments: fc
    .record({
      scope: fc.constantFrom<'transact' | 'undoable'>('transact', 'undoable'),
      paths: fc.tuple(leaf, leaf).filter(([x, y]) => x !== y),
      k: key,
      row: fc.boolean(),
      v: value,
    })
    .map(({ scope, paths: [x, y], k, row, v }) => {
      const after: WriteOp = row ? { kind: 'updateOne', id: k, field: 'm', value: v } : { kind: 'setLeaf', path: y, value: v };
      return [
        ...(row ? [one(write({ kind: 'addOne', row: { id: k, n: 0, m: 0 } }))] : []),
        one({ kind: 'scopeAwait', scope, before: [{ kind: 'setLeaf', path: x, value: v }], after: [after] }),
        one(scope === 'transact' ? settle('rollback', 0) : { kind: 'undo' }),
      ];
    }),
};

/**
 * destroy(), then reads and writes of every kind (D1). Appended to some
 * focused sequences, after their own steps, so every shape keeps what it
 * reaches and nothing is drawn less often.
 */
const disposal: fc.Arbitrary<Step[]> = fc
  .record({ k: key, v: value, after: fc.shuffledSubarray([0, 1, 2, 3, 4, 5, 6], { minLength: 2, maxLength: 4 }) })
  .map(({ k, v, after }) => {
    const later: Op[] = [
      write({ kind: 'setLeaf', path: 'a', value: v }),
      write({ kind: 'addOne', row: { id: k, n: v, m: 0 } }),
      transact([{ kind: 'setLeaf', path: 'cfg.p', value: v }]),
      { kind: 'undo' },
      { kind: 'observe', reader: { kind: 'leaf', path: 'a' }, react: { kind: 'none' } },
      { kind: 'rowHold', id: k },
      { kind: 'hydrate' },
    ];
    return [step({ kind: 'destroy' }), ...after.map((i) => step(later[i] as Op))];
  });

/** Mixes random steps into the gaps between a shape's segments, mostly none. */
function withNoise(segments: fc.Arbitrary<Step[][]>, noise: fc.Arbitrary<Step>, maxSteps: number): fc.Arbitrary<Step[]> {
  const gap = fc.oneof(
    { arbitrary: fc.constant<Step[]>([]), weight: 4 },
    { arbitrary: fc.array(noise, { minLength: 1, maxLength: 2 }), weight: 1 }
  );
  return fc
    .tuple(segments, fc.array(gap, { minLength: 8, maxLength: 8 }))
    .map(([segs, gaps]) => segs.flatMap((seg, i) => (i === 0 ? seg : [...(gaps[i - 1] ?? []), ...seg])).slice(0, maxSteps));
}

export function focusedArb(options: {
  readonly kinds: ReadonlySet<OpKind>;
  readonly plugins: PluginMode;
  readonly maxSteps: number;
  readonly noise: fc.Arbitrary<Step>;
}): fc.Arbitrary<Sequence> | undefined {
  const shapes = [
    overlapping(options.kinds.has('inspect')),
    newerTruth,
    laterTouch,
    heldRow,
    undoOverNewer,
    undoAroundTransaction,
    throwingObserver,
    disposedLink,
    observed,
    awaitScope,
  ].filter(
    (shape) => shape.needs.every((kind) => options.kinds.has(kind)) && !(shape.plugins && options.plugins === 'none')
  );
  if (shapes.length === 0) return undefined;
  const on = options.plugins !== 'none';
  const disposalKinds: readonly OpKind[] = ['destroy', 'setLeaf', 'addOne', 'transact', 'undo', 'observe', 'rowHold', 'hydrate'];
  const ending = disposalKinds.every((kind) => options.kinds.has(kind))
    ? fc.oneof({ arbitrary: fc.constant<Step[]>([]), weight: 4 }, { arbitrary: disposal, weight: 1 })
    : fc.constant<Step[]>([]);
  const shaped = fc.oneof(
    ...shapes.map((shape) => ({ arbitrary: withNoise(shape.segments, options.noise, options.maxSteps), weight: shape.weight ?? 2 }))
  );
  return fc.tuple(shaped, ending).map(([steps, end]) => ({
    config: { transactions: on, restoration: on },
    steps: [...steps, ...end].slice(0, options.maxSteps),
  }));
}
