#!/usr/bin/env node
// F3 — structural owner resolution and the sparse settlement edge.
//
// DEPENDENCY-1F proved captured read identity is trustworthy. It did NOT prove
// the next box:
//
//     captured DependencyNode
//       -> which pending contribution currently OWNS this fact?
//       -> sparse edge P2 -> P1
//
// That is what this probe tests, using existing kernel APIs rather than a new
// addressing system: getNodeAddress(node) gives a node's address, and a pending
// turn already carries positionIds whose addresses come from
// PositionRegistry.addressFor(). Matching those resolves the owner.
//
// Verdict is the exit code. Run unpiped.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const TARGET = 'packages/kernel/src/lib/internals/location-runtime.ts';

const PATCH_TRACK = [
  `  if (activeConsumer) {`,
  `    if (activeConsumer.__capture) {`,
  `      let e = activeConsumer.dependencies.get(node);`,
  `      if (!e) { const r = new WeakRef(activeConsumer); e = { reference: r, version: node.version };`,
  `        node.consumers.add(r); activeConsumer.dependencies.set(node, e); } else { e.version = node.version; }`,
  `      const outer = activeConsumer; activeConsumer = outer.__outer;`,
  `      try { trackDependency(node, token); } finally { activeConsumer = outer; }`,
  `      return;`,
  `    }`,
].join('\n');

const SEAM = `
export function __spikeCaptureReads(run) {
  const collected = new Map();
  const consumer = { dependencies: collected, level: 0, invalidate() {}, settle() {},
    __capture: true, __outer: undefined };
  const previous = activeConsumer;
  consumer.__outer = previous;
  activeConsumer = consumer;
  try { run(); } finally {
    activeConsumer = previous;
    for (const node of collected.keys())
      for (const ref of node.consumers)
        if (ref.deref() === consumer) node.consumers.delete(ref);
  }
  return [...collected.keys()];
}
`;

const bundled = await build({
  stdin: {
    contents: `export {signalTree, entityMap} from './packages/kernel/src/index';
export {transactions, peekInternalTransactionRuntime} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {getPositionRegistry, getNodeAddress} from './packages/kernel/src/lib/internals/position-registry';
export {__spikeCaptureReads} from './${TARGET.replace(/\.ts$/, '')}';`,
    resolveDir: root,
    sourcefile: 'f3-entry.ts',
    loader: 'ts',
  },
  absWorkingDir: root,
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  plugins: [
    {
      name: 'inject-read-capture-seam',
      setup(b) {
        b.onLoad({ filter: /location-runtime\.ts$/ }, ({ path }) => {
          if (relative(root, path) !== TARGET) return null;
          const source = readFileSync(path, 'utf8');
          const anchor = '  if (activeConsumer) {';
          if (!source.includes(anchor)) throw new Error('ANCHOR MISS: trackDependency');
          return { contents: source.replace(anchor, PATCH_TRACK) + SEAM, loader: 'ts', resolveDir: dirname(path) };
        });
      },
    },
  ],
});
const K = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);

