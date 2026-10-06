import { describe, expect, it } from 'vitest';

import {
  checkRejection,
  checkRollback,
  checkTurns,
  checkTurnsRollback,
  checkUndoRedo,
  configurations,
  generateOps,
  generateRejection,
  generateTurns,
  random,
} from '../test-helpers/reversal-fuzz-harness';

/**
 * DIFFERENTIAL REVERSAL FUZZ (review of the 15.4.4 reversal engine,
 * extended by the order-delta review of d27e55c8, item 8).
 *
 * Random collection operations over a tree with three collections (`rows`,
 * `other`, and `items` nested in `group`), reversed through every public
 * path under every enhancer order. The oracle is the state itself: every
 * collection's keys, rows and order, exact at every step; history must read
 * at every step. A refusal is a failure, except a rollback refused in the
 * rejection shapes with nothing changed and the transaction still pending,
 * which is an answer.
 *
 *   one turn         undo, redo, undo; rollback of the same turn
 *   several turns    undo each, redo each, undo again, jumpTo newest,
 *                    oldest, newest; the same turns as transactions rolled
 *                    back newest first
 *   transactions     open transactions, then undoable later turns, then
 *   under later work the transactions confirmed (they stand) or rolled back
 *                    (rejected): every undo, redo and jumpTo both ways
 *
 * Deterministic: a fixed seed, so a failure reproduces. Scale it for a deeper
 * search (a tool run, not CI):
 *
 *   REVERSAL_FUZZ_ITERATIONS=2000 REVERSAL_FUZZ_SEED=7 \\
 *     pnpm nx test kernel --testFile=src/enhancers/transactions/reversal-differential-fuzz.spec.ts
 *
 * A failure prints as `config|path|scenario|outcome`; add it to the carrier
 * spec of its class.
 */
const ITERATIONS = Number(process.env['REVERSAL_FUZZ_ITERATIONS'] ?? 150);
const BASE_SEED = Number(process.env['REVERSAL_FUZZ_SEED'] ?? 12345);
const transactional = (name: string) => name !== 'restoration()';

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
        if (transactional(name)) {
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

    it(`${name}: ${Math.ceil(
      ITERATIONS / 3
    )} random histories reverse exactly`, async () => {
      const next = random(BASE_SEED + 1);
      const failures: string[] = [];
      for (let iteration = 0; iteration < ITERATIONS / 3; iteration++) {
        const turns = generateTurns(next);
        const history = await checkTurns(enhancers, turns);
        if (history !== 'ok' && !history.startsWith('noop')) {
          failures.push(`${name}|turns|${JSON.stringify(turns)}|${history}`);
        }
        if (transactional(name)) {
          const rollback = await checkTurnsRollback(enhancers, turns);
          if (rollback !== 'ok') {
            failures.push(
              `${name}|turns-rollback|${JSON.stringify(turns)}|${rollback}`
            );
          }
        }
      }
      expect(failures).toStrictEqual([]);
    }, 600_000);

    if (transactional(name)) {
      it(`${name}: ${Math.ceil(
        ITERATIONS / 3
      )} transactions under later work, confirmed and rejected`, async () => {
        const next = random(BASE_SEED + 2);
        const failures: string[] = [];
        for (let iteration = 0; iteration < ITERATIONS / 3; iteration++) {
          const scenario = generateRejection(next);
          for (const settle of ['confirm', 'rollback'] as const) {
            const result = await checkRejection(enhancers, {
              ...scenario,
              settle,
            });
            // A refusal that changed nothing is an answer: a dependency,
            // or a compensation that cannot be placed (refused atomically).
            if (result !== 'ok' && !result.startsWith('refused:')) {
              failures.push(
                `${name}|${settle}|${JSON.stringify(scenario)}|${result}`
              );
            }
          }
        }
        expect(failures).toStrictEqual([]);
      }, 600_000);
    }
  }
});
