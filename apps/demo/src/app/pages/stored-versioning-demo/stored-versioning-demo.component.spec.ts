import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { StoredVersioningDemoComponent } from './stored-versioning-demo.component';

/**
 * The 13-test suite that used to live here tested `component.basicStore`,
 * `incrementCounter()` and the rest of a `stored()` demo. `stored` was removed
 * from the RC public surface in c53aa416 and this component was gutted to a
 * withdrawal notice in the same commit — but the spec was left behind, so all
 * 13 tests failed. The first error was NG0201 (the template routerLink has no
 * ActivatedRoute), which made it look like a missing provider; providing a
 * router would only have surfaced 13 "undefined is not a function" failures
 * underneath it.
 *
 * What is left worth asserting is that the withdrawal notice still renders and
 * still points somewhere real. A page that 404s or blanks is worse than one
 * that explains itself.
 */
describe('StoredVersioningDemoComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoredVersioningDemoComponent],
      // The template uses routerLink; without this the component cannot render
      // at all. This is the NG0201 the old suite tripped over.
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the withdrawal notice rather than a blank or broken page', () => {
    const fixture = TestBed.createComponent(StoredVersioningDemoComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Stored Versioning Removed From RC');
    expect(text).toContain('stored()');
  });

  it('links onward to a surface that still exists', () => {
    const fixture = TestBed.createComponent(StoredVersioningDemoComponent);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/marker-zoo');
  });
});
