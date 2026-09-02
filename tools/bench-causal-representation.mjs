#!/usr/bin/env node
/**
 * CAUSAL REPRESENTATION — incumbent characterization before alternatives.
 *
 * This is intentionally SignalTree-only. `bench-update-matrix.mjs` compares
 * libraries; this harness attributes the existing causal semantics before any
 * representation rewrite is proposed. Each arm proves its postcondition,
 * measures the logical operation including its causal flush, then separately
 * measures the live tree after the shared quiescence protocol.
 *
 * Usage:
 *   node --expose-gc tools/bench-causal-representation.mjs [--samples 5] [--json]
 *   node --expose-gc tools/bench-causal-representation.mjs --arm B2 --json
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

import { quiesce, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-causal-representation.mjs');

const CORE = join(process.cwd(), 'dist/packages/kernel/dist/index.js');
if (!existsSync(CORE)) {
  console.error('Build first: pnpm nx build kernel');
  process.exit(1);
}

const { signalTree, entityMap, external, restoration, undoable } = await import(CORE);
const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const SAMPLES = Number(arg('--samples', 5));
const MEMORY_TREES = Number(arg('--memory-trees', 20));
const requestedArm = arg('--arm', undefined);
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const scalarTree = (capacity = 100) =>
  signalTree(
    { value: 0, second: 0 },
    { enhancers: [restoration({ maxHistorySize: capacity })] }
  );

const rowsTree = (capacity = 100) =>
  signalTree(
    { rows: entityMap({ selectId: (row) => row.id }), value: 0 },
    { enhancers: [restoration({ maxHistorySize: capacity })] }
  );

const row = (id, value = id) => ({ id, value });

const addIndependentScalarTurns = async (tree, count) => {
  for (let value = 1; value <= count; value++) {
    undoable(() => tree.$.value.set(value));
    await flush();
  }
};

const retainedStats = (tree) => {
  const history = tree.getRestorationHistory();
  const turns = tree.__restoration?.getTurns?.() ?? [];
  const claims = new Set(
    turns.flatMap((turn) => turn.restorationSubjectIds ?? [])
  );
  return {
    retainedTurns: history.length,
    retainedClaims: claims.size,
    bytesPerRetainedTurn:
      history.length === 0 ? 0 : undefined,
    bytesPerRetainedClaim:
      claims.size === 0 ? 0 : undefined,
  };
};

const destroyTrees = (trees) => {
  for (const tree of trees) tree.destroy();
};

const measureLiveTrees = async (build, label) => {
  const baseline = await quiesce({ label: `${label} (baseline)` });
  let trees = await build();
  const held = await quiesce({ label: `${label} (held)` });
  const references = trees.map((tree) => new WeakRef(tree));
  destroyTrees(trees);
  trees = undefined;
  await quiesce({ label: `${label} (released)` });
  return {
    retainedBytes: held.heapUsed - baseline.heapUsed,
    quiesceRounds: held.rounds,
    releasedAfterDestroy: references.every((reference) => reference.deref() === undefined),
  };
};

const ARMS = {
  A0: {
    label: 'ordinary undesignated scalar write',
    create: () => scalarTree(),
    run: async (tree) => {
      tree.$.value.set(1);
      await flush();
      if (tree.$.value() !== 1 || tree.getRestorationHistory().length !== 0) {
        throw new Error('A0 postcondition failed');
      }
    },
  },
  A1: {
    label: 'external scalar realization',
    create: () => scalarTree(),
    run: async (tree) => {
      external(() => tree.$.value.set(1));
      await flush();
      if (tree.$.value() !== 1 || tree.getRestorationHistory().length !== 0) {
        throw new Error('A1 postcondition failed');
      }
    },
  },
  B0: {
    label: 'one designated scalar turn',
    create: () => scalarTree(),
    run: async (tree) => {
      undoable(() => tree.$.value.set(1));
      await flush();
      if (tree.$.value() !== 1 || tree.getRestorationHistory().length !== 1) {
        throw new Error('B0 postcondition failed');
      }
    },
  },
  B1: {
    label: 'two scalar writes in one designated turn',
    create: () => scalarTree(),
    run: async (tree) => {
      undoable(() => {
        tree.$.value.set(1);
        tree.$.second.set(2);
      });
      await flush();
      if (tree.getRestorationHistory().length !== 1 || tree.$.second() !== 2) {
        throw new Error('B1 postcondition failed');
      }
    },
  },
  B2: {
    label: '100 independently flushed designated turns',
    create: () => scalarTree(100),
    run: async (tree) => {
      await addIndependentScalarTurns(tree, 100);
      if (tree.getRestorationHistory().length !== 100 || tree.$.value() !== 100) {
        throw new Error('B2 postcondition failed');
      }
    },
  },
  C0: {
    label: 'structural add and remove',
    create: () => rowsTree(),
    run: async (tree) => {
      undoable(() => tree.$.rows.addOne(row('added')));
      await flush();
      undoable(() => tree.$.rows.removeOne('added'));
      await flush();
      if (tree.$.rows.ids().length !== 0 || tree.getRestorationHistory().length !== 2) {
        throw new Error('C0 postcondition failed');
      }
    },
  },
  C1: {
    label: 'structural rekey',
    create: () => rowsTree(),
    setup: async (tree) => {
      tree.$.rows.setAll([row('before')]);
      await flush();
    },
    run: async (tree) => {
      undoable(() => tree.$.rows.changeId('before', 'after'));
      await flush();
      if (tree.$.rows.byId('after')?.() === undefined || tree.getRestorationHistory().length !== 1) {
        throw new Error('C1 postcondition failed');
      }
    },
  },
  C2: {
    label: 'mixed scalar and structural designated turn',
    create: () => rowsTree(),
    run: async (tree) => {
      undoable(() => {
        tree.$.value.set(1);
        tree.$.rows.addOne(row('mixed'));
      });
      await flush();
      if (tree.$.value() !== 1 || tree.$.rows.ids().length !== 1 || tree.getRestorationHistory().length !== 1) {
        throw new Error('C2 postcondition failed');
      }
    },
  },
  C3: {
    label: 'structural reversal and redo',
    create: () => rowsTree(),
    setup: async (tree) => {
      undoable(() => tree.$.rows.addOne(row('reversible')));
      await flush();
    },
    run: async (tree) => {
      tree.undo();
      await flush();
      tree.redo();
      await flush();
      if (tree.$.rows.byId('reversible')?.() === undefined || !tree.canUndo()) {
        throw new Error('C3 postcondition failed');
      }
    },
  },
  C4: {
    label: 'entity field mutation',
    create: () => rowsTree(),
    setup: async (tree) => {
      tree.$.rows.setAll([row('entity', 'before')]);
      await flush();
    },
    run: async (tree) => {
      undoable(() => tree.$.rows.updateOne('entity', { value: 'after' }));
      await flush();
      if (tree.$.rows.byId('entity')?.()?.value !== 'after' || tree.getRestorationHistory().length !== 1) {
        throw new Error('C4 postcondition failed');
      }
    },
  },
  C5: {
    label: 'entity omission and restoration reactivation',
    create: () => rowsTree(),
    setup: async (tree) => {
      tree.$.rows.setAll([row('omitted')]);
      await flush();
    },
    run: async (tree) => {
      undoable(() => tree.$.rows.removeOne('omitted'));
      await flush();
      tree.undo();
      await flush();
      if (tree.$.rows.byId('omitted')?.() === undefined || !tree.canRedo()) {
        throw new Error('C5 postcondition failed');
      }
    },
  },
  E0: {
    label: 'undo one scalar turn',
    create: () => scalarTree(),
    setup: async (tree) => {
      undoable(() => tree.$.value.set(1));
      await flush();
    },
    run: async (tree) => {
      tree.undo();
      await flush();
      if (tree.$.value() !== 0 || !tree.canRedo()) throw new Error('E0 postcondition failed');
    },
  },
  E1: {
    label: 'undo structural turn',
    create: () => rowsTree(),
    setup: async (tree) => {
      undoable(() => tree.$.rows.addOne(row('undo')));
      await flush();
    },
    run: async (tree) => {
      tree.undo();
      await flush();
      if (tree.$.rows.ids().length !== 0 || !tree.canRedo()) throw new Error('E1 postcondition failed');
    },
  },
  E2: {
    label: 'redo scalar turn',
    create: () => scalarTree(),
    setup: async (tree) => {
      undoable(() => tree.$.value.set(1));
      await flush();
      tree.undo();
      await flush();
    },
    run: async (tree) => {
      tree.redo();
      await flush();
      if (tree.$.value() !== 1) throw new Error('E2 postcondition failed');
    },
  },
  F0: {
    label: 'public history projection of one turn',
    create: () => scalarTree(),
    setup: async (tree) => {
      undoable(() => tree.$.value.set(1));
      await flush();
    },
    run: async (tree) => {
      if (tree.getRestorationHistory().length !== 1) throw new Error('F0 postcondition failed');
    },
  },
  F1: {
    label: 'public history projection of 100 turns',
    create: () => scalarTree(100),
    setup: async (tree) => {
      await addIndependentScalarTurns(tree, 100);
    },
    run: async (tree) => {
      const history = tree.getRestorationHistory();
      if (history.length !== 100 || history.at(-1)?.state.value !== 100) {
        throw new Error('F1 postcondition failed');
      }
    },
  },
};

for (const [id, capacity, turns] of [
  ['D0', 0, 30],
  ['D1', 1, 30],
  ['D2', 20, 30],
  ['D3', 100, 100],
]) {
  ARMS[id] = {
    label: `retained history capacity ${capacity}`,
    create: () => scalarTree(capacity),
    run: async (tree) => {
      await addIndependentScalarTurns(tree, turns);
      if (tree.getRestorationHistory().length !== Math.min(capacity, turns)) {
        throw new Error(`${id} postcondition failed`);
      }
    },
  };
}

ARMS.D4 = {
  label: 'churn beyond a 20-turn history capacity',
  create: () => scalarTree(20),
  run: async (tree) => {
    await addIndependentScalarTurns(tree, 130);
    if (tree.getRestorationHistory().length !== 20 || tree.$.value() !== 130) {
      throw new Error('D4 postcondition failed');
    }
  },
};

ARMS.E3 = {
  label: 'scoped undo through collection containment',
  create: () => rowsTree(),
  setup: async (tree) => {
    undoable(() => tree.$.rows.addOne(row('scoped')));
    await flush();
  },
  run: async (tree) => {
    const positionId = tree.$.rows.__positionIds?.[0];
    const undone = positionId === undefined
      ? false
      : tree.__restoration?.undoAt(positionId);
    await flush();
    if (!undone || tree.$.rows.ids().length !== 0) {
      throw new Error('E3 postcondition failed');
    }
  },
};

const arms = requestedArm ? { [requestedArm]: ARMS[requestedArm] } : ARMS;
if (Object.values(arms).some((arm) => arm === undefined)) {
  throw new Error(`Unknown arm: ${requestedArm}`);
}

const median = (values) => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
const restorationModule = join(process.cwd(), 'dist/packages/kernel/dist/enhancers/restoration/restoration.js');
const report = {
  samples: SAMPLES,
  memoryTrees: MEMORY_TREES,
  restorationModuleRawBytes: statSync(restorationModule).size,
  restorationModuleGzipBytes: gzipSync(readFileSync(restorationModule)).length,
  peakHighWaterHeap: 'omitted: allocation is not retained heap',
  arms: {},
};

for (const [id, arm] of Object.entries(arms)) {
  const operationSamples = [];
  for (let sample = 0; sample < SAMPLES; sample++) {
    const tree = arm.create();
    await arm.setup?.(tree);
    const start = performance.now();
    await arm.run(tree);
    operationSamples.push((performance.now() - start) * 1000);
    tree.destroy();
  }

  const memorySamples = [];
  let stats;
  for (let sample = 0; sample < SAMPLES; sample++) {
    const memory = await measureLiveTrees(async () => {
      const trees = [];
      for (let instance = 0; instance < MEMORY_TREES; instance++) {
        const tree = arm.create();
        await arm.setup?.(tree);
        await arm.run(tree);
        stats ??= retainedStats(tree);
        trees.push(tree);
      }
      return trees;
    }, `causal/${id}/sample-${sample + 1}`);
    if (!memory.releasedAfterDestroy) {
      throw new Error(`${id}: benchmark-owned tree was not released after destroy()`);
    }
    memorySamples.push(memory);
  }

  const retainedBytes = median(memorySamples.map((sample) => sample.retainedBytes)) / MEMORY_TREES;
  report.arms[id] = {
    label: arm.label,
    operationMedianUs: +median(operationSamples).toFixed(3),
    operationMinUs: +Math.min(...operationSamples).toFixed(3),
    operationMaxUs: +Math.max(...operationSamples).toFixed(3),
    retainedBytesPerLiveTree: +retainedBytes.toFixed(1),
    retainedBytesPerLiveTreeMin: +(
      Math.min(...memorySamples.map((sample) => sample.retainedBytes)) / MEMORY_TREES
    ).toFixed(1),
    retainedBytesPerLiveTreeMax: +(
      Math.max(...memorySamples.map((sample) => sample.retainedBytes)) / MEMORY_TREES
    ).toFixed(1),
    retainedClaims: stats.retainedClaims,
    retainedTurns: stats.retainedTurns,
    bytesPerRetainedTurn: stats.retainedTurns === 0 ? 0 : +(retainedBytes / stats.retainedTurns).toFixed(1),
    bytesPerRetainedClaim: stats.retainedClaims === 0 ? 0 : +(retainedBytes / stats.retainedClaims).toFixed(1),
    releasedAfterDestroy: true,
    quiesceRounds: Math.max(...memorySamples.map((sample) => sample.quiesceRounds)),
  };
}

const capacityZeroBytes = report.arms.D0?.retainedBytesPerLiveTree;
if (capacityZeroBytes !== undefined) {
  for (const id of ['D1', 'D2', 'D3', 'D4']) {
    const arm = report.arms[id];
    if (arm === undefined) continue;
    const retainedBytesOverCapacity0 = arm.retainedBytesPerLiveTree - capacityZeroBytes;
    arm.retainedBytesOverCapacity0 = +retainedBytesOverCapacity0.toFixed(1);
    arm.incrementalBytesPerRetainedTurnOverCapacity0 = arm.retainedTurns === 0
      ? 0
      : +(retainedBytesOverCapacity0 / arm.retainedTurns).toFixed(1);
  }
  if (report.arms.D2 !== undefined && report.arms.D4 !== undefined) {
    report.arms.D4.retainedBytesOverSteady20TurnWindow = +(
      report.arms.D4.retainedBytesPerLiveTree - report.arms.D2.retainedBytesPerLiveTree
    ).toFixed(1);
  }
}

console.log(JSON.stringify(report, null, 2));
