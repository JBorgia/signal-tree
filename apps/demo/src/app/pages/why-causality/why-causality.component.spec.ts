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

  it('makes the causal and market-value case without an exclusivity overclaim', () => {
    const fixture = TestBed.createComponent(WhyCausalityComponent);
    fixture.detectChanges();
    const text = renderedText(fixture.nativeElement);

    expect(text).toContain('Causality is the part of state that compounds');
    expect(text).toContain('AI raises the price of missing causality');
    expect(text).toContain(
      'Yes—by adopting the same class of responsibilities'
    );
    expect(text).toContain('SignalTree ships the integrated model');
    expect(text).not.toContain('the only library');
    expect(text).not.toContain('impossible for every other library');
  });

  it('demonstrates that one snapshot can have different causal histories', () => {
    const fixture = TestBed.createComponent(WhyCausalityComponent);
    fixture.detectChanges();

    expect(renderedText(fixture.nativeElement)).toContain(
      'order.status = "approved"'
    );

    fixture.componentInstance.selectScenario('identity');
    fixture.detectChanges();

    const text = renderedText(fixture.nativeElement);
    expect(text).toContain('queue = [B, A, C]');
    expect(text).toContain('The same subjects were reordered');
    expect(text).toContain('Old rows were replaced by lookalikes');
  });

  it('exposes scenario selection as one native radio group', () => {
    const fixture = TestBed.createComponent(WhyCausalityComponent);
    fixture.detectChanges();
    const radios = Array.from(
      fixture.nativeElement.querySelectorAll(
        'input[type="radio"][name="causal-scenario"]'
      ) as NodeListOf<HTMLInputElement>
    );

    expect(radios).toHaveLength(3);
    expect(radios.filter(({ checked }) => checked)).toHaveLength(1);
  });

  it('provides links into the current architecture and examples', () => {
    const fixture = TestBed.createComponent(WhyCausalityComponent);
    fixture.detectChanges();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll(
        'a'
      ) as NodeListOf<HTMLAnchorElement>
    ).map((anchor) => anchor.getAttribute('href'));

    expect(links).toContain('/architecture-overview');
    expect(links).toContain('/examples/fundamentals');
    expect(links).toContain('/start');
  });
});
