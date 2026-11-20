/**
 * Allocation counting for M1's "zero allocations per write over 1M writes" (C1).
 *
 * Instrument: V8's sampling heap profiler through the in-process inspector
 * (HeapProfiler.startSampling) with samplingInterval = 1 byte, so every heap
 * allocation is sampled, and includeObjectsCollectedByMinorGC/MajorGC = true,
 * so short-lived garbage stays in the profile. A sample counts when its
 * allocation stack contains the named loop frame; allocations made by the
 * inspector or the harness outside that frame are ignored.
 *
 * The counting process runs with ALLOCATION_NODE_FLAGS. With V8's default
 * concurrent recompilation, optimizing-compiler jobs are finalized on the main
 * thread at interrupt points inside the loop, and their allocations (a few
 * hundred bytes, tens of times per million writes) are attributed to whatever
 * JS frame is running. Without it, tier-up compiles synchronously during
 * warm-up and the measured loop sees only its own allocations. Starting the
 * sampler can itself force one recompilation of the running loop (seen on
 * Node 22), so every count is preceded by one discarded sampled pass.
 *
 * Proven by allocationProbeSelfTest(), under the same flags: a loop that
 * allocates one object per write must report about one allocation per write,
 * and a loop of plain Angular signal writes must report exactly zero.
 */
import { signal, type WritableSignal } from '@angular/core';
import { Session } from 'node:inspector/promises';

/** Node flags for any process that counts allocations (see above). */
export const ALLOCATION_NODE_FLAGS: readonly string[] = ['--no-concurrent-recompilation'];

export interface AllocationCount {
  readonly writes: number;
  readonly allocations: number;
  readonly bytes: number;
}

interface ProfileNode {
  readonly id: number;
  readonly callFrame: { readonly functionName: string };
  readonly children?: readonly ProfileNode[];
}

interface SamplingProfile {
  readonly head: ProfileNode;
  readonly samples: readonly { readonly size: number; readonly nodeId: number }[];
}

function gc(): void {
  const collect = (globalThis as { gc?: () => void }).gc;
  if (!collect) throw new Error('allocation probe needs node --expose-gc');
  collect();
  collect();
}

/** Counts allocations made inside frames named `frameName` while `run()` executes. */
export async function countAllocations(frameName: string, writes: number, run: () => void): Promise<AllocationCount> {
  const session = new Session();
  session.connect();
  try {
    await session.post('HeapProfiler.enable');
    const sample = async () => {
      gc();
      await session.post('HeapProfiler.startSampling', {
        samplingInterval: 1,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      } as never);
      run();
      return ((await session.post('HeapProfiler.stopSampling')) as unknown as { profile: SamplingProfile }).profile;
    };
    await sample(); // discarded priming pass
    const profile = await sample();
    const inFrame = new Set<number>();
    const visit = (node: ProfileNode, inside: boolean) => {
      const here = inside || node.callFrame.functionName === frameName;
      if (here) inFrame.add(node.id);
      for (const child of node.children ?? []) visit(child, here);
    };
    visit(profile.head, false);
    let allocations = 0;
    let bytes = 0;
    for (const sample of profile.samples) {
      if (!inFrame.has(sample.nodeId)) continue;
      allocations++;
      bytes += sample.size;
    }
    return { writes, allocations, bytes };
  } finally {
    await session.post('HeapProfiler.disable');
    session.disconnect();
  }
}

function selfTestAllocatingLoop(cell: WritableSignal<unknown>, n: number): void {
  for (let i = 0; i < n; i++) cell.set({ i });
}

function selfTestPlainLoop(cell: WritableSignal<number>, n: number): void {
  for (let i = 0; i < n; i++) cell.set(i & 1023);
}

export interface SelfTestResult {
  readonly ok: boolean;
  readonly allocatingPerWrite: number;
  readonly plainPerWrite: number;
}

/** The probe must detect an allocating write and must not flag a non-allocating one. */
export async function allocationProbeSelfTest(writes: number): Promise<SelfTestResult> {
  const objects = signal<unknown>(null);
  const numbers = signal(0);
  for (let k = 0; k < 3; k++) {
    selfTestAllocatingLoop(objects, writes);
    selfTestPlainLoop(numbers, writes);
  }
  const allocating = await countAllocations(selfTestAllocatingLoop.name, writes, () => selfTestAllocatingLoop(objects, writes));
  const plain = await countAllocations(selfTestPlainLoop.name, writes, () => selfTestPlainLoop(numbers, writes));
  const allocatingPerWrite = allocating.allocations / writes;
  const plainPerWrite = plain.allocations / writes;
  return { ok: allocatingPerWrite >= 0.99 && plain.allocations === 0, allocatingPerWrite, plainPerWrite };
}
