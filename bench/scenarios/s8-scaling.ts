import { ALLOCATION_NODE_FLAGS } from '../runner/alloc-probe.ts';
import type { MetricSpec, ScenarioDefinition } from '../runner/types.ts';
import { missingCapabilities, type Capability } from '../subjects/types.ts';
import type { ReadAllocations, ScalingArgs } from './scaling.ts';

const SCALING = new URL('./scaling.ts', import.meta.url).href;

/**
 * S8's operations, each with the capabilities it needs beyond 'collection'.
 * A subject without them reports that operation as not applicable.
 */
export const S8_OPERATIONS = [
  { id: 'leafWrite', title: 'leaf write', requires: ['leaf'] },
  { id: 'rowFieldWrite', title: 'row field write', requires: ['collectionFieldWrite'] },
  { id: 'addOne', title: 'addOne', requires: ['collectionAddRemove'] },
  { id: 'removeOne', title: 'removeOne', requires: ['collectionAddRemove'] },
  { id: 'setAll', title: 'setAll, per row written', requires: [] },
  { id: 'updateOne', title: 'updateOne', requires: [] },
  { id: 'transactRollback', title: 'transact + rollback of one row', requires: ['transactions'] },
  { id: 'undo', title: 'undo of one row', requires: ['restoration'] },
  { id: 'all', title: 'all()', requires: ['collectionReads'] },
  { id: 'byId', title: 'byId', requires: ['collectionReads'] },
] as const satisfies readonly { id: string; title: string; requires: readonly Capability[] }[];

export type S8Operation = (typeof S8_OPERATIONS)[number]['id'];

/** The operations whose allocations per call are counted. */
export const S8_ALLOCATION_OPERATIONS = ['all', 'byId'] as const satisfies readonly S8Operation[];

/**
 * The collection sizes the metrics are declared for. budgets.json's
 * `rows` must name the same two; run() stops with an error otherwise.
 */
const SIZES = [1000, 100000] as const;

function declareMetrics(): Record<string, MetricSpec> {
  const metrics: Record<string, MetricSpec> = {};
  for (const op of S8_OPERATIONS) {
    const unit = op.id === 'setAll' ? 'ns per row written' : 'ns';
    for (const rows of SIZES) metrics[`${op.id}Ns@${rows}`] = { unit, better: 'lower', description: `${op.title} with ${rows} rows (reported, never gated)` };
    metrics[`${op.id}Ratio`] = { unit: 'x', better: 'lower', description: `${op.title}: median at ${SIZES[1]} rows / median at ${SIZES[0]} rows` };
  }
  for (const op of S8_ALLOCATION_OPERATIONS) {
    for (const rows of SIZES) {
      metrics[`${op}AllocationsPerCall@${rows}`] = { unit: 'allocations', better: 'none', description: `heap allocations per ${op} call with ${rows} rows` };
      metrics[`${op}AllocatedBytesPerCall@${rows}`] = { unit: 'B', better: 'none', description: `heap bytes allocated per ${op} call with ${rows} rows` };
    }
    metrics[`${op}AllocatedBytesGrowth`] = {
      unit: 'B',
      better: 'lower',
      description: `bytes allocated per ${op} call at ${SIZES[1]} rows minus at ${SIZES[0]} rows`,
      zeroable: true,
    };
  }
  metrics['probeAllocatingPerWrite'] = { unit: 'allocations', better: 'none', description: 'self-test: allocating loop must read about 1' };
  return metrics;
}

/** Ratio and growth metrics read the operation's capabilities, so a subject without them reports those conditions as not applicable. */
function metricRequires(): Record<string, readonly Capability[]> {
  const out: Record<string, readonly Capability[]> = {};
  for (const op of S8_OPERATIONS) {
    out[`${op.id}Ratio`] = op.requires;
    if ((S8_ALLOCATION_OPERATIONS as readonly string[]).includes(op.id)) out[`${op.id}AllocatedBytesGrowth`] = op.requires;
  }
  return out;
}

/**
 * S8 (scaling): every operation the subject has, timed with the collection
 * at 1,000 and at 100,000 rows, in Node at 1×. Each size runs in its own
 * fresh process, each operation on its own tree; the order of the sizes
 * alternates between runs. The ratio of the two medians is gated. all() and
 * byId also have their allocations per call counted at both sizes, in
 * another fresh process per size, as M1 counts allocations.
 */
export const S8: ScenarioDefinition = {
  id: 'S8',
  title: 'Scaling: ten operations at 1,000 and 100,000 rows',
  environment: 'node',
  requires: ['collection'],
  metrics: declareMetrics(),
  metricRequires: metricRequires(),
  async run(ctx) {
    const sizes = ctx.params['rows'] as number[];
    if (sizes.length !== SIZES.length || sizes.some((rows, i) => rows !== SIZES[i])) {
      throw new Error(`S8 declares metrics for ${SIZES.join(' and ')} rows; budgets.json asks for ${sizes.join(', ')}`);
    }
    const [small, large] = SIZES;
    const fields = ctx.params['fields'] as number;
    const operations = S8_OPERATIONS.filter((op) => missingCapabilities(ctx.subject, op.requires).length === 0).map((op) => op.id);
    const notApplicable = S8_OPERATIONS.filter((op) => !operations.includes(op.id)).map((op) => op.id);
    if (notApplicable.length) ctx.note('notApplicable', notApplicable.join(', '));
    const order = ctx.runIndex % 2 === 1 ? [small, large] : [large, small];
    const out: Record<string, number> = {};

    const ns: Record<number, Record<string, number>> = {};
    for (const rows of order) {
      ns[rows] = await ctx.isolate<Record<string, number>>(SCALING, 'measureScaling', { subject: ctx.subject.id, rows, fields, operations } satisfies ScalingArgs);
    }
    for (const op of operations) {
      out[`${op}Ns@${small}`] = ns[small]![op]!;
      out[`${op}Ns@${large}`] = ns[large]![op]!;
      out[`${op}Ratio`] = ns[large]![op]! / ns[small]![op]!;
    }

    const reads = S8_ALLOCATION_OPERATIONS.filter((op) => operations.includes(op));
    if (reads.length) {
      const calls = ctx.params['allocationCalls'] as number;
      const allocations: Record<number, ReadAllocations> = {};
      for (const rows of order) {
        allocations[rows] = await ctx.isolate<ReadAllocations>(
          SCALING,
          'measureReadAllocations',
          { subject: ctx.subject.id, rows, fields, operations: reads, calls },
          ALLOCATION_NODE_FLAGS,
        );
      }
      for (const op of reads) {
        for (const rows of SIZES) {
          out[`${op}AllocationsPerCall@${rows}`] = allocations[rows]!.perCall[op]!.allocations;
          out[`${op}AllocatedBytesPerCall@${rows}`] = allocations[rows]!.perCall[op]!.bytes;
        }
        out[`${op}AllocatedBytesGrowth`] = allocations[large]!.perCall[op]!.bytes - allocations[small]!.perCall[op]!.bytes;
      }
      out['probeAllocatingPerWrite'] = Math.min(allocations[small]!.probeAllocatingPerWrite, allocations[large]!.probeAllocatingPerWrite);
    }
    return out;
  },
};
