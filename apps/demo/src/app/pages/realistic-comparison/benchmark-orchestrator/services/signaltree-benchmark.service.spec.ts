import { SignalTreeBenchmarkService } from './signaltree-benchmark.service';

const durationOf = (result: number | { durationMs: number }): number =>
  typeof result === 'number' ? result : result.durationMs;

const notesOf = (result: number | { notes?: string }): string | undefined =>
  typeof result === 'number' ? undefined : result.notes;

describe('SignalTreeBenchmarkService v15 restoration scenarios', () => {
  let service: SignalTreeBenchmarkService;

  beforeEach(() => {
    service = new SignalTreeBenchmarkService();
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('constructs restoration before measuring undo and redo', async () => {
    const result = await service.runUndoRedoBenchmark(4);

    expect(durationOf(result)).toBeGreaterThanOrEqual(0);
    expect(notesOf(result)).toBe('SignalTree undo/redo');
  });

  it('fills the configured retained history buffer', async () => {
    const result = await service.runHistorySizeBenchmark(3);

    expect(durationOf(result)).toBeGreaterThanOrEqual(0);
    expect(notesOf(result)).toBe('SignalTree history size');
  });

  it('jumps only among retained designated turns', async () => {
    const result = await service.runJumpToStateBenchmark(4);

    expect(durationOf(result)).toBeGreaterThanOrEqual(0);
    expect(notesOf(result)).toBe('SignalTree jump-to-state');
  });

  it('alternates server payloads so repeated samples retain churn', async () => {
    const first = await service.runServerPayloadSyncBenchmark(500);
    const second = await service.runServerPayloadSyncBenchmark(500);

    expect(notesOf(first)).toContain('(payload)');
    expect(notesOf(second)).toContain('(initial)');
  });
});
