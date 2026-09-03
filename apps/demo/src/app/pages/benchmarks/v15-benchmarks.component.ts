import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  isDevMode,
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
  BenchmarkPackageReference,
  BenchmarkSource,
  createV15BenchmarkSuites,
  DEFAULT_V15_BENCHMARK_CONFIG,
  V15BenchmarkArm,
  V15BenchmarkConfig,
  V15_BENCHMARK_SOURCE_PATHS,
  V15_BENCHMARK_SOURCE_URLS,
  V15BenchmarkSuite,
} from './v15-benchmark.workloads';

type BenchmarkMode = 'quick' | 'steady';
type SignalTreeProfileArmId = 'signaltree-angular' | 'signaltree-kernel';
type RecurringWorkloadId = 'collection' | 'projection' | 'restoration';

interface ActiveComparison {
  readonly suite: V15BenchmarkSuite;
  readonly arm: V15BenchmarkArm;
}

interface ValueFoundation {
  readonly status: string;
  readonly title: string;
  readonly durableValue: string;
  readonly currentCost: string;
  readonly evidence: readonly string[];
}

interface SteadyStateProfile {
  readonly workloadId: RecurringWorkloadId;
  readonly title: string;
  readonly unit: string;
  readonly result: BenchmarkArmResult;
  readonly operations: number;
  readonly position: number;
  readonly cohortSize: number;
}

const RECURRING_PROFILES: readonly {
  readonly workloadId: RecurringWorkloadId;
  readonly title: string;
  readonly unit: string;
}[] = [
  {
    workloadId: 'collection',
    title: 'Keyed update and point read',
    unit: 'update + by-ID read',
  },
  {
    workloadId: 'projection',
    title: 'Keyed update and coherent complete read',
    unit: 'update + complete read',
  },
  {
    workloadId: 'restoration',
    title: 'Designated change and undo',
    unit: 'record + undo pair',
  },
];

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
export class V15BenchmarksComponent {
  private readonly comparisonDialog =
    viewChild<ElementRef<HTMLDialogElement>>('comparisonDialog');

  readonly isDevBuild = isDevMode();
  readonly benchmarkSourcePaths = V15_BENCHMARK_SOURCE_PATHS;
  readonly benchmarkSourceUrls = V15_BENCHMARK_SOURCE_URLS;
  readonly valueFoundations: readonly ValueFoundation[] = [
    {
      status: 'Public contract',
      title: 'Typed dot notation survives representation changes',
      durableValue:
        'Consumers keep tree.$.branch.leaf and typed entity-field handles while the physical storage and indexing strategy can change underneath.',
      currentCost:
        'This is a compatibility constraint, not a performance benefit. A denser or faster substrate must preserve the inferred read/write types.',
      evidence: [
        'packages/kernel/src/carrier-propagation.typing.spec.ts',
        'packages/kernel/src/enhancers/transactions/transactions-contract.typing.spec.ts',
      ],
    },
    {
      status: 'Measured; not globally optimal',
      title: 'Speed is judged per workload, not globally',
      durableValue:
        'Keyed point updates avoid rebuilding the collection. The new recurring projection workload separately measures the known complete-read cost after mutation.',
      currentCost:
        'SignalTree is not called optimal when a recurring workload loses. The browser profile keeps point access, complete projection, and restoration separate so each reproducible deficit remains an optimization target.',
      evidence: [
        'apps/demo/src/app/pages/benchmarks/v15-benchmark.workloads.ts',
        'tools/bench-vs-signalstore.mjs',
        'tools/bench-workload-classes.mjs',
        'tools/bench-update-matrix.mjs',
      ],
    },
    {
      status: 'Measured; not proven optimal',
      title: 'Density remains an independent release constraint',
      durableValue:
        'The typed API does not require one permanent physical layout. Consolidation candidates can change allocation without changing application code.',
      currentCost:
        'The production entity layout is retained because no tested candidate beat it across density, latency, identity, lifecycle, rollback, restoration, and GC. Denser prototypes are evidence, not production wins.',
      evidence: [
        'docs/architecture/entity-physical-density.md',
        'tools/bench-entity-physical-density.mjs',
        'tools/bench-subject-record-consolidation.mjs',
        'tools/bench-capability-density.mjs',
      ],
    },
    {
      status: 'Correctness foundation',
      title: 'Optimistic and causal work avoids a future state-model rewrite',
      durableValue:
        'Pending work can confirm or roll back; rollback refuses when later authored or server-realized work depends on speculation; unrelated external truth survives.',
      currentCost:
        'Retained subject-density cost is pay-for-participation: the capability-density matrix currently finds no material live-subject slope for causal-runtime-only or configured-but-unused restoration. Fixed tree cost, CPU work, and retained active history remain real.',
      evidence: [
        'packages/kernel/src/enhancers/transactions/transactions.ts',
        'packages/kernel/src/enhancers/transactions/tx-ledger-c3.spec.ts',
        'packages/kernel/src/lib/link-0-three-directions.spec.ts',
        'tools/bench-capability-density.mjs',
        'tools/bench-update-matrix.mjs',
      ],
    },
  ];
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
  readonly steadyStateProfiles = computed<readonly SteadyStateProfile[]>(() =>
    RECURRING_PROFILES.flatMap((profile) => {
      const report = this.reports().get(profile.workloadId);
      if (!report) return [];
      const ranked = this.rankedResults(report);
      const result = ranked.find(
        (candidate) => candidate.armId === this.profileArmId()
      );
      if (!result) return [];

      return [
        {
          ...profile,
          result,
          operations: report.workload.operations,
          position:
            ranked.findIndex((candidate) => candidate.armId === result.armId) +
            1,
          cohortSize: ranked.length,
        },
      ];
    })
  );

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
    if (this.isRunning() || this.roundInputError()) return;

    this.reports.set(new Map());
    this.error.set(null);

    try {
      for (const suite of this.suites()) {
        this.activeWorkload.set(suite.workload.id);
        await yieldToBrowserTask();
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

  armPackages(
    arms: readonly V15BenchmarkArm[],
    armId: string
  ): readonly BenchmarkPackageReference[] {
    return arms.find((arm) => arm.id === armId)?.comparison.packages ?? [];
  }

  armSources(
    arms: readonly V15BenchmarkArm[],
    armId: string
  ): readonly BenchmarkSource[] {
    return arms.find((arm) => arm.id === armId)?.comparison.sources ?? [];
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

  normalizedRecurringCost(
    profile: SteadyStateProfile,
    operationCount: number
  ): number {
    return (profile.result.medianMs / profile.operations) * operationCount;
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
