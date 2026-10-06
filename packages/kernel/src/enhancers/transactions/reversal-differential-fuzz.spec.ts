import { describe, expect, it } from 'vitest';

import {
  checkRollback,
  checkUndoRedo,
  configurations,
  generateOps,
  random,
} from '../test-helpers/reversal-fuzz-harness';

/**
 * DIFFERENTIAL REVERSAL FUZZ (review of the 15.4.4 reversal engine).
 *
 * Random sequences of collection operations run as ONE turn over a seeded
 * collection, then reversed through every public path, under every enhancer
 * order. The oracle is the state itself: undo must give back exactly the
 * seeded rows in order, redo exactly the state after the turn, undo again
 * the seed, and history must still read; rollback exactly the seed. A refusal
 * is a failure too.
 *
 * Deterministic: a fixed seed, so a failure reproduces. Scale it for a deeper
 * search (a tool run, not CI):
 *
 *   REVERSAL_FUZZ_ITERATIONS=5000 REVERSAL_FUZZ_SEED=7 \
 *     pnpm nx test kernel --testFile=src/enhancers/transactions/reversal-differential-fuzz.spec.ts
 *
 * A failure prints as `config|path|ops|outcome`; add its ops to
 * `reversal-order.spec.ts` as a carrier.
 */
const ITERATIONS = Number(process.env['REVERSAL_FUZZ_ITERATIONS'] ?? 150);
const BASE_SEED = Number(process.env['REVERSAL_FUZZ_SEED'] ?? 12345);

describe('differential reversal fuzz', () => {
  for (const [name, enhancers] of Object.entries(configurations)) {
    it(`${name}: ${ITERATIONS} random turns reverse exactly`, async () => {
      const next = random(BASE_SEED);
      const failures: string[] = [];
      for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        const ops = generateOps(next);
        const undoRedo = await checkUndoRedo(enhancers, ops);
        if (undoRedo !== 'ok') {
          failures.push(`${name}|undo|${JSON.stringify(ops)}|${undoRedo}`);
        }
        if (name !== 'restoration()') {
          const rollback = await checkRollback(enhancers, ops);
          if (rollback !== 'ok') {
            failures.push(
              `${name}|rollback|${JSON.stringify(ops)}|${rollback}`
            );
          }
        }
      }
      expect(failures).toStrictEqual([]);
    }, 600_000);
  }
});
