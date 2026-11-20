import type { ScenarioDefinition } from '../runner/types.ts';
import type { ContentionArgs } from './micro.ts';

const MICRO = new URL('./micro.ts', import.meta.url).href;

/** Harness choices S7 does not take from budgets.json. */
export const S7_SETUP = { writesPerRound: 10_000, warmRounds: 5, rounds: 21 } as const;

/**
 * S7 (ruling 5): Node at 1×. Cost of a write by 'user' to a location with n
 * owners (pending transactions plus declared holders), each point in a fresh
 * process; then an uncontended write with 10 vs 10,000 links elsewhere, the
 * tree size held constant.
 */
export const S7: ScenarioDefinition = {
  id: 'S7',
  title: 'Contention: a write to a location held by 1, 2, 8 and 32 owners',
  environment: 'node',
  requires: ['writers', 'hold', 'transactions', 'links'],
  metrics: {
    'writeCostUs@1': { unit: 'µs', better: 'lower', description: 'write cost with 1 owner' },
    'writeCostUs@2': { unit: 'µs', better: 'lower', description: 'write cost with 2 owners' },
    'writeCostUs@8': { unit: 'µs', better: 'lower', description: 'write cost with 8 owners' },
    'writeCostUs@32': { unit: 'µs', better: 'lower', description: 'write cost with 32 owners' },
    uncontendedLinksDelta: { unit: 'ratio', better: 'none', description: 'cost with 10,000 links / cost with 10 links - 1' },
    'uncontendedUs@10': { unit: 'µs', better: 'lower', description: 'uncontended write, 10 links elsewhere' },
    'uncontendedUs@10000': { unit: 'µs', better: 'lower', description: 'uncontended write, 10,000 links elsewhere' },
  },
  async run(ctx) {
    const owners = ctx.params['owners'] as number[];
    const links = ctx.params['linksElsewhere'] as [number, number];
    const otherLeaves = Math.max(...links);
    const point = (ownerCount: number, linkCount: number) =>
      ctx.isolate<{ usPerWrite: number }>(MICRO, 'measureContention', {
        subject: ctx.subject.id,
        owners: ownerCount,
        links: linkCount,
        otherLeaves,
        ...S7_SETUP,
      } satisfies ContentionArgs);
    const out: Record<string, number> = {};
    for (const n of owners) out[`writeCostUs@${n}`] = (await point(n, 0)).usPerWrite;
    const few = (await point(0, links[0])).usPerWrite;
    const many = (await point(0, links[1])).usPerWrite;
    out[`uncontendedUs@${links[0]}`] = few;
    out[`uncontendedUs@${links[1]}`] = many;
    out['uncontendedLinksDelta'] = many / few - 1;
    return out;
  },
};
