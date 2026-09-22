import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { NavigationComponent } from './navigation.component';

describe('NavigationComponent', () => {
  it('publishes one consolidated current-route hierarchy', () => {
    const component = new NavigationComponent();

    expect(component.sections.map((section) => section.id)).toEqual([
      'learn',
      'core',
      'frameworks',
      'advanced',
      'archive',
    ]);
    expect(
      component.sections.map((section) =>
        section.items.map((item) => item.route)
      )
    ).toEqual([
      [
        '/start',
        '/why-causality',
        '/architecture-overview',
        '/examples/fundamentals',
        '/migrate',
      ],
      [
        '/examples/fundamentals',
        '/batching',
        '/entities',
        '/restoration',
        '/external-truth',
      ],
      ['/frameworks', '/docs', '/docs', '/docs', '/docs', '/docs'],
      ['/benchmarks', '/devtools', '/deep-typing', '/architecture-overview'],
      ['/legacy-changelog', '/realistic-benchmark-history'],
    ]);

    const links = component.sections.flatMap((section) => section.items);
    expect(
      component.sections
        .find((section) => section.id === 'frameworks')
        ?.items.map((item) => item.queryParams?.['package'])
    ).toEqual([undefined, 'angular', 'react', 'vue', 'solid', 'kernel']);
    expect(links.find((item) => item.id === 'state-derived')?.fragment).toBe(
      'signals-basics'
    );
    expect(links.some((item) => item.route === '/markers')).toBe(false);
  });

  it('opens, closes, and toggles the mobile drawer', () => {
    const component = new NavigationComponent();

    expect(component.mobileMenuOpen()).toBe(false);
    component.openMobileMenu();
    expect(component.mobileMenuOpen()).toBe(true);
    component.toggleMobileMenu();
    expect(component.mobileMenuOpen()).toBe(false);
    component.openMobileMenu();
    component.closeMobileMenu();
    expect(component.mobileMenuOpen()).toBe(false);
  });
});

describe('NavigationComponent disclosure groups', () => {
  it('starts with one group open and reveals each active destination', async () => {
    await TestBed.configureTestingModule({
      imports: [NavigationComponent],
      providers: [
        provideRouter([
          { path: 'entities', component: NavigationComponent },
          { path: 'docs', component: NavigationComponent },
          { path: 'benchmarks', component: NavigationComponent },
          { path: 'legacy-changelog', component: NavigationComponent },
        ]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NavigationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const advanced = element.querySelector<HTMLDetailsElement>(
      'details[aria-labelledby="advanced-label"]'
    );
    const archive = element.querySelector<HTMLDetailsElement>(
      'details[aria-labelledby="archive-label"]'
    );
    if (!advanced || !archive) throw new Error('Missing navigation groups');
    expect(advanced.open).toBe(false);
    expect(archive.open).toBe(false);
    expect(element.querySelector('a[href="/docs?package=vue"]')).not.toBeNull();
    expect(
      Array.from(element.querySelectorAll('details[open]')).map((group) =>
        group.getAttribute('aria-labelledby')
      )
    ).toEqual(['learn-label']);
    expect(element.querySelector('.navigation-link__description')).toBeNull();

    await TestBed.inject(Router).navigateByUrl('/entities');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      element.querySelector<HTMLDetailsElement>(
        'details[aria-labelledby="core-label"]'
      )?.open
    ).toBe(true);

    await TestBed.inject(Router).navigateByUrl('/docs?package=vue');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      element.querySelector<HTMLDetailsElement>(
        'details[aria-labelledby="frameworks-label"]'
      )?.open
    ).toBe(true);

    await TestBed.inject(Router).navigateByUrl('/benchmarks');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(advanced.open).toBe(true);
    expect(archive.open).toBe(false);

    await TestBed.inject(Router).navigateByUrl('/legacy-changelog');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(archive.open).toBe(true);
  });
});
