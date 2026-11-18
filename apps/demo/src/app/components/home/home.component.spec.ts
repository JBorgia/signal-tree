import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HomeComponent } from './home.component';

const renderedText = (element: HTMLElement): string =>
  element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('HomeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('opens with an explicitly unreleased review story and audience perspectives', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const text = renderedText(fixture.nativeElement);
    const mark = fixture.nativeElement.querySelector(
      '[data-brand-mark]'
    ) as HTMLImageElement | null;

    expect(
      fixture.nativeElement
        .querySelector('a[fragment="accessor-grammar"]')
        ?.getAttribute('href')
    ).toBe('/architecture-overview#accessor-grammar');
    expect(text).toContain('v16 development preview · Unreleased');
    expect(text).toContain('Review proposed changes. Keep your work moving.');
    expect(text).toContain('For the person using the app');
    expect(text).toContain('For the developer');
    expect(text).toContain('For the business');
    expect(text).toContain('See why causality compounds');
    expect(mark?.getAttribute('src')).toBe('/signaltree-mark.png');
    expect(mark?.getAttribute('alt')).toBe('SignalTree');
    expect(
      fixture.nativeElement
        .querySelector('.action-primary')
        ?.getAttribute('href')
    ).toBe('/independent-publication');
  });

  it('promotes the causal value case from the first viewport', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll(
        'a'
      ) as NodeListOf<HTMLAnchorElement>
    );

    expect(
      links.some(
        (link) =>
          link.getAttribute('href') === '/why-causality' &&
          link.textContent?.includes('Why causality matters')
      )
    ).toBe(true);
  });

  it('identifies v15 as a rewrite and preserves the v14 site', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const text = renderedText(fixture.nativeElement);
    const legacyLink = fixture.nativeElement.querySelector(
      '.rewrite-note a'
    ) as HTMLAnchorElement | null;

    expect(text).toContain('Version 15 is a ground-up causal rewrite');
    expect(text).toContain('historical guidance');
    expect(legacyLink?.getAttribute('href')).toBe('/v14/');
  });

  it('does not repeat unsupported performance or selector claims', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const text = renderedText(fixture.nativeElement);

    expect(text).not.toContain('0.036ms');
    expect(text).not.toContain('Selectors needed');
    expect(text).not.toContain('bundle visualisation');
  });
});
