import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WhyCausalityComponent } from './why-causality.component';

const renderedText = (element: HTMLElement): string =>
  element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('WhyCausalityComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhyCausalityComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('switches the illustrated scenario through its native radio control', () => {
    const fixture = TestBed.createComponent(WhyCausalityComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const radios = Array.from(
      root.querySelectorAll<HTMLInputElement>('input[name="causal-scenario"]')
    );
    expect(radios).toHaveLength(3);
    expect(radios.filter(({ checked }) => checked)).toHaveLength(1);
    expect(root.querySelector('.text-link')?.getAttribute('href')).toBe(
      '/restoration'
    );

    radios[2].checked = true;
    radios[2].dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedScenarioId()).toBe('identity');
    expect(
      root.querySelector('[role="region"]')?.getAttribute('aria-label')
    ).toBe('Keep a record scenario');
    expect(renderedText(root)).toContain(
      'changeId() preserves the record’s identity'
    );
    expect(root.querySelector('.text-link')?.getAttribute('href')).toBe(
      '/entities'
    );
    expect(radios.filter(({ checked }) => checked)).toHaveLength(1);
  });

  it('keeps each scenario concise and distinguishes illustration from runnable examples', () => {
    const fixture = TestBed.createComponent(WhyCausalityComponent);
    const root = fixture.nativeElement as HTMLElement;
    for (const scenario of fixture.componentInstance.scenarios) {
      fixture.componentInstance.selectScenario(scenario.id);
      fixture.detectChanges();
      const text = renderedText(root);
      expect(text.split(/\s+/).length).toBeLessThan(400);
      expect(text).toContain(
        'These explain the behavior; the linked examples run it.'
      );
      expect(root.querySelector('.text-link')?.getAttribute('href')).toBe(
        scenario.route
      );
    }
  });

  it('preserves incoming section anchors and the path to deeper architecture', () => {
    const fixture = TestBed.createComponent(WhyCausalityComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    for (const id of [
      'proof',
      'market-value',
      'integrated-system',
      'incident-ledger',
      'ai-future',
      'competitive-truth',
    ]) {
      expect(root.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(
      root.querySelector('a[href="/architecture-overview"]')
    ).not.toBeNull();
    expect(root.querySelector('a[href="/start"]')).not.toBeNull();
  });
});
