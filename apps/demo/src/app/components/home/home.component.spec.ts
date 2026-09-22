import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HomeComponent } from './home.component';

const renderedText = (element: HTMLElement): string =>
  element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const settleTurn = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 10));

describe('HomeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('provides a short entry point and preserves the v14 archive', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(renderedText(element)).toContain(
      'Update one field. Keep the rest intact.'
    );
    expect(
      element.querySelector('[data-brand-mark]')?.getAttribute('src')
    ).toBe('/signaltree-mark.png');
    expect(element.querySelector('.rewrite-note a')?.getAttribute('href')).toBe(
      '/v14/'
    );
    expect(element.querySelector('.hero-actions a')?.getAttribute('href')).toBe(
      '#try-it'
    );
    expect(element.querySelector('a[href="/why-causality"]')).not.toBeNull();
  });

  it('undoes a user edit while retaining an incoming status and the other record', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const actions = element.querySelectorAll<HTMLButtonElement>(
      '.demo-actions button'
    );
    await settleTurn();
    expect(
      fixture.componentInstance.priorityReaders.map((read) => read().runs)
    ).toEqual([1, 1]);
    actions[0].click();
    await settleTurn();
    fixture.detectChanges();
    expect(
      element.querySelector('[data-order="101"] [data-priority]')?.textContent
    ).toContain('Rush');
    expect(
      fixture.componentInstance.priorityReaders.map((read) => read().runs)
    ).toEqual([2, 1]);
    actions[1].click();
    await settleTurn();
    fixture.detectChanges();
    expect(
      fixture.componentInstance.priorityReaders.map((read) => read().runs)
    ).toEqual([2, 1]);
    expect(actions[2].disabled).toBe(false);
    actions[2].click();
    await settleTurn();
    fixture.detectChanges();
    expect(
      element.querySelector('[data-order="101"] [data-priority]')?.textContent
    ).toContain('Standard');
    expect(
      element.querySelector('[data-order="101"] [data-status]')?.textContent
    ).toContain('Shipped');
    expect(
      element.querySelector('[data-order="102"] [data-priority]')?.textContent
    ).toContain('Standard');
    expect(
      element.querySelector('[data-order="102"] [data-status]')?.textContent
    ).toContain('Ready');
    expect(actions[2].disabled).toBe(true);
    actions[3].click();
    await settleTurn();
    fixture.detectChanges();
    expect(
      element.querySelector('[data-order="101"] [data-status]')?.textContent
    ).toContain('Packing');
    expect(actions[2].disabled).toBe(true);
  });

  it('starts each visit with independently owned state', async () => {
    const first = TestBed.createComponent(HomeComponent);
    first.detectChanges();
    first.componentInstance.prioritize();
    await settleTurn();
    first.destroy();
    const next = TestBed.createComponent(HomeComponent);
    next.detectChanges();
    expect(next.componentInstance.orders[0].priority()).toBe('Standard');
    expect(next.componentInstance.canUndo()).toBe(false);
  });

  it('keeps the install command and setup destination in sync for every framework', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const buttons = element.querySelectorAll<HTMLButtonElement>(
      '.framework-options button'
    );
    for (const [index, id] of ['angular', 'react', 'vue', 'kernel'].entries()) {
      buttons[index].click();
      fixture.detectChanges();
      expect(element.querySelector('.install-panel code')?.textContent).toBe(
        `npm install @signal-tree/${id}`
      );
      expect(
        element.querySelector('.install-panel a')?.getAttribute('href')
      ).toBe(`/docs?package=${id}`);
    }
  });
});