const checks = [];
const check = (ok, label, detail) => {
  checks.push({ label, ok, ...(detail ? { detail } : {}) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  -- ${detail}`}`);
};
const flush = async (n) => {
  n.flushSync();
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const addr = (node) => {
  const a = K.getNodeAddress(node);
  return a ? a.join('\u0000') : undefined;
};

/** Owner resolution: which pending turn wrote the location this node names? */
const ownerOf = (tree, runtime, node) => {
  const registry = K.getPositionRegistry(tree.$);
  const want = addr(node);
  if (want === undefined) return { owner: undefined, reason: 'node has no address' };
  for (const turnId of runtime.getPendingTurnIds()) {
    let described;
    try {
      described = runtime.describePendingTurn(turnId);
    } catch {
      continue;
    }
    const positions = described?.__positionIds ?? described?.positionIds ?? [];
    for (const position of positions) {
      const a = registry?.addressFor(position);
      if (a && a.join('\u0000') === want) return { owner: turnId };
    }
  }
  return { owner: undefined, reason: 'no pending turn claims this address' };
};

const make = () => {
  const tree = K.signalTree(
    { rows: K.entityMap({ selectId: (r) => r.id }) },
    { enhancers: [K.transactions()] }
  );
  return { tree, runtime: K.peekInternalTransactionRuntime(tree) };
};

// ------------------------------------------------------------------- F3-A
{
  const n = K.getPathNotifier();
  const { tree, runtime } = make();
  try {
    // P1 creates subject S1 at key A, and stays PENDING.
    const p1 = tree.transact(() => tree.$.rows.addOne({ id: 'A', name: 'a', score: 1 }));
    await flush(n);
    const p1Turns = runtime.getPendingTurnIds();
    check(p1Turns.length === 1, 'F3-A P1 is pending', `turns=${JSON.stringify(p1Turns)}`);

    // P2 reads S1.score while P1 is still pending.
    let readNodes = [];
    const p2 = tree.transact(() => {
      readNodes = K.__spikeCaptureReads(() => {
        const s1 = tree.$.rows.byIdOrFail('A');
        tree.$.rows.updateOne('A', { score: s1.score() + 10 });
      });
    });
    await flush(n);
    check(readNodes.length > 0, 'F3-A P2 captured a read of the pending-created subject',
      `nodes=${readNodes.length}`);

    // Owner resolution over those captured nodes.
    const owners = readNodes.map((node) => ownerOf(tree, runtime, node));
    const resolved = owners.filter((o) => o.owner !== undefined);
    check(resolved.length > 0,
      'F3-A owner resolution identifies a PENDING owner for a captured read',
      `resolved=${resolved.length}/${owners.length} reasons=${JSON.stringify([...new Set(owners.map((o) => o.reason).filter(Boolean))])}`);
    const edge = resolved.some((o) => o.owner === p1Turns[0]);
    check(edge, 'F3-A the sparse edge P2 -> P1 is formed (owner is P1s turn)',
      `owners=${JSON.stringify([...new Set(resolved.map((o) => o.owner))])} p1=${p1Turns[0]}`);

    // Rolling P1 back must not SILENTLY orphan P2's dependent fact.
    let rolled;
    try {
      p1.rollback();
      rolled = 'settled';
    } catch (error) {
      rolled = 'refused';
    }
    await flush(n);
    const present = tree.$.rows.ids().includes('A');
    check(
      rolled === 'refused' || !present,
      'F3-A rolling back P1 either refuses, or removes the subject it created',
      `rollback=${rolled} subjectStillPresent=${present}`
    );
    try { p2.rollback(); } catch { /* settled state is not this checks subject */ }
  } catch (error) {
    check(false, 'F3-A executed', String(error?.message ?? error).slice(0, 150));
  } finally {
    tree.destroy();
  }
}

// ------------------------------------------------------------------- F3-B
// Key reuse: the captured dependency must keep naming the OLD lifetime.
{
  const n = K.getPathNotifier();
  const { tree } = make();
  try {
    tree.$.rows.addOne({ id: 'A', name: 'old', score: 1 });
    await flush(n);
    const [oldNode] = K.__spikeCaptureReads(() => tree.$.rows.byIdOrFail('A').score());
    tree.$.rows.removeOne('A');
    tree.$.rows.addOne({ id: 'A', name: 'fresh', score: 99 });
    await flush(n);
    const [freshNode] = K.__spikeCaptureReads(() => tree.$.rows.byIdOrFail('A').score());
    check(oldNode !== freshNode,
      'F3-B a dependency on the OLD lifetime never becomes one on a fresh same-key subject',
      `sameNode=${oldNode === freshNode}`);
    // The addresses may legitimately match -- that is exactly why address
    // matching alone is NOT sufficient for owner resolution.
    check(true, `F3-B NOTE addresses equal=${addr(oldNode) === addr(freshNode)} (address alone cannot separate lifetimes)`);
  } catch (error) {
    check(false, 'F3-B executed', String(error?.message ?? error).slice(0, 150));
  } finally {
    tree.destroy();
  }
}

writeFileSync(resolve(here, 'f3-owner-resolution.json'), JSON.stringify({ probe: 'F3', checks }, null, 2) + '\n');
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
