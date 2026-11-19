/**
 * Node measurements for M1, M2, M3 and S7. Each export runs alone in a fresh
 * `node --expose-gc` process (RunContext.isolate), so the native baseline and
 * the subject never share JIT state.
 *
 * The loop functions are shared by both sides: the native side and the subject
 * side run the same code against a different cell.
 */
import { signal, type WritableSignal } from '@angular/core';
import { setImmediate } from 'node:timers/promises';
import { getHeapStatistics } from 'node:v8';
import { allocationProbeSelfTest, countAllocations } from '../runner/alloc-probe.ts';
import { loadSubject } from '../subjects/index.ts';
import type { HoldPolicy, StoreSubject, SubjectTransaction, SubjectTree, TreeOptions } from '../subjects/types.ts';
import { makeLeafState } from './data.ts';

/** Timing protocol for per-operation micro measurements. */
export const MICRO_TIMING = { opsPerRound: 1_000_000, warmRounds: 5, rounds: 21 } as const;

/** The 5-leaf tree M1 and M2 write and read; the measured leaf is two branches deep. */
export function microState(): object {
  return { user: { profile: { age: 0, name: 'Ada' }, settings: { theme: 'light', locale: 'en' } }, count: 0 };
}
export const MICRO_LEAF = ['user', 'profile', 'age'] as const;

function gc(): void {
  const collect = (globalThis as { gc?: () => void }).gc;
  if (!collect) throw new Error('micro measurements need node --expose-gc');
  collect();
  collect();
}

/**
 * V8 heap in use after full GCs. Each GC follows an event-loop turn: objects
 * a WeakRef touched stay alive until the current job ends, and finalizers
 * only run between jobs, so a synchronous gc() can still count them.
 */
