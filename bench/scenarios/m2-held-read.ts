import type { ScenarioDefinition } from '../runner/types.ts';

const MICRO = new URL('./micro.ts', import.meta.url).href;

/** M2: leaf read through a held handle, against a raw Angular signal read in Node at 1×. */
export const M2: ScenarioDefinition = {
  id: 'M2',
  title: 'Leaf read through a held handle',
  environment: 'node',
  requires: ['leaf'],
  metrics: {
    readRatioVsNative: { unit: 'x', better: 'lower', description: 'subject ns per read / native ns per read' },
    subjectReadNs: { unit: 'ns', better: 'lower', description: 'subject read (reported, never gated)' },
    nativeReadNs: { unit: 'ns', better: 'none', description: 'raw Angular signal read (reported, never gated)' },
  },
  async run(ctx) {
    const args = { subject: ctx.subject.id, variant: ctx.variant };
    const sides = ctx.runIndex % 2 === 1 ? (['native', 'subject'] as const) : (['subject', 'native'] as const);
    const ns: Partial<Record<'native' | 'subject', number>> = {};
    for (const side of sides) ns[side] = (await ctx.isolate<{ nsPerRead: number }>(MICRO, 'measureRead', { ...args, side })).nsPerRead;
    return { readRatioVsNative: ns.subject! / ns.native!, subjectReadNs: ns.subject!, nativeReadNs: ns.native! };
  },
};
