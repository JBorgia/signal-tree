import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  isDevMode,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';

import { DEMO_LIBRARY_VERSIONS } from '../../library-versions';
import {
  BenchmarkArmResult,
  BenchmarkReport,
  BenchmarkWorkloadId,
  runInterleavedBenchmark,
  yieldToBrowserTask,
} from './v15-benchmark.engine';
import {
  createV15BenchmarkSuites,
  DEFAULT_V15_BENCHMARK_CONFIG,
  V15BenchmarkArm,
  V15BenchmarkConfig,
  V15_BENCHMARK_SOURCE_PATHS,
  V15BenchmarkSuite,
} from './v15-benchmark.workloads';

type BenchmarkMode = 'quick' | 'steady';
type SignalTreeProfileArmId = 'signaltree-angular' | 'signaltree-kernel';

interface ActiveComparison {
  readonly suite: V15BenchmarkSuite;
  readonly arm: V15BenchmarkArm;
}

interface ButterflyPair {
  readonly baseline: BenchmarkArmResult;
  readonly competitor: BenchmarkArmResult;
}

const QUICK_CONFIG: V15BenchmarkConfig = {
  collectionSize: 1_000,
  collectionUpdates: 50,
  restorationSize: 250,
  restorationWrites: 10,
};

const QUICK_ROUNDS = 25;
const STEADY_ROUNDS = 100;
const MAX_CUSTOM_ROUNDS = 1_000;

const parseRoundCount = (value: string): number | undefined => {
  const rounds = Number(value);
  return value.trim() !== '' &&
    Number.isInteger(rounds) &&
    rounds >= 1 &&
    rounds <= MAX_CUSTOM_ROUNDS
    ? rounds
    : undefined;
};

@Component({
  selector: 'app-v15-benchmarks',
  standalone: true,
  templateUrl: './v15-benchmarks.component.html',
  styleUrl: './v15-benchmarks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class V15BenchmarksComponent implements OnDestroy {
  private readonly runController = new AbortController();
  private readonly comparisonDialog =
    viewChild<ElementRef<HTMLDialogElement>>('comparisonDialog');

  readonly isDevBuild = isDevMode();
  readonly benchmarkSourcePaths = V15_BENCHMARK_SOURCE_PATHS;
  readonly mode = signal<BenchmarkMode>('quick');
  readonly activeWorkload = signal<BenchmarkWorkloadId | null>(null);
  readonly reports = signal<ReadonlyMap<BenchmarkWorkloadId, BenchmarkReport>>(
    new Map()
  );
  readonly error = signal<string | null>(null);
  readonly activeComparison = signal<ActiveComparison | null>(null);
  readonly profileArmId = signal<SignalTreeProfileArmId>('signaltree-angular');

  readonly rounds = signal(QUICK_ROUNDS);
  readonly roundInput = signal(String(QUICK_ROUNDS));
  readonly roundInputError = computed(() =>
    parseRoundCount(this.roundInput()) === undefined
      ? 'Enter a whole number from 1 to 1,000.'
      : null
  );
  readonly warmupRounds = computed(() => (this.mode() === 'quick' ? 2 : 5));
  readonly config = computed(() =>
    this.mode() === 'quick' ? QUICK_CONFIG : DEFAULT_V15_BENCHMARK_CONFIG
  );
  readonly suites = computed(() => createV15BenchmarkSuites(this.config()));
  readonly isRunning = computed(() => this.activeWorkload() !== null);
  taskTitle(id: BenchmarkWorkloadId): string {
    return id === 'collection'
      ? 'Update and read one record'
      : id === 'projection'
      ? 'Update and read the whole collection'
      : 'Record and undo changes';
  }

  butterflyPairs(report: BenchmarkReport): readonly ButterflyPair[] {
    const baseline = report.results.find(
      (result) => result.armId === this.profileArmId()
    );
    if (!baseline) return [];
    return this.rankedResults(report)
      .filter((result) => !result.armId.startsWith('signaltree-'))
      .map((competitor) => ({ baseline, competitor }));
  }

  pairInterpretation(pair: ButterflyPair, measuredRounds: number): string {
    if (measuredRounds < 2)
      return 'One measured round; variability has not been measured.';
    if (pair.baseline.maxMs < 0.1 || pair.competitor.maxMs < 0.1)
      return 'Below useful timing resolution; no clear comparison.';
    return pair.baseline.minMs <= pair.competitor.maxMs &&
      pair.competitor.minMs <= pair.baseline.maxMs
      ? 'Observed ranges overlap; no clear difference in this run.'
      : 'Observed ranges do not overlap in this run.';
  }

  setMode(mode: BenchmarkMode): void {
    if (this.isRunning()) return;
    this.mode.set(mode);
    const rounds = mode === 'quick' ? QUICK_ROUNDS : STEADY_ROUNDS;
    this.rounds.set(rounds);
    this.roundInput.set(String(rounds));
    this.reports.set(new Map());
    this.error.set(null);
  }

  setRoundInput(value: string): void {
    if (this.isRunning()) return;
    this.roundInput.set(value);
    const rounds = parseRoundCount(value);
    if (rounds !== undefined) this.rounds.set(rounds);
    this.reports.set(new Map());
    this.error.set(null);
  }

  setProfileArm(armId: SignalTreeProfileArmId): void {
    this.profileArmId.set(armId);
  }

  async runBenchmarks(): Promise<void> {
    if (
      this.runController.signal.aborted ||
      this.isRunning() ||
      this.roundInputError()
    )
      return;

    this.reports.set(new Map());
    this.error.set(null);

    try {
      for (const suite of this.suites()) {
        this.activeWorkload.set(suite.workload.id);
        await yieldToBrowserTask();
        if (this.runController.signal.aborted) return;
        const report = await runInterleavedBenchmark({
          workload: suite.workload,
          arms: suite.arms,
          rounds: this.rounds(),
          warmupRounds: this.warmupRounds(),
          signal: this.runController.signal,
        });
        if (this.runController.signal.aborted) return;
        this.reports.update((current) => {
          const next = new Map(current);
          next.set(suite.workload.id, report);
          return next;
        });
      }
    } catch (error) {
      if (this.runController.signal.aborted) return;
      this.error.set(
        error instanceof Error ? error.message : 'The benchmark run failed.'
      );
    } finally {
      this.activeWorkload.set(null);
    }
  }

  ngOnDestroy(): void {
    this.runController.abort();
    this.reports.set(new Map());
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

  packageVersion(versionKey: string): string {
    return DEMO_LIBRARY_VERSIONS[versionKey] ?? 'unknown';
  }

  repositorySourceUrl(path: string): string {
    return `https://github.com/JBorgia/signal-tree/blob/main/${path}`;
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
    return Math.max(0.1, ...report.results.map((result) => result.maxMs));
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
}