async function usedHeap(): Promise<number> {
  for (let i = 0; i < 3; i++) {
    await setImmediate();
    gc();
  }
  return getHeapStatistics().used_heap_size;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Median nanoseconds per operation over `rounds` rounds of `ops` operations, after warm-up rounds. */
function nsPerOp(loop: (n: number) => void, ops: number, warmRounds: number, rounds: number): number {
  for (let r = 0; r < warmRounds; r++) loop(ops);
  const samples: number[] = [];
  for (let r = 0; r < rounds; r++) {
    const start = process.hrtime.bigint();
    loop(ops);
    samples.push(Number(process.hrtime.bigint() - start) / ops);
  }
  return median(samples);
}

function writeLoop(cell: WritableSignal<number>, n: number): void {
  for (let i = 0; i < n; i++) cell.set(i & 1023);
}

let readSink = 0;
function readLoop(cell: WritableSignal<number>, n: number): void {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += cell();
  readSink += sum;
}

interface SideArgs {
  readonly side: 'native' | 'subject';
  readonly subject: string;
  readonly variant: NonNullable<TreeOptions['variant']>;
}

async function microCell(args: SideArgs, initial: number): Promise<WritableSignal<number>> {
  if (args.side === 'native') return signal(initial);
  const subject = await loadSubject(args.subject);
  const tree = subject.createTree(microState(), { variant: args.variant });
  const leaf = tree.leaf<number>(MICRO_LEAF);
  leaf.set(initial);
  return leaf;
}

/** M1, one side: median ns per leaf write. */
export async function measureWriteTime(args: SideArgs): Promise<{ nsPerWrite: number }> {
  const cell = await microCell(args, 0);
  return { nsPerWrite: nsPerOp((n) => writeLoop(cell, n), MICRO_TIMING.opsPerRound, MICRO_TIMING.warmRounds, MICRO_TIMING.rounds) };
}

export interface WriteAllocations {
  readonly allocations: number;
  readonly allocatedBytes: number;
  readonly writes: number;
  readonly probeAllocatingPerWrite: number;
  readonly probePlainPerWrite: number;
}

/**
 * M1, one side: allocations over `allocationWrites` writes after warm-up.
 * Runs under ALLOCATION_NODE_FLAGS; the probe's self-test runs first in the
 * same process and the measurement fails if the probe does not prove itself.
 */
export async function measureWriteAllocations(args: SideArgs & { readonly allocationWrites: number }): Promise<WriteAllocations> {
  const probe = await allocationProbeSelfTest(args.allocationWrites);
  if (!probe.ok) throw new Error(`allocation probe self-test failed: ${JSON.stringify(probe)}`);
  const cell = await microCell(args, 0);
  for (let r = 0; r < MICRO_TIMING.warmRounds; r++) writeLoop(cell, MICRO_TIMING.opsPerRound);
  const counted = await countAllocations(writeLoop.name, args.allocationWrites, () => writeLoop(cell, args.allocationWrites));
  return {
    allocations: counted.allocations,
    allocatedBytes: counted.bytes,
    writes: counted.writes,
    probeAllocatingPerWrite: probe.allocatingPerWrite,
    probePlainPerWrite: probe.plainPerWrite,
  };
}

/** M2, one side: ns per read through a held handle. */
export async function measureRead(args: SideArgs): Promise<{ nsPerRead: number; sink: number }> {
  const cell = await microCell(args, 7);
  const nsPerRead = nsPerOp((n) => readLoop(cell, n), MICRO_TIMING.opsPerRound, MICRO_TIMING.warmRounds, MICRO_TIMING.rounds);
  return { nsPerRead, sink: readSink };
}

export interface BuildArgs {
  readonly subject: string;
  readonly variant: NonNullable<TreeOptions['variant']>;
  readonly leaves: number;
  readonly accessed: number;
  readonly perBranch: number;
  readonly warmBuilds: number;
}

function buildAndAccess(subject: StoreSubject, args: BuildArgs): { ms: number; tree: SubjectTree } {
  const { state, accessedPaths } = makeLeafState(args.leaves, args.perBranch, args.accessed);
  const start = process.hrtime.bigint();
  const tree = subject.createTree(state, { variant: args.variant });
  let sum = 0;
  for (const path of accessedPaths) sum += tree.leaf<number>(path)();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  readSink += sum;
  return { ms, tree };
}

/** M3 time (reported, never gated): the first build in the process and the median of later builds. */
export async function measureBuildTime(args: BuildArgs): Promise<{ coldMs: number; warmMedianMs: number }> {
  const subject = await loadSubject(args.subject);
  const cold = buildAndAccess(subject, args);
  cold.tree.destroy();
  const warm: number[] = [];
  for (let i = 0; i < args.warmBuilds; i++) {
    const build = buildAndAccess(subject, args);
    warm.push(build.ms);
    build.tree.destroy();
  }
  return { coldMs: cold.ms, warmMedianMs: median(warm) };
}

const CELL_SAMPLE = 10_000;

/**
 * M3 heap: retained heap of the tree (built from the state, 10 leaves accessed
 * and held, the caller's reference to the state dropped) against the plain
 * state plus 10 native cells holding the accessed values.
 */
export async function measureBuildHeap(args: BuildArgs): Promise<{ plainBytes: number; cellsBytes: number; treeBytes: number }> {
  const subject = await loadSubject(args.subject);
  // Warm the code paths so compiled code is not counted as tree heap.
  buildAndAccess(subject, { ...args, leaves: Math.min(args.leaves, 1000) }).tree.destroy();

  // Warm native cell creation too (feedback vectors are heap objects).
  readSink += Array.from({ length: CELL_SAMPLE }, (_, k) => signal(k)).length;

  const base = await usedHeap();
  let built: { state: object; accessedPaths: string[][] } | undefined = makeLeafState(args.leaves, args.perBranch, args.accessed);
  const withState = await usedHeap();
  // 10 cells are below heap-counter noise, so measure CELL_SAMPLE cells and scale to `accessed`.
  const cells = Array.from({ length: CELL_SAMPLE }, (_, k) => signal(k));
  const withCells = await usedHeap();
  const plainBytes = withState - base;
  const cellsBytes = ((withCells - withState) * args.accessed) / CELL_SAMPLE;
  cells.length = 0;

  const tree = subject.createTree(built.state, { variant: args.variant });
  const handles = built.accessedPaths.map((path) => tree.leaf<number>(path));
  let sum = 0;
  for (const handle of handles) sum += handle();
  readSink += sum;
  built = undefined;
  const withTree = await usedHeap();
  const treeBytes = withTree - base;
  // Keep the tree and the handles alive until after the measurement.
  readSink += handles.length + (tree ? 0 : 1);
  return { plainBytes, cellsBytes, treeBytes };
}

const OWNER_TARGET = ['target', 'value'] as const;
const USER = { writer: 'user', origin: 'user' } as const;
const MERGE_INCOMING: HoldPolicy = { kind: 'merge', merge: (_current, incoming) => incoming };

/** S7 state: the contended location plus `otherLeaves` leaves elsewhere for links. */
function contentionState(otherLeaves: number): object {
  const other: Record<string, number> = {};
  for (let i = 0; i < otherLeaves; i++) other[`l${i}`] = i;
  return { target: { value: 0 }, other };
}

export interface ContentionArgs {
  readonly subject: string;
  readonly owners: number;
  readonly links: number;
  /** Leaves under `other`, constant across points so only the link count varies. */
  readonly otherLeaves: number;
  readonly writesPerRound: number;
  readonly warmRounds: number;
  readonly rounds: number;
}

/**
 * S7, one point: µs per write by 'user' to a location with `owners` owners
 * (even-numbered owners are pending transactions that wrote the location,
 * odd-numbered owners are declared holders with a merge policy) and `links`
 * links elsewhere in the tree.
 */
export async function measureContention(args: ContentionArgs): Promise<{ usPerWrite: number }> {
  const subject = await loadSubject(args.subject);
  const tree = subject.createTree(contentionState(args.otherLeaves), {
    plugins: { transactions: true, writers: true },
  });
  const leaf = tree.leaf<number>(OWNER_TARGET);
  const pending: SubjectTransaction[] = [];
  const releases: (() => void)[] = [];
  for (let i = 0; i < args.owners; i++) {
    const owner = { writer: `owner:${i}`, origin: 'agent' };
    if (i % 2 === 0) pending.push(tree.as!(owner, () => tree.transact!(() => leaf.set(-1 - i))));
    else releases.push(tree.hold!(OWNER_TARGET, owner, MERGE_INCOMING));
  }
  const disposeLinks = args.links > 0 ? tree.linkMany!(['other'], args.links) : () => undefined;
  const ns = tree.as!(USER, () => nsPerOp((n) => writeLoop(leaf, n), args.writesPerRound, args.warmRounds, args.rounds));
  disposeLinks();
  for (const release of releases) release();
  for (const tx of pending) tx.rollback();
  tree.destroy();
  return { usPerWrite: ns / 1000 };
}
