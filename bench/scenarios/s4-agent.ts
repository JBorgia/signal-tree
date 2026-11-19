import { keystrokeLatency, type PerfDrain } from '../runner/browser.ts';
import type { RunContext, ScenarioDefinition } from '../runner/types.ts';
import { collectionShape, loadedGrid, sleep, withBenchPage } from './page.ts';

/**
 * S4 split by ruling 2: S4a agent apply / inspect() / rollback without holds,
 * S4b selective undo, S4c holds while the user types every 100 ms.
 * All at 4× CPU throttle on the S2-shaped collection with its grid rendered;
 * the agent batch edits `fieldEdits` fields spread over `rows` rows.
 */
export const S4_SETUP = { warmupBatches: 3, seed: 7, keystrokes: 20, agentBatchEveryMs: 500, heldRow: 0, heldField: 'f2' } as const;

/** The S2-shaped collection from budgets.json scale, plus the agent batch from the gate parameters. */
function gridShape(ctx: RunContext) {
  return { ...collectionShape(ctx), fieldEdits: ctx.params['fieldEdits'] as number, agentRows: ctx.params['rows'] as number };
}

export const S4a: ScenarioDefinition = {
  id: 'S4a',
  title: 'Agent batch: agent apply, inspect(), rollback, no holds',
  environment: 'browser',
  requires: ['collection', 'writers', 'transactions', 'transactionInspect'],
  metrics: {
    agentApplyMs: { unit: 'ms', better: 'lower', description: 'agent batch applied in a transaction (store turn)' },
    inspectMs: { unit: 'ms', better: 'lower', description: 'inspect() of the pending transaction' },
    rollbackMs: { unit: 'ms', better: 'lower', description: 'rollback() of the agent batch' },
  },
  run: (ctx) =>
    withBenchPage(ctx, async (page) => {
      const shape = gridShape(ctx);
      await loadedGrid(page, ctx, shape, { transactions: true });
      const batch = (seed: number) =>
        page.invoke('agent.transaction', { fieldEdits: shape.fieldEdits, rows: shape.agentRows, fields: shape.fields, seed });
      for (let w = 0; w < S4_SETUP.warmupBatches; w++) await batch(S4_SETUP.seed + w + 1);
      return batch(S4_SETUP.seed);
    }),
};

export const S4b: ScenarioDefinition = {
  id: 'S4b',
  title: 'Agent batch: selective undo',
  environment: 'browser',
  requires: ['collection', 'writers', 'restoration', 'selectiveUndo'],
  metrics: {
    selectiveUndoMs: { unit: 'ms', better: 'lower', description: "undo({ writer: 'agent:planner' }) of the agent batch" },
    userEditKept: { unit: 'bool', better: 'none', description: "1 when the user's own edit survived the selective undo" },
  },
  run: (ctx) =>
    withBenchPage(ctx, async (page) => {
      const shape = gridShape(ctx);
      // restoration's cap: the brief configures only restoration({ retain: 100 }) (S5).
      await loadedGrid(page, ctx, shape, { restoration: { retain: 100 } });
      const batch = (seed: number) =>
        page.invoke<{ selectiveUndoMs: number; userEditKept: boolean }>('agent.selectiveUndo', {
          fieldEdits: shape.fieldEdits,
          rows: shape.agentRows,
          fields: shape.fields,
          seed,
        });
      for (let w = 0; w < S4_SETUP.warmupBatches; w++) await batch(S4_SETUP.seed + w + 1);
      const result = await batch(S4_SETUP.seed);
      return { selectiveUndoMs: result.selectiveUndoMs, userEditKept: result.userEditKept ? 1 : 0 };
    }),
};

function keystrokeLatencies(perf: PerfDrain): number[] {
  const out: number[] = [];
  for (const key of perf.keys) out.push(keystrokeLatency(perf, key).ms);
  return out;
}

export const S4c: ScenarioDefinition = {
  id: 'S4c',
  title: 'Agent batch applied while the user types into a held field every 100 ms',
  environment: 'browser',
  requires: ['collection', 'collectionFieldWrite', 'writers', 'hold'],
  metrics: {
    heldValueOverwrites: { unit: 'count', better: 'lower', description: "agent batches after which the user's held value differed from what the user typed" },
    maxKeystrokeMs: { unit: 'ms', better: 'lower', description: 'slowest keystroke interaction' },
    agentRefusals: { unit: 'count', better: 'none', description: 'agent row updates refused' },
  },
  run: (ctx) =>
    withBenchPage(ctx, async (page) => {
      const shape = gridShape(ctx);
      const every = ctx.params['keystrokeEveryMs'] as number;
      await loadedGrid(page, ctx, shape, { writers: true });
      await page.invoke('held.mount', { row: S4_SETUP.heldRow, field: S4_SETUP.heldField });
      await page.page.focus('#held');
      await page.settle(3);
      await page.drainPerf();
      let overwrites = 0;
      let refusals = 0;
      let typing = true;
      const typist = (async () => {
        for (let k = 0; k < S4_SETUP.keystrokes; k++) {
          const due = Date.now() + every;
          await page.page.keyboard.press(String.fromCharCode(97 + (k % 26)));
          await sleep(Math.max(0, due - Date.now()));
        }
        typing = false;
      })();
      const agent = (async () => {
        let seed = S4_SETUP.seed;
        while (typing) {
          await sleep(S4_SETUP.agentBatchEveryMs);
          const result = await page.invoke<{ overwritten: boolean; refusals: number }>('held.agentBatch', {
            fieldEdits: shape.fieldEdits,
            rows: shape.agentRows,
            row: S4_SETUP.heldRow,
            field: S4_SETUP.heldField,
            fields: shape.fields,
            seed: seed++,
          });
          if (result.overwritten) overwrites++;
          refusals += result.refusals;
        }
      })();
      await Promise.all([typist, agent]);
      await page.settle(3);
      await sleep(300);
      const perf = await page.drainPerf();
      const latencies = keystrokeLatencies(perf);
      if (latencies.length !== S4_SETUP.keystrokes) throw new Error(`expected ${S4_SETUP.keystrokes} keystrokes, saw ${latencies.length}`);
      return { heldValueOverwrites: overwrites, maxKeystrokeMs: Math.max(...latencies), agentRefusals: refusals };
    }),
};
