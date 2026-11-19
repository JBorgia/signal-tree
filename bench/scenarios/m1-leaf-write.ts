import { ALLOCATION_NODE_FLAGS } from '../runner/alloc-probe.ts';
import type { ScenarioDefinition } from '../runner/types.ts';
import type { WriteAllocations } from './micro.ts';

const MICRO = new URL('./micro.ts', import.meta.url).href;

/**
 * M1: leaf write with no interceptor in scope, against a raw Angular
 * signal.set in Node at 1×. Each side's timing runs in its own fresh
 * process; the order alternates between runs. Allocations are counted over
 * `allocationWrites` writes in another fresh process per side by
 * runner/alloc-probe.ts, whose self-test runs in that process first.
 */
export const M1: ScenarioDefinition = {
  id: 'M1',
  title: 'Leaf write with no interceptor in scope',
  environment: 'node',
  requires: ['leaf'],
  metrics: {
    writeRatioVsNative: { unit: 'x', better: 'lower', description: 'subject ns per write / native ns per write' },
    allocationsPerWrite: { unit: 'allocations', better: 'lower', description: 'heap allocations per subject write', zeroable: true },
    allocatedBytesPerWrite: { unit: 'B', better: 'lower', description: 'heap bytes allocated per subject write', zeroable: true },
    subjectWriteNs: { unit: 'ns', better: 'lower', description: 'subject leaf write (reported, never gated)' },
    nativeWriteNs: { unit: 'ns', better: 'none', description: 'raw Angular signal.set (reported, never gated)' },
    nativeAllocationsPerWrite: { unit: 'allocations', better: 'none', description: 'allocations per raw native write' },
    probeAllocatingPerWrite: { unit: 'allocations', better: 'none', description: 'self-test: allocating loop must read about 1' },
  },
  async run(ctx) {
    const args = { subject: ctx.subject.id, variant: ctx.variant };
    const sides = ctx.runIndex % 2 === 1 ? (['native', 'subject'] as const) : (['subject', 'native'] as const);
    const ns: Partial<Record<'native' | 'subject', number>> = {};
    for (const side of sides) ns[side] = (await ctx.isolate<{ nsPerWrite: number }>(MICRO, 'measureWriteTime', { ...args, side })).nsPerWrite;
    const allocationArgs = { ...args, allocationWrites: ctx.params['allocationWrites'] as number };
    const subject = await ctx.isolate<WriteAllocations>(MICRO, 'measureWriteAllocations', { ...allocationArgs, side: 'subject' }, ALLOCATION_NODE_FLAGS);
    const native = await ctx.isolate<WriteAllocations>(MICRO, 'measureWriteAllocations', { ...allocationArgs, side: 'native' }, ALLOCATION_NODE_FLAGS);
    return {
      writeRatioVsNative: ns.subject! / ns.native!,
      allocationsPerWrite: subject.allocations / subject.writes,
      allocatedBytesPerWrite: subject.allocatedBytes / subject.writes,
      subjectWriteNs: ns.subject!,
      nativeWriteNs: ns.native!,
      nativeAllocationsPerWrite: native.allocations / native.writes,
      probeAllocatingPerWrite: subject.probeAllocatingPerWrite,
    };
  },
};
