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
      ['/docs', '/docs', '/docs'],
      ['/benchmarks', '/devtools', '/deep-typing', '/architecture-overview'],
      ['/legacy-changelog', '/realistic-benchmark-history'],
    ]);

    const links = component.sections.flatMap((section) => section.items);
    expect(
      component.sections
        .find((section) => section.id === 'frameworks')
        ?.items.map((item) => item.queryParams?.['package'])
    ).toEqual(['angular', 'react', 'kernel']);
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
