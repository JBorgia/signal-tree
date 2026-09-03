import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BenchmarkReport } from './v15-benchmark.engine';
import { V15BenchmarksComponent } from './v15-benchmarks.component';

const text = (fixture: ComponentFixture<V15BenchmarksComponent>): string =>
  (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ').trim();

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

    expect(rendered).toContain('Browser performance spot-check');
    expect(rendered).toContain('Initialize and populate keyed state');
    expect(rendered).toContain('Update and read one keyed record');
    expect(rendered).toContain('Record and undo authored changes');
    expect(rendered).toContain('SignalTree Angular');
    expect(rendered).toContain('SignalTree Kernel');
    expect(rendered).toContain('NgRx Signals');
    expect(rendered).toContain('Redux Toolkit');
    expect(rendered).toContain('Zustand');
    expect(rendered).toContain('MobX');
    expect(rendered).toContain('Valtio');
    expect(rendered).toContain('One-time cost');
    expect(rendered).toContain(
      'For short-lived or read-once data, the trade may not pay back.'
    );
    expect(rendered).not.toContain('Raw Angular');
    expect(rendered).toContain('Application impact');
    expect(rendered).toContain('not statistical significance tests');
    expect(rendered).toContain('Methodology correction');
    expect(rendered).toContain('Development build detected');
    expect(rendered).toContain('How each result is calculated');
    expect(rendered).toContain('Calculation and timer boundaries');
    expect(rendered).toContain('First-party keyed entity state');
    expect(rendered).toContain('First-party linear undo over keyed state');
    expect(rendered).toContain(
      'Only implementations meeting every requirement below receive a timing'
    );
    expect(rendered).toContain(
      'choosing a Map schema and copy strategy would benchmark the harness design'
    );
    expect(rendered).toContain(
      'not the history capability required by this chart'
    );
    expect(rendered).not.toContain('Harness-supplied history outcome');
    expect(rendered).not.toContain('Middleware');
    expect(rendered).not.toContain('Async enhancer');
    expect(rendered).not.toContain('Time travel');
  });

  it('switches between quick and steady measurement plans', () => {
    expect(component.mode()).toBe('quick');
    expect(component.rounds()).toBe(3);

    component.setMode('steady');
    fixture.detectChanges();

    expect(component.mode()).toBe('steady');
    expect(component.rounds()).toBe(7);
    expect(
      fixture.nativeElement.querySelector('[aria-pressed="true"]')?.textContent
    ).toContain('Steady');
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

  it('explains the first-party capability used by each admitted history arm', () => {
    const suite = component
      .suites()
      .find((candidate) => candidate.workload.id === 'restoration');
    if (!suite) throw new Error('Expected restoration benchmark suite');

    component.openComparison(suite, 'elf');
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector(
      '.comparison-dialog'
    ) as HTMLDialogElement;
    const rendered = text(fixture);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(rendered).toContain('First-party history add-on');
    expect(rendered).toContain('First-party Elf history add-on');
    expect(rendered).toContain('What was added');
    expect(rendered).toContain(
      'installs @ngneat/elf-state-history on the real Elf entity store'
    );
    expect(rendered).toContain('What was not included');
    expect(rendered).not.toContain('Harness-supplied history outcome');

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
