import { keystrokeLatency } from '../runner/browser.ts';
import type { ScenarioDefinition } from '../runner/types.ts';
import { sleep, withBenchPage } from './page.ts';

/** Harness choices S1 does not take from budgets.json. */
export const S1_SETUP = { perSection: 20, warmupKeystrokes: 5, settleAfterKeyMs: 300 } as const;

/**
 * S1: one keystroke into the 500-field form at 4× CPU throttle. Each input is
 * bound to one store leaf; the keystroke's write is one store turn.
 * Store work = the turn's `signal-tree:` measure (#12: with the adapter's
 * lazy reads of handed-out leaves inside it). #13: interaction = keydown to
 * the next paint, the same source in every run; Event Timing is reported
 * alongside when the browser reported the interaction.
 */
export const S1: ScenarioDefinition = {
  id: 'S1',
  title: 'Form edit: one keystroke in the 500-field form',
  environment: 'browser',
  requires: ['leaf'],
  metrics: {
    storeWorkMs: { unit: 'ms', better: 'lower', description: 'store turn of the keystroke', zeroable: true },
    interactionMs: { unit: 'ms', better: 'lower', description: '#13: keydown to the next paint' },
    eventTimingMs: { unit: 'ms', better: 'none', description: 'Event Timing duration, when reported (8 ms granularity, 16 ms floor)' },
    interactionProcessingMs: { unit: 'ms', better: 'none', description: 'Event Timing input delay plus processing, when reported' },
    eventTimingReported: { unit: 'bool', better: 'none', description: '1 when Event Timing reported the interaction' },
    longFramesDuringKeystroke: { unit: 'frames', better: 'lower', description: 'long animation frames while the keystroke was handled', zeroable: true },
  },
  run: (ctx) =>
    withBenchPage(ctx, async (page) => {
      const fields = ctx.params['formBoundFields'] as number;
      await page.invoke('mount.form', { fields, perSection: S1_SETUP.perSection, variant: ctx.variant });
      for (let w = 0; w < S1_SETUP.warmupKeystrokes; w++) {
        await page.page.focus(`#f${w}`);
        await page.page.keyboard.press('a');
        await page.settle();
      }
      await page.page.focus(`#f${Math.floor(fields / 2)}`);
      await page.settle(3);
      await sleep(S1_SETUP.settleAfterKeyMs);
      await page.drainPerf();
      await page.page.keyboard.press('x');
      await page.settle(3);
      await sleep(S1_SETUP.settleAfterKeyMs);
      const perf = await page.drainPerf();
      const turns = perf.turns.filter((turn) => turn.label === 'S1.keystroke');
      if (turns.length !== 1) throw new Error(`expected one keystroke turn, saw ${turns.length}`);
      const latency = keystrokeLatency(perf);
      const values: Record<string, number> = {
        storeWorkMs: turns[0]!.duration,
        interactionMs: latency.ms,
        eventTimingReported: Number.isFinite(latency.eventTimingMs) ? 1 : 0,
        longFramesDuringKeystroke: perf.loaf.length,
      };
      if (Number.isFinite(latency.eventTimingMs)) values['eventTimingMs'] = latency.eventTimingMs;
      if (Number.isFinite(latency.processingMs)) values['interactionProcessingMs'] = latency.processingMs;
      return values;
    }),
};
