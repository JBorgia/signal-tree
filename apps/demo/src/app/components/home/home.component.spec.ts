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

  it('opens with the verified v15 mental model and current ST mark', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const text = renderedText(fixture.nativeElement);
    const mark = fixture.nativeElement.querySelector(
      '[data-brand-mark]'
    ) as HTMLImageElement | null;

    expect(text).toContain('State authority without state ceremony');
    expect(text).toContain('Authored work');
    expect(text).toContain('External truth');
    expect(text).toContain('Framework-native observation');
    expect(mark?.getAttribute('src')).toBe('/signaltree-mark.png');
    expect(mark?.getAttribute('alt')).toBe('SignalTree');
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
