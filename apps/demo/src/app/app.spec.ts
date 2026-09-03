import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AppComponent } from './app';
import { appRoutes } from './app.routes';
import { NavigationComponent } from './components/navigation/navigation.component';

// Simple home component for testing routing
@Component({
  selector: 'app-test-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div>Test Home</div>',
})
class TestHomeComponent {}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        NavigationComponent,
        RouterModule.forRoot([
          { path: '', component: TestHomeComponent },
          { path: '**', redirectTo: '' },
        ]),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render navigation', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation')).toBeTruthy();
  });

  it('should have router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('uses the current ST mark throughout the shared shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const marks = fixture.nativeElement.querySelectorAll(
      '[data-brand-mark]'
    ) as NodeListOf<HTMLImageElement>;

    expect(marks).toHaveLength(3);
    for (const mark of marks) {
      expect(mark.getAttribute('src')).toBe('/signaltree-mark.png');
      expect(mark.getAttribute('alt')).toBe('');
    }
  });

  it('makes the current start and architecture routes directly navigable', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const hrefs = Array.from(
      fixture.nativeElement.querySelectorAll('.nav-item') as NodeListOf<HTMLAnchorElement>
    ).map((link) => link.getAttribute('href'));

    expect(hrefs).toContain('/start');
    expect(hrefs).toContain('/architecture-overview');
  });

  it('does not publish superseded architecture or benchmark claims in route metadata', () => {
    const descriptions = appRoutes
      .map((route) => route.data?.['description'])
      .filter((description): description is string =>
        typeof description === 'string'
      )
      .join(' ');

    expect(descriptions).not.toContain('Single-package');
    expect(descriptions).not.toContain('76%');
    expect(descriptions).not.toContain('469x');
    expect(descriptions).not.toContain('49% cold');
  });

  it('keeps removed pre-v15 concepts out of the live component surface', () => {
    const routes = new Map(appRoutes.map((route) => [route.path, route]));
    const expectedRedirects = new Map([
      ['does-it-fit', 'architecture-overview'],
      ['stored-versioning', 'docs'],
      ['async', 'external-truth'],
      ['rxmethod', 'external-truth'],
      ['batching/compare', 'batching'],
      ['entity-collection', 'entities'],
      ['benchmark', 'legacy-changelog'],
      ['benchmarks', 'architecture-overview'],
      ['extreme-depth', 'deep-typing'],
      ['whats-new-14', 'legacy-changelog'],
      ['marker-zoo', 'markers'],
      ['linked-derived', 'examples/fundamentals'],
      ['serialization', 'docs'],
    ]);

    for (const [path, redirectTo] of expectedRedirects) {
      expect(routes.get(path)?.redirectTo).toBe(redirectTo);
      expect(routes.get(path)?.loadComponent).toBeUndefined();
    }

    expect(routes.get('external-truth')?.loadComponent).toBeDefined();
  });

});
