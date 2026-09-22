import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BenchmarkArmResult, BenchmarkReport } from './v15-benchmark.engine';
import * as engine from './v15-benchmark.engine';
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

  it('starts with runnable tasks and keeps methodology behind disclosures', () => {
    const rendered = text(fixture);
    expect(rendered).toContain('Compare the work your app does.');
    expect(fixture.nativeElement.querySelectorAll('.workload')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('.butterfly')).toHaveLength(
      0
    );
    expect(rendered).toContain('Run benchmarks to generate this comparison.');
    expect(rendered).not.toContain('Angular leaf realization');
    expect(rendered).not.toContain('Ten-year architecture bet');
    expect(rendered).not.toContain('100,000');
    expect(
      fixture.nativeElement.querySelectorAll('details[open]')
    ).toHaveLength(0);
    expect(rendered).toContain('Development build detected');
    expect(rendered).toContain('not statistical significance tests');
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

  it('builds symmetric butterfly bars only from current measured results', () => {
    const report = recurringReport('collection', 10, [
      result('signaltree-angular', 'SignalTree Angular', 1, 0.8, 1.2),
      result('signaltree-kernel', 'SignalTree Kernel', 2, 1.8, 2.2),
      result('ngrx-signals', 'NgRx Signals', 4, 3, 5),
      result('akita', 'Akita', 3, 2.8, 3.2),
    ]);
    component.reports.set(new Map([['collection', report]]));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const charts = element.querySelectorAll<HTMLElement>('.butterfly');
    expect(charts).toHaveLength(2);
    expect([...charts].map((chart) => chart.dataset['competitor'])).toEqual([
      'akita',
      'ngrx-signals',
    ]);
    expect(
      charts[0].querySelector<HTMLElement>('.bar--baseline')?.style.width
    ).toBe('20%');
    expect(
      charts[0].querySelector<HTMLElement>('.bar--competitor')?.style.width
    ).toBe('60%');
    expect(
      charts[1].querySelector<HTMLElement>('.bar--competitor')?.style.width
    ).toBe('80%');
    expect(
      [...charts[0].querySelectorAll('.pair-axis span')].map((label) =>
        label.textContent?.trim()
      )
    ).toEqual(['5.00', '0', '5.00']);
    component.setProfileArm('signaltree-kernel');
    fixture.detectChanges();
    expect(
      charts[0].querySelector<HTMLElement>('.bar--baseline')?.style.width
    ).toBe('40%');
    expect(component.reports().get('collection')).toBe(report);
    expect(
      element.querySelectorAll('[data-workload-id="projection"] .butterfly')
    ).toHaveLength(0);
  });

  it('does not fabricate a baseline or infer significance from overlapping ranges', () => {
    const competitor = result('akita', 'Akita', 0.3, 0.2, 0.4);
    const report = recurringReport('restoration', 1, [competitor]);
    expect(component.butterflyPairs(report)).toEqual([]);
    expect(
      component.pairInterpretation(
        {
          baseline: result(
            'signaltree-angular',
            'SignalTree Angular',
            0.2,
            0.1,
            0.3
          ),
          competitor,
        },
        report.rounds
      )
    ).toContain('no clear difference');
    expect(
      component.pairInterpretation(
        {
          baseline: result(
            'signaltree-angular',
            'SignalTree Angular',
            0.02,
            0.01,
            0.04
          ),
          competitor,
        },
        report.rounds
      )
    ).toContain('Below useful timing resolution');
    expect(
      component.resultPosition(
        0,
        recurringReport('collection', 1, [
          result('signaltree-angular', 'SignalTree Angular', 0, 0, 0),
        ])
      )
    ).toBe('0%');
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
  });

  it('replaces old results on rerun and does not leave stale charts after failure', async () => {
    const previous = recurringReport('collection', 1, [
      result('signaltree-angular', 'SignalTree Angular', 1, 0.8, 1.2),
      result('akita', 'Akita', 2, 1.8, 2.2),
    ]);
    component.reports.set(new Map([['collection', previous]]));
    const runner = jest
      .spyOn(engine, 'runInterleavedBenchmark')
      .mockImplementation(async (options) => ({
        workload: options.workload,
        rounds: options.rounds,
        warmupRounds: options.warmupRounds ?? 0,
        results: [],
      }));
    try {
      const run = component.runBenchmarks();
      fixture.detectChanges();
      expect(component.reports().size).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('.butterfly')).toHaveLength(
        0
      );
      await run;
      expect(runner).toHaveBeenCalledTimes(3);
      expect(component.reports().size).toBe(3);
      expect(runner.mock.calls[0][0].arms).toEqual(component.suites()[0].arms);
      runner.mockRejectedValueOnce(new Error('Outcome check failed'));
      await component.runBenchmarks();
      fixture.detectChanges();
      expect(component.reports().size).toBe(0);
      expect(component.error()).toBe('Outcome check failed');
      expect(fixture.nativeElement.querySelectorAll('.butterfly')).toHaveLength(
        0
      );
    } finally {
      runner.mockRestore();
    }
  });

  it('shows one-round values without claiming measured variability', () => {
    const report = {
      ...recurringReport('restoration', 10, [
        result('signaltree-angular', 'SignalTree Angular', 1, 1, 1),
        result('akita', 'Akita', 4, 4, 4),
      ]),
      rounds: 1,
    };
    component.reports.set(new Map([['restoration', report]]));
    fixture.detectChanges();
    const panel: HTMLElement = fixture.nativeElement.querySelector(
      '[data-workload-id="restoration"]'
    );
    expect(panel.textContent).toContain(
      'One measured round; variability has not been measured.'
    );
    expect(panel.textContent).toContain('1.00 ms');
    expect(panel.textContent).toContain('4.00 ms');
    expect(panel.textContent).toContain('10 record/undo pairs');
    expect(panel.textContent).not.toContain('ranges do not overlap');
  });

  it('cancels a destroyed page without starting the next suite or showing partial results', async () => {
    let signal: AbortSignal | undefined;
    let started: () => void = () => undefined;
    const hasStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const runner = jest
      .spyOn(engine, 'runInterleavedBenchmark')
      .mockImplementation((options) => {
        signal = options.signal;
        started();
        return new Promise((_, reject) => {
          options.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true }
          );
        });
      });
    try {
      const run = component.runBenchmarks();
      await hasStarted;
      fixture.destroy();
      await run;
      expect(signal?.aborted).toBe(true);
      expect(runner).toHaveBeenCalledTimes(1);
      expect(component.reports().size).toBe(0);
      expect(component.error()).toBeNull();
    } finally {
      runner.mockRestore();
    }
  });
});
