import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const baseline = '7ade0e3ecb25ff0d06da4355b5f7d67844e147b7';
export const limitations = Object.freeze([
  'Live profile only; no canonical or isolated draft projection is available.',
  'No revision ordering, authority settlement relations, or per-operation disposition reader.',
  'state().authority reads this handle’s actual pending ID through a test-only private reader (instrumented). Empty transactions may have no pending ID.',
  'Terminal state().status reflects successful native handle calls, not a kernel terminal ledger. Conflicting successful outcomes are unsupported; repeated calls always reach the native handle.',
  'observe() is instrumented: real PathNotifier onFlush observations, filtered to changed tree snapshots; timing is native and deferred.',
  'flush() is the explicit test-only global PathNotifier.flushSync helper; other operations do not implicitly flush.',
  'write(..., {defer:true}) is unsupported and throws before mutation; no deferred composition is substituted with direct writes.',
  'link() is unsupported: the native asynchronous protocol cannot establish the synchronous claims in this protocol.',
  'Numeric scalar path segments are unsupported: object property coercion cannot preserve the protocol’s typed path distinction.',
  'stats() is unsupported: the implementation does not expose the protocol’s retained-operation metric.',
  'diagnostics does not install a synthetic observer; instrumentation readers do not change transaction semantics.',
]);

export class Unsupported extends Error {
  constructor(message) { super(message); this.name = 'Unsupported'; }
}
const unsupported = message => { throw new Unsupported(message); };
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// Read committed source into esbuild, without checkout, generated files, dist,
// or production edits. Only this experiment entry comes from the working tree.
const bundled = await build({
  entryPoints: [resolve(root, 'tools/experiments/transaction-options/current-entry.ts')],
  absWorkingDir: root,
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  plugins: [{
    name: 'frozen-current-source',
    setup(builder) {
      builder.onLoad({ filter: /\/packages\/kernel\/src\/.*\.ts$/ }, ({ path }) => ({
        contents: execFileSync('git', ['show', `${baseline}:${relative(root, path)}`], {
          cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
        }),
        loader: 'ts',
        resolveDir: dirname(path),
      }));
    },
  }],
});
const native = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

const defaultSeed = {
  values: ['x', 'y', 'z'].map(key => ({ path: [key], value: 0 })),
  entities: [{ ref: 'original', key: 'A', fields: { name: 'Original', priority: 0 } }],
};
function checkPath(path) {
  if (!Array.isArray(path) || !path.length || path.some(key => typeof key !== 'string')) {
    unsupported('Only nonempty string-segment scalar paths are representable by this adapter.');
  }
}

