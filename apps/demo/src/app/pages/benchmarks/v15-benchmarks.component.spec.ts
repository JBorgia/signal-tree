import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BenchmarkArmResult, BenchmarkReport } from './v15-benchmark.engine';
import { V15BenchmarksComponent } from './v15-benchmarks.component';

const text = (fixture: ComponentFixture<V15BenchmarksComponent>): string =>
  (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ').trim();

const result = (
  armId: string,
  label: string,
  medianMs: number,
  minMs: number,
  maxMs: number
): BenchmarkArmResult => ({
  armId,
  label,
  color: '#000000',
  medianMs,
  minMs,
  maxMs,
  spreadMs: maxMs - minMs,
  microsecondsPerOperation: medianMs * 1000,
  samples: [minMs, medianMs, maxMs],
  phases: [],
});

const recurringReport = (
  id: 'collection' | 'projection' | 'restoration',
  operations: number,
  results: readonly BenchmarkArmResult[]
): BenchmarkReport => ({
  workload: {
    id,
    title: id,
    description: id,
    operations,
    expectedChecksum: 'ok',
  },
  rounds: 3,
  warmupRounds: 1,
  results,
});

describe('V15BenchmarksComponent', () => {
  let fixture: ComponentFixture<V15BenchmarksComponent>;
  let component: V15BenchmarksComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [V15BenchmarksComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(V15BenchmarksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('presents only checked v15 browser workloads', () => {
    const rendered = text(fixture);

    expect(rendered).toContain('Recurring application-state performance');
    expect(rendered).not.toContain('Initialize and populate keyed state');
    expect(rendered).toContain('Update and read standalone scalar state');
    expect(rendered).toContain('Update and read one keyed record');
    expect(rendered).toContain('Update one record and re-read the collection');
    expect(rendered).toContain('Consequential authored work: record and undo');
    expect(rendered).toContain('SignalTree Angular');
    expect(rendered).toContain('SignalTree Kernel');
    expect(rendered).toContain('NgRx Signals');
    expect(rendered).toContain('Redux Toolkit');
    expect(rendered).toContain('TanStack Store');
    expect(rendered).toContain('Zustand');
    expect(rendered).toContain('MobX');
    expect(rendered).toContain('Valtio');
    expect(rendered).not.toContain('One-time cost');
    expect(rendered).toContain('Recurring work is the product benchmark');
    expect(rendered).toContain(
      'Initialization is a budget, not an optimization target'
    );
    expect(rendered).toContain('it receives no public rank and no value score');
    expect(rendered).not.toContain('Raw Angular');
    expect(rendered).toContain('Application impact');
    expect(rendered).toContain('not statistical significance tests');
    expect(rendered).toContain('Methodology correction');
    expect(rendered).toContain('Development build detected');
    expect(rendered).toContain('How each result is calculated');
    expect(rendered).toContain('Calculation and timer boundaries');
    expect(rendered).toContain('First-party keyed entity state');
    expect(rendered).toContain('Framework-neutral frontend scalar state');
    expect(rendered).toContain('First-party linear undo over keyed state');
    expect(rendered).toContain(
      'Only implementations meeting every requirement receive a timing'
    );
    expect(rendered).toContain(
      'does not disqualify a storage strategy from internal speed or density experiments'
    );
    expect(rendered).toContain(
      'choosing a Map schema and copy strategy would benchmark the harness design'
    );
    expect(rendered).toContain(
      'not the history capability required by this chart'
    );
    expect(rendered).toContain(
      'Sub-millisecond browser gaps near the timer floor are diagnostic'
    );
    expect(rendered).toContain(
      'overlapping observed ranges mean no clear difference in that run'
    );
    expect(rendered).not.toContain('Harness-supplied history outcome');
    expect(rendered).toContain('Source rule:');
    expect(rendered).toContain(
      'it does not claim that no community add-on exists'
    );
    expect(rendered).toContain('@ngrx/signals 21.1.1');
    expect(rendered).toContain('@reduxjs/toolkit 2.12.0');
    expect(rendered).toContain('@tanstack/store 0.11.1');
    expect(rendered).toContain('Reproduce and inspect');
    expect(rendered).toContain('Ten-year architecture bet');
    expect(rendered).toContain(
      'Typed dot notation survives representation changes'
    );
    expect(rendered).toContain(
      'Optimistic and causal work avoids a future state-model rewrite'
    );
    expect(rendered).toContain(
      'every reproducible deficit is an optimization target'
    );
    expect(rendered).toContain(
      'Retained subject-density cost is pay-for-participation'
    );
    expect(
      fixture.nativeElement.querySelectorAll('.foundation-evidence a')
    ).toHaveLength(15);
    expect(rendered).toContain(
      'Front-load work when it makes recurring speed, density, allocation, GC, restoration, or churn better'
    );
    expect(rendered).not.toContain('Does recurring benefit repay setup cost?');
    expect(rendered).not.toContain('crossover');
    expect(rendered).not.toContain('lifetime advantage');
    expect(
      fixture.nativeElement.querySelectorAll('.capability-admission a').length
    ).toBeGreaterThan(0);
    expect(
      fixture.nativeElement.querySelectorAll('.evidence-line a')
    ).toHaveLength(12);
    expect(
      fixture.nativeElement.querySelectorAll('.planned-arm .source-links a')
    ).toHaveLength(15);
    expect(rendered).not.toContain('Middleware');
    expect(rendered).not.toContain('Async enhancer');
    expect(rendered).not.toContain('Time travel');
  });

  it('switches between quick and steady measurement plans', () => {
    expect(component.mode()).toBe('quick');
    expect(component.rounds()).toBe(25);
    expect(component.warmupRounds()).toBe(2);

    component.setMode('steady');
    fixture.detectChanges();

    expect(component.mode()).toBe('steady');
    expect(component.rounds()).toBe(100);
    expect(component.warmupRounds()).toBe(5);
    expect(
      fixture.nativeElement.querySelector('[aria-pressed="true"]')?.textContent
    ).toContain('Steady');
  });

  it('accepts a bounded custom measured-round count', () => {
    component.setRoundInput('73');
    fixture.detectChanges();

    expect(component.rounds()).toBe(73);
    expect(component.roundInputError()).toBeNull();
    expect(
      fixture.nativeElement.querySelector<HTMLInputElement>('#measured-rounds')
        ?.value
    ).toBe('73');

    component.setRoundInput('0');
    fixture.detectChanges();

    expect(component.roundInputError()).toBe(
      'Enter a whole number from 1 to 1,000.'
    );
    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>('.run-command')
        ?.disabled
    ).toBe(true);
  });

  it('does not turn overlapping observed ranges into a winner claim', () => {
    const report: BenchmarkReport = {
      workload: {
        id: 'restoration',
        title: 'History',
        description: 'Checked history',
        operations: 1,
        expectedChecksum: 'ok',
      },
      rounds: 3,
      warmupRounds: 1,
      results: [
        {
          armId: 'lowest',
          label: 'Lowest',
          color: '#000000',
          medianMs: 0.2,
          minMs: 0.1,
          maxMs: 0.3,
          spreadMs: 0.2,
          microsecondsPerOperation: 200,
          samples: [0.1, 0.2, 0.3],
          phases: [],
        },
        {
          armId: 'overlap',
          label: 'Overlap',
          color: '#000000',
          medianMs: 0.3,
          minMs: 0.2,
          maxMs: 0.4,
          spreadMs: 0.2,
          microsecondsPerOperation: 300,
          samples: [0.2, 0.3, 0.4],
          phases: [],
        },
      ],
    };

    expect(component.resultInterpretation(report.results[1], report)).toBe(
      'Observed ranges overlapped'
    );

    const tiedReport: BenchmarkReport = {
      ...report,
      results: [
        { ...report.results[0], armId: 'later', minMs: 0.2 },
        {
          ...report.results[1],
          armId: 'earlier',
          medianMs: 0.2,
          minMs: 0.1,
        },
      ],
    };
    expect(component.rankedResults(tiedReport)[0].armId).toBe('earlier');
    expect(
      tiedReport.results.map((result) =>
        component.resultInterpretation(result, tiedReport)
      )
    ).toEqual(['Tied lowest observed median', 'Tied lowest observed median']);
  });

  it('orders measured rows by result and renders a visual range for each arm', () => {
    const report: BenchmarkReport = {
      workload: {
        id: 'collection',
        title: 'Collection',
        description: 'Checked collection',
        operations: 1,
        expectedChecksum: 'ok',
      },
      rounds: 3,
      warmupRounds: 1,
      results: [
        {
          armId: 'slower',
          label: 'Slower',
          color: '#aa0000',
          medianMs: 4,
          minMs: 3,
          maxMs: 5,
          spreadMs: 2,
          microsecondsPerOperation: 4_000,
          samples: [3, 4, 5],
          phases: [],
        },
        {
          armId: 'faster',
          label: 'Faster',
          color: '#00aa00',
          medianMs: 2,
          minMs: 1,
          maxMs: 3,
          spreadMs: 2,
          microsecondsPerOperation: 2_000,
          samples: [1, 2, 3],
          phases: [],
        },
      ],
    };

    component.reports.set(new Map([['collection', report]]));
    fixture.detectChanges();

    const rows = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-workload-id="collection"] .result-row'
      ) as NodeListOf<HTMLElement>
    );
    expect(rows.map((row) => row.dataset['armId'])).toEqual([
      'faster',
      'slower',
    ]);
    expect(rows.map((row) => row.dataset['rank'])).toEqual(['1', '2']);
    expect(
      fixture.nativeElement.querySelectorAll(
        '[data-workload-id="collection"] .result-visual-track'
      )
    ).toHaveLength(2);
  });

  it('normalizes three independent recurring workloads without a setup score', () => {
    component.reports.set(
      new Map([
        [
          'collection',
          recurringReport('collection', 10, [
            result('signaltree-angular', 'SignalTree Angular', 1, 0.8, 1.2),
            result('signaltree-kernel', 'SignalTree Kernel', 2, 1.8, 2.2),
            result('akita', 'Akita', 3, 2.8, 3.2),
          ]),
        ],
        [
          'projection',
          recurringReport('projection', 10, [
            result('signaltree-angular', 'SignalTree Angular', 2, 1.8, 2.2),
            result('signaltree-kernel', 'SignalTree Kernel', 3, 2.8, 3.2),
            result('akita', 'Akita', 5, 4.8, 5.2),
          ]),
        ],
        [
          'restoration',
          recurringReport('restoration', 10, [
            result('akita', 'Akita', 1, 0.8, 1.2),
            result('signaltree-kernel', 'SignalTree Kernel', 3, 2.8, 3.2),
            result('signaltree-angular', 'SignalTree Angular', 4, 3.8, 4.2),
          ]),
        ],
      ])
    );
    fixture.detectChanges();

    expect(component.steadyStateProfiles()).toHaveLength(3);
    expect(text(fixture)).toContain('What compounds after construction');
    expect(text(fixture)).toContain('100.00 ms');
    expect(text(fixture)).toContain('200.00 ms');
    expect(text(fixture)).toContain('400.00 ms');
    expect(text(fixture)).toContain(
      'No workload is pooled into an aggregate score'
    );

    component.setProfileArm('signaltree-kernel');
    fixture.detectChanges();
    expect(
      component.steadyStateProfiles().map((profile) => profile.position)
    ).toEqual([2, 2, 2]);
    expect(text(fixture)).toContain('300.00 ms');
  });

  it('explains the first-party capability used by each admitted history arm', () => {
    const suite = component
      .suites()
      .find((candidate) => candidate.workload.id === 'restoration');
    if (!suite) throw new Error('Expected restoration benchmark suite');

    component.openComparison(suite, 'akita');
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector(
      '.comparison-dialog'
    ) as HTMLDialogElement;
    const rendered = text(fixture);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(rendered).toContain('First-party history add-on');
    expect(rendered).toContain('First-party Akita StateHistoryPlugin');
    expect(rendered).toContain('@datorama/akita 8.0.1');
    expect(rendered).toContain('What was added');
    expect(rendered).toContain(
      'attaches StateHistoryPlugin to the real Akita QueryEntity'
    );
    expect(rendered).toContain('What was not included');
    expect(rendered).not.toContain('Harness-supplied history outcome');
    expect(
      dialog.querySelector(
        'a[href="https://opensource.salesforce.com/akita/docs/plugins/state-history/"]'
      )
    ).not.toBeNull();

    component.closeComparison();
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('labels values below useful browser resolution instead of printing zero', () => {
    expect(component.formatMilliseconds(0)).toBe('< 0.1');
    expect(component.formatRange(0, 0.08)).toBe('Below useful resolution');
    expect(component.formatRange(0.04, 0.2)).toBe('< 0.1–0.200 ms');

    const belowResolution: BenchmarkReport = {
      workload: {
        id: 'collection',
        title: 'Collection',
        description: 'Checked collection',
        operations: 1,
        expectedChecksum: 'ok',
      },
      rounds: 3,
      warmupRounds: 1,
      results: [
        {
          armId: 'fast',
          label: 'Fast',
          color: '#000000',
          medianMs: 0.04,
          minMs: 0.02,
          maxMs: 0.08,
          spreadMs: 0.06,
          microsecondsPerOperation: 40,
          samples: [0.02, 0.04, 0.08],
          phases: [],
        },
      ],
    };
    expect(
      component.resultInterpretation(
        belowResolution.results[0],
        belowResolution
      )
    ).toBe('Below useful timing resolution');
  });
});
