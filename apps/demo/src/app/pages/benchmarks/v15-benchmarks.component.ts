import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';

import {
  BenchmarkArmResult,
  BenchmarkReport,
  BenchmarkWorkloadId,
  runInterleavedBenchmark,
} from './v15-benchmark.engine';
import {
  createV15BenchmarkSuites,
  DEFAULT_V15_BENCHMARK_CONFIG,
  V15BenchmarkArm,
  V15BenchmarkConfig,
  V15BenchmarkSuite,
} from './v15-benchmark.workloads';

type BenchmarkMode = 'quick' | 'steady';

interface ActiveComparison {
  readonly suite: V15BenchmarkSuite;
  readonly arm: V15BenchmarkArm;
}

const QUICK_CONFIG: V15BenchmarkConfig = {
  collectionSize: 1_000,
  collectionUpdates: 50,
  restorationSize: 250,
  restorationWrites: 10,
};

@Component({
  selector: 'app-v15-benchmarks',
  standalone: true,
  templateUrl: './v15-benchmarks.component.html',
  styleUrl: './v15-benchmarks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class V15BenchmarksComponent {
  private readonly comparisonDialog =
    viewChild<ElementRef<HTMLDialogElement>>('comparisonDialog');

  readonly isDevBuild = isDevMode();
  readonly mode = signal<BenchmarkMode>('quick');
  readonly activeWorkload = signal<BenchmarkWorkloadId | null>(null);
  readonly reports = signal<ReadonlyMap<BenchmarkWorkloadId, BenchmarkReport>>(
    new Map()
  );
  readonly error = signal<string | null>(null);
  readonly activeComparison = signal<ActiveComparison | null>(null);

  readonly rounds = computed(() => (this.mode() === 'quick' ? 3 : 7));
  readonly warmupRounds = computed(() => (this.mode() === 'quick' ? 1 : 2));
  readonly config = computed(() =>
    this.mode() === 'quick' ? QUICK_CONFIG : DEFAULT_V15_BENCHMARK_CONFIG
  );
  readonly suites = computed(() => createV15BenchmarkSuites(this.config()));
  readonly isRunning = computed(() => this.activeWorkload() !== null);

  setMode(mode: BenchmarkMode): void {
    if (this.isRunning()) return;
    this.mode.set(mode);
    this.reports.set(new Map());
    this.error.set(null);
  }

  async runBenchmarks(): Promise<void> {
    if (this.isRunning()) return;

    this.reports.set(new Map());
    this.error.set(null);

    try {
      for (const suite of this.suites()) {
        this.activeWorkload.set(suite.workload.id);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const report = await runInterleavedBenchmark({
          workload: suite.workload,
          arms: suite.arms,
          rounds: this.rounds(),
          warmupRounds: this.warmupRounds(),
        });
        this.reports.update((current) => {
          const next = new Map(current);
          next.set(suite.workload.id, report);
          return next;
        });
      }
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'The benchmark run failed.'
      );
    } finally {
      this.activeWorkload.set(null);
    }
  }

  reportFor(workloadId: BenchmarkWorkloadId): BenchmarkReport | undefined {
    return this.reports().get(workloadId);
  }

  rankedResults(report: BenchmarkReport): readonly BenchmarkArmResult[] {
    return [...report.results].sort(
      (left, right) =>
        left.medianMs - right.medianMs ||
        left.minMs - right.minMs ||
        left.label.localeCompare(right.label)
    );
  }

  armDescription(
    arms: readonly { readonly id: string; readonly description: string }[],
    armId: string
  ): string {
    return arms.find((arm) => arm.id === armId)?.description ?? '';
  }

  armComparisonKind(arms: readonly V15BenchmarkArm[], armId: string): string {
    return (
      arms.find((arm) => arm.id === armId)?.comparison.kind ??
      'Comparison details'
    );
  }

  openComparison(suite: V15BenchmarkSuite, armId: string): void {
    const arm = suite.arms.find((candidate) => candidate.id === armId);
    if (!arm) return;

    this.activeComparison.set({ suite, arm });
    const dialog = this.comparisonDialog()?.nativeElement;
    if (!dialog || dialog.open) return;

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  closeComparison(): void {
    const dialog = this.comparisonDialog()?.nativeElement;
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    this.activeComparison.set(null);
  }

  resultPosition(value: number, report: BenchmarkReport): string {
    const maximum = Math.max(
      0.1,
      ...report.results.map((result) => result.maxMs)
    );
    return `${Math.min(100, Math.max(0, (value / maximum) * 100))}%`;
  }

  resultScaleMaximum(report: BenchmarkReport): number {
    return Math.max(...report.results.map((result) => result.maxMs));
  }

  formatMilliseconds(value: number): string {
    if (value < 0.1) return '< 0.1';
    return value < 1 ? value.toFixed(3) : value.toFixed(2);
  }

  formatRange(minMs: number, maxMs: number): string {
    if (maxMs < 0.1) return 'Below useful resolution';
    return `${this.formatMilliseconds(minMs)}–${this.formatMilliseconds(
      maxMs
    )} ms`;
  }

  resultInterpretation(
    result: BenchmarkArmResult,
    report: BenchmarkReport
  ): string {
    if (result.maxMs < 0.1) return 'Below useful timing resolution';

    const lowestMedian = Math.min(
      ...report.results.map((candidate) => candidate.medianMs)
    );
    const lowest = report.results.find(
      (candidate) => candidate.medianMs === lowestMedian
    );
    if (!lowest) return 'No comparison available';
    if (result.medianMs === lowestMedian) {
      const tied = report.results.filter(
        (candidate) => candidate.medianMs === lowestMedian
      ).length;
      return tied > 1
        ? 'Tied lowest observed median'
        : 'Lowest observed median';
    }

    const rangesOverlap =
      result.minMs <= lowest.maxMs && lowest.minMs <= result.maxMs;
    return rangesOverlap
      ? 'Observed ranges overlapped'
      : 'Observed ranges did not overlap';
  }
}
