#!/usr/bin/env node
/**
 * RESTORATION-HOT-PATH-0: attribute one already-retained scalar undo.
 *
 * This is internal calibration, not a product comparison. Setup and turn
 * retention happen outside every timer. The effect-pipeline arm invokes the
 * manager's retained-effect application closure. The physical arm precomputes
 * scalar reversal effects and calls the production realization port directly.
 *
 * Usage:
 *   node tools/bench-restoration-hot-path.mjs
 *   node tools/bench-restoration-hot-path.mjs --samples 50 --json
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist/packages/kernel/dist');
const INDEX = join(DIST, 'index.js');
if (!existsSync(INDEX)) {
  console.error('build first: pnpm nx build kernel');
  process.exit(1);
}

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const TURN_COUNT = Number(argument('--turns', 20));
const SAMPLE_COUNT = Number(argument('--samples', 30));
const WARMUP_COUNT = Number(argument('--warmups', 5));
const JSON_ONLY = process.argv.includes('--json');
const PRODUCTION_MODE = process.argv.includes('--production');
for (const [name, value] of [
  ['turns', TURN_COUNT],
  ['samples', SAMPLE_COUNT],
  ['warmups', WARMUP_COUNT],
]) {
  if (!Number.isSafeInteger(value) || value < (name === 'warmups' ? 0 : 1)) {
    throw new RangeError(
      `${name} must be a ${
        name === 'warmups' ? 'non-negative' : 'positive'
      } safe integer`
    );
  }
}

if (PRODUCTION_MODE) {
  process.env.NODE_ENV = 'production';
}

const [
  { entityMap, restoration, signalTree, undoable },
  { getTreeRealizationPort },
] = await Promise.all([
  import(INDEX),
  import(
    join(DIST, 'lib/internals/causal-runtime/tree-realization-adapter.js')
  ),
]);

const now = () => process.hrtime.bigint();
const elapsedNs = (startedAt) => Number(now() - startedAt);
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};
const summarize = (values) => ({
  minUs: Math.min(...values) / 1_000,
  medianUs: median(values) / 1_000,
  maxUs: Math.max(...values) / 1_000,
});

async function createFixture() {
  const tree = signalTree(
    { rows: entityMap({ selectId: (row) => row.id }) },
    { enhancers: [restoration({ maxHistorySize: TURN_COUNT + 5 })] }
  );
  tree.$.rows.setAll([{ id: 0, value: 0 }]);
  await Promise.resolve();
  tree.resetRestorationHistory();

  const held = tree.$.rows.byId(0);
  if (!held) throw new Error('fixture did not materialize the retained entity');

  for (let index = 1; index <= TURN_COUNT; index++) {
    undoable(() => tree.$.rows.updateOne(0, { value: index }));
    await Promise.resolve();
  }

  const manager = tree.__restoration;
  if (!manager || manager.history.length !== TURN_COUNT) {
    tree.destroy();
    throw new Error(
      `fixture retained ${
        manager?.history.length ?? 0
      } turns, expected ${TURN_COUNT}`
    );
  }
  const port = getTreeRealizationPort(tree) ?? getTreeRealizationPort(tree.$);
  if (!port) {
    tree.destroy();
    throw new Error('fixture has no realization port');
  }
  return { tree, held, manager, port };
}

const expectedValueAfterUndo = (index) => TURN_COUNT - index - 1;

function assertStableEntity(fixture, index) {
  if (fixture.tree.$.rows.byId(0) !== fixture.held) {
    throw new Error(`entity identity changed after undo ${index + 1}`);
  }
  const value = fixture.held()?.value;
  const expected = expectedValueAfterUndo(index);
  if (value !== expected) {
    throw new Error(
      `undo ${index + 1} restored ${String(value)}, expected ${expected}`
    );
  }
}

function wrapMethod(target, name, profile, restores) {
  const original = target?.[name];
  if (typeof original !== 'function') return;
  profile[name] = { calls: 0, totalNs: 0 };
  target[name] = function (...args) {
    const startedAt = now();
    try {
      return original.apply(this, args);
    } finally {
      profile[name].calls += 1;
      profile[name].totalNs += elapsedNs(startedAt);
    }
  };
  restores.push(() => {
    target[name] = original;
  });
}

function instrument(fixture) {
  const profile = {};
  const restores = [];
  for (const name of [
    'hasAppliedConfirmedTurns',
    'getLatestAppliedTurn',
    'resolveContainedUndoClosure',
    'resolveUndoClosure',
    'applyTurnEffects',
    'undoPosition',
    'bumpFrontiers',
    'assertTurnStatusConsistency',
  ]) {
    wrapMethod(fixture.manager, name, profile, restores);
  }
  wrapMethod(fixture.manager, 'applyEffectsFn', profile, restores);

  wrapMethod(fixture.port, 'validateEffects', profile, restores);
  wrapMethod(fixture.port, 'applyAtomically', profile, restores);
  return {
    profile,
    restore() {
      for (const restore of restores.reverse()) restore();
    },
  };
}

function assertProductionCursor(fixture) {
  if (fixture.tree.canUndo())
    throw new Error('production arm still reports canUndo');
  if (!fixture.tree.canRedo())
    throw new Error('production arm did not advance redo state');
  const frontiers = [...fixture.manager.positionFrontiers.values()];
  if (frontiers.length === 0 || frontiers.some((frontier) => frontier !== 0)) {
    throw new Error(
      `production frontiers are ${frontiers.join(',')}, expected all zero`
    );
  }
  if (fixture.manager.history.length !== TURN_COUNT) {
    throw new Error('production undo discarded retained history');
  }
}

async function runRoot({ profile = false, skipConsistencyCheck = false } = {}) {
  const fixture = await createFixture();
  const originalConsistencyCheck = fixture.manager.assertTurnStatusConsistency;
  if (skipConsistencyCheck) {
    fixture.manager.assertTurnStatusConsistency = () => undefined;
  }
  const instrumentation = profile ? instrument(fixture) : undefined;
  try {
    const startedAt = now();
    for (let index = 0; index < TURN_COUNT; index++) {
      fixture.tree.undo();
      assertStableEntity(fixture, index);
    }
    const durationNs = elapsedNs(startedAt);
    assertProductionCursor(fixture);
    return { durationNs, profile: instrumentation?.profile };
  } finally {
    instrumentation?.restore();
    fixture.manager.assertTurnStatusConsistency = originalConsistencyCheck;
    fixture.tree.destroy();
  }
}

async function runScoped({ profile = false } = {}) {
  const fixture = await createFixture();
  const instrumentation = profile ? instrument(fixture) : undefined;
  const positionId = fixture.manager.history.at(-1)?.__positionIds?.[0];
  if (typeof positionId !== 'number') {
    fixture.tree.destroy();
    throw new Error('fixture retained no scoped position');
  }
  try {
    const startedAt = now();
    for (let index = 0; index < TURN_COUNT; index++) {
      if (!fixture.manager.undoAt(positionId)) {
        throw new Error(`scoped manager undo ${index + 1} was refused`);
      }
      assertStableEntity(fixture, index);
    }
    const durationNs = elapsedNs(startedAt);
    assertProductionCursor(fixture);
    return { durationNs, profile: instrumentation?.profile };
  } finally {
    instrumentation?.restore();
    fixture.tree.destroy();
  }
}

async function runEffectPipeline({ profile = false } = {}) {
  const fixture = await createFixture();
  const instrumentation = profile ? instrument(fixture) : undefined;
  try {
    const turns = [...fixture.manager.history].reverse();
    const startedAt = now();
    for (let index = 0; index < turns.length; index++) {
      const turn = turns[index];
      fixture.manager.applyEffectsFn([
        {
          effects: turn.__effects ?? [],
          orderDeltas: turn.__orderDeltas ?? [],
          direction: 'undo',
        },
      ]);
      assertStableEntity(fixture, index);
    }
    return {
      durationNs: elapsedNs(startedAt),
      profile: instrumentation?.profile,
    };
  } finally {
    instrumentation?.restore();
    fixture.tree.destroy();
  }
}

function precomputeScalarReversals(fixture) {
  return [...fixture.manager.history].reverse().map((turn) => {
    const effects = (turn.__effects ?? []).map((effect) => {
      if (effect.kind !== 'set') {
        throw new Error(
          `physical control received ${effect.kind}, expected set`
        );
      }
      return {
        owner: effect.position,
        before: effect.after,
        after: effect.before,
        subjectId: effect.subject,
        path: effect.path,
        ownerPath: effect.ownerPath,
      };
    });
    if (effects.length !== 1) {
      throw new Error(
        `physical control retained ${effects.length} effects, expected one`
      );
    }
    return effects;
  });
}

async function runPhysical({ profile = false } = {}) {
  const fixture = await createFixture();
  const reversals = precomputeScalarReversals(fixture);
  const instrumentation = profile ? instrument(fixture) : undefined;
  try {
    const startedAt = now();
    for (let index = 0; index < reversals.length; index++) {
      fixture.port.applyAtomically(reversals[index]);
      assertStableEntity(fixture, index);
    }
    return {
      durationNs: elapsedNs(startedAt),
      profile: instrumentation?.profile,
    };
  } finally {
    instrumentation?.restore();
    fixture.tree.destroy();
  }
}

async function collect(run) {
  const values = [];
  for (let index = 0; index < WARMUP_COUNT + SAMPLE_COUNT; index++) {
    const result = await run();
    if (index >= WARMUP_COUNT) values.push(result.durationNs);
  }
  return values;
}

const rootSamples = await collect(runRoot);
const rootWithoutConsistencySamples = await collect(() =>
  runRoot({ skipConsistencyCheck: true })
);
const scopedSamples = await collect(runScoped);
const effectPipelineSamples = await collect(runEffectPipeline);
const physicalSamples = await collect(runPhysical);
const rootProfile = (await runRoot({ profile: true })).profile;
const scopedProfile = (await runScoped({ profile: true })).profile;
const effectPipelineProfile = (await runEffectPipeline({ profile: true }))
  .profile;
const physicalProfile = (await runPhysical({ profile: true })).profile;

for (const [name, profile] of Object.entries({
  root: rootProfile,
  scoped: scopedProfile,
  effectPipeline: effectPipelineProfile,
  physical: physicalProfile,
})) {
  if (profile.applyAtomically?.calls !== TURN_COUNT) {
    throw new Error(
      `${name} performed ${
        profile.applyAtomically?.calls ?? 0
      } atomic applications, expected ${TURN_COUNT}`
    );
  }
}
if (
  PRODUCTION_MODE &&
  ((rootProfile.assertTurnStatusConsistency?.calls ?? 0) !== 0 ||
    (scopedProfile.assertTurnStatusConsistency?.calls ?? 0) !== 0)
) {
  throw new Error('production restoration ran a full turn consistency scan');
}

const report = {
  turns: TURN_COUNT,
  samples: SAMPLE_COUNT,
  warmups: WARMUP_COUNT,
  productionMode: PRODUCTION_MODE,
  timings: {
    rootProduction: summarize(rootSamples),
    rootWithoutConsistencyCheck: summarize(rootWithoutConsistencySamples),
    scopedProduction: summarize(scopedSamples),
    effectPipeline: summarize(effectPipelineSamples),
    directPhysicalApplication: summarize(physicalSamples),
  },
  ratios: {
    rootOverEffectPipeline: median(rootSamples) / median(effectPipelineSamples),
    rootOverPhysical: median(rootSamples) / median(physicalSamples),
    rootOverNoConsistency:
      median(rootSamples) / median(rootWithoutConsistencySamples),
    scopedOverPhysical: median(scopedSamples) / median(physicalSamples),
  },
  profiles: {
    root: rootProfile,
    scoped: scopedProfile,
    effectPipeline: effectPipelineProfile,
    physical: physicalProfile,
  },
  interpretation: {
    rootUndoUsesScopedPath:
      (rootProfile.resolveContainedUndoClosure?.calls ?? 0) > 0,
    rootClosurePassesPerUndo:
      (rootProfile.resolveUndoClosure?.calls ?? 0) / TURN_COUNT,
    scopedContainedPassesPerUndo:
      (scopedProfile.resolveContainedUndoClosure?.calls ?? 0) / TURN_COUNT,
    scopedClosurePassesPerUndo:
      (scopedProfile.resolveUndoClosure?.calls ?? 0) / TURN_COUNT,
  },
};

if (JSON_ONLY) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const timing = (label, value) =>
    console.log(
      `${label.padEnd(28)} ${value.medianUs
        .toFixed(2)
        .padStart(9)} us median  ` +
        `[${value.minUs.toFixed(2)}, ${value.maxUs.toFixed(2)}]`
    );
  console.log(
    `RESTORATION-HOT-PATH-0\n${TURN_COUNT} retained scalar turns; setup excluded; ${SAMPLE_COUNT} samples\n`
  );
  timing('root production undo', report.timings.rootProduction);
  timing(
    'root without consistency',
    report.timings.rootWithoutConsistencyCheck
  );
  timing('scoped manager undo', report.timings.scopedProduction);
  timing('manager effect pipeline', report.timings.effectPipeline);
  timing(
    'direct physical application',
    report.timings.directPhysicalApplication
  );
  console.log(
    `\nroot/effect-pipeline ${report.ratios.rootOverEffectPipeline.toFixed(
      2
    )}x; ` +
      `root/physical ${report.ratios.rootOverPhysical.toFixed(2)}x; ` +
      `root/no-consistency ${report.ratios.rootOverNoConsistency.toFixed(
        2
      )}x; ` +
      `scoped/physical ${report.ratios.scopedOverPhysical.toFixed(2)}x`
  );
  console.log(
    `root closure passes/undo ${report.interpretation.rootClosurePassesPerUndo.toFixed(
      1
    )}; ` +
      `scoped contained ${report.interpretation.scopedContainedPassesPerUndo.toFixed(
        1
      )}, ` +
      `ordinary ${report.interpretation.scopedClosurePassesPerUndo.toFixed(1)}`
  );
  console.log('\nInclusive instrumented method totals:');
  for (const [arm, profile] of Object.entries(report.profiles)) {
    console.log(`  ${arm}`);
    for (const [name, value] of Object.entries(profile)) {
      console.log(
        `    ${name.padEnd(31)} ${String(value.calls).padStart(4)} calls  ` +
          `${(value.totalNs / 1_000).toFixed(2).padStart(10)} us`
      );
    }
  }
}