export function create({ profile = 'live', seed = defaultSeed } = {}) {
  if (profile !== 'live') unsupported('CURRENT has no isolated draft profile.');
  const initial = {};
  const paths = (seed.values ?? defaultSeed.values).map(({ path, value }) => {
    checkPath(path);
    let node = initial;
    for (const key of path.slice(0, -1)) {
      if (!Object.hasOwn(node, key)) Object.defineProperty(node, key, { value: {}, enumerable: true, writable: true, configurable: true });
      node = node[key];
    }
    Object.defineProperty(node, path.at(-1), { value: structuredClone(value), enumerable: true, writable: true, configurable: true });
    return [...path];
  });
  const tree = native.signalTree(
    { values: initial, entities: native.entityMap() },
    { enhancers: [native.transactions(), native.restoration()] },
  );
  const rows = tree.$.entities;
  const refs = new Map();
  const subscriptions = new Set();
  const handles = new Map();
  const add = ({ ref, key, fields }) => {
    if (refs.has(ref)) unsupported('Entity labels must designate one held lifetime; label reuse is unsupported.');
    rows.addOne(structuredClone(fields), { selectId: () => key });
    refs.set(ref, rows.byIdOrFail(key));
  };
  try {
    native.external(() => {
      for (const row of seed.entities ?? defaultSeed.entities) add(row);
    });
  } catch (error) { tree.destroy(); throw error; }
  const runtime = native.instrumentedTransactionReader(tree);
  const notifier = native.instrumentedPathNotifier();

  const nodeAt = path => {
    checkPath(path);
    let node = tree.$.values;
    for (const key of path) node = node?.[key];
    if (typeof node !== 'function') unsupported(`No native scalar location for ${JSON.stringify(path)}; declare it in seed.`);
    return node;
  };
  const held = ref => {
    if (!refs.has(ref)) throw new Error(`Unknown entity reference: ${ref}`);
    return refs.get(ref);
  };
  const currentKey = ref => {
    const node = held(ref);
    for (const key of rows.ids()) if (rows.byId(key) === node) return key;
    unsupported(`Held entity ${ref} has no current key; cannot target a replacement lifetime.`);
  };
  const apply = ops => {
    for (const op of ops) {
      switch (op.kind) {
        case 'set': nodeAt(op.path)(structuredClone(op.value)); break;
        case 'add': add(op); break;
        case 'field': {
          const field = held(op.ref)[op.field];
          if (typeof field !== 'function') unsupported(`No native field ${op.field}.`);
          field(structuredClone(op.value));
          break;
        }
        case 'rekey': rows.changeId(currentKey(op.ref), op.key); break;
        case 'remove': rows.removeOne(currentKey(op.ref)); break;
        default: unsupported(`Unknown operation ${op.kind}.`);
      }
    }
  };
  const read = () => ({
    values: paths.map(path => ({ path: [...path], value: structuredClone(nodeAt(path)()) })),
    entities: rows.ids().map(key => {
      const node = rows.byIdOrFail(key);
      const entry = [...refs].find(([, heldNode]) => heldNode === node);
      if (!entry) unsupported('A live entity has no test-held reference label.');
      return { ref: entry[0], key, fields: structuredClone(node()) };
    }),
  });
  const getHandle = id => {
    const record = handles.get(id);
    if (!record) throw new Error('Unknown transaction handle.');
    return record;
  };
  const settle = (id, method, status) => {
    const record = getHandle(id);
    try {
      // Always invoke the real handle, including repeats and opposite calls.
      record.handle[method]();
      record.observedOutcomes.add(status);
      return { status: 'settled' };
    } catch (error) {
      if (error?.name === 'SignalTreeRollbackError' ||
          /^Cannot (confirm a rolled back|rollback a confirmed) transaction$/.test(error?.message ?? '')) {
        return { status: 'refused', reason: error.message };
      }
      throw error;
    }
  };
  return {
    baseline, limitations, instrumentation: 'private pending-ID reader and PathNotifier observation/flush',
    begin(ops) {
      const before = new Set(runtime.getPendingTurnIds());
      const handle = tree.transact(() => apply(ops));
      const created = runtime.getPendingTurnIds().filter(id => !before.has(id));
      if (created.length > 1) throw new Error('One transact unexpectedly created multiple pending IDs.');
      handles.set(handle, { handle, turnId: created[0], observedOutcomes: new Set() });
      return handle;
    },
    accept: id => settle(id, 'confirm', 'accepted'),
    reject: id => settle(id, 'rollback', 'rejected'),
    write(ops, { context = 'local', defer = false } = {}) {
      if (defer) unsupported('Requested deferred composition has no implemented native coalesce mapping.');
      const run = () => apply(ops);
      if (context === 'external') native.external(run);
      else if (context === 'undoable') native.undoable(run);
      else if (context === 'local') run();
      else unsupported(`Unknown write context ${context}.`);
      return { status: 'settled' };
    },
    flush() { notifier.flushSync(); },
    authority() { unsupported('CURRENT has no authority payload/revision/settlement-relation API.'); },
    read,
    canonical() { unsupported('CURRENT has no separate canonical snapshot reader.'); },
    draft() { unsupported('CURRENT has no isolated draft snapshot.'); },
    state(id) {
      const record = getHandle(id);
      const authority = runtime.getPendingTurnIds().includes(record.turnId);
      return {
        get status() {
          if (authority) return 'pending';
          if (record.observedOutcomes.size > 1) return unsupported('Conflicting successful handle outcomes; no kernel terminal ledger is available.');
          if (record.observedOutcomes.size === 1) return [...record.observedOutcomes][0];
          return unsupported('No pending record or observed successful settlement for this handle.');
        },
        authority,
        get dispositions() { return unsupported('CURRENT does not expose per-operation dispositions.'); },
      };
    },
    observe(callback) {
      let previous = read();
      const unsubscribe = notifier.onFlush(() => {
        const snapshot = read();
        if (isDeepStrictEqual(previous, snapshot)) return;
        previous = structuredClone(snapshot);
        callback(snapshot);
      });
      const off = () => { unsubscribe(); subscriptions.delete(off); };
      subscriptions.add(off);
      return off;
    },
    link() { unsupported('Native links are asynchronous; synchronous protocol claims are unavailable.'); },
    undo() { tree.undo(); return { status: 'settled' }; },
    stats() { unsupported('No native retained-operation metric for this protocol.'); },
    destroy() {
      try { tree.destroy(); }
      finally { for (const off of subscriptions) off(); refs.clear(); handles.clear(); }
    },
  };
}
