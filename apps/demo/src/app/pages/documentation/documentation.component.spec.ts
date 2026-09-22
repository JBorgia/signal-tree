import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DocumentationComponent } from './documentation.component';

/**
 * Looks a package up by id and fails with the id if it is gone. These tests
 * were twice broken by a package being deleted out from under a hard-coded
 * id, so the failure should name what went missing rather than throw on
 * `undefined` three lines later.
 */
function packageById(
  packages: readonly { id: string; readmePath: string }[],
  id: string
) {
  const found = packages.find((entry) => entry.id === id);
  if (!found) throw new Error(`no documentation package with id "${id}"`);
  return found;
}

/**
 * This page is a thin shell over package READMEs fetched at runtime via
 * HttpClient + marked — the actual documentation content lives in markdown
 * files, not in this component. Per review guidance, kept thin: a render
 * check, the package-selection interaction (pure signal logic, doesn't need
 * the HTTP response to have resolved), and the dead-link check for
 * quickLinks (covered by the shared route-links.spec.ts). HttpClientTesting
 * is provided so ngOnInit's real `HttpClient.get()` call is deterministic —
 * without it, the component would throw (no HttpClient provider) or, if a
 * real HttpClient were provided instead, attempt an actual fetch.
 */
describe('DocumentationComponent', () => {
  let component: DocumentationComponent;
  let fixture: ComponentFixture<DocumentationComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentationComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentationComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Drain whatever README fetch(es) the test triggered so no pending
    // request leaks into the next test.
    httpMock.match(() => true).forEach((req) => req.flush('# Stub\n'));
    httpMock.verify();
  });

  it('creates and defaults to the first package (kernel)', () => {
    expect(component).toBeTruthy();
    expect(component.selectedPackage().id).toBe('kernel');
  });

  it('renders one in-flow document switcher without a second page aside', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.package-button');
    expect(buttons.length).toBe(component.packages.length);

    const links = fixture.nativeElement.querySelectorAll('.doc-quick-link');
    expect(links.length).toBe(component.quickLinks.length);
    expect(fixture.nativeElement.querySelector('aside')).toBeNull();
    expect(fixture.nativeElement.querySelector('.package-list')).toBeTruthy();
  });

  it('indexes current v15 docs and current demo routes only', () => {
    const descriptions = component.packages
      .map((pkg) => pkg.description)
      .join(' ');

    expect(descriptions).not.toContain('stored()');
    expect(descriptions).not.toContain('lifecycle integration');
    expect(component.quickLinks.map((link) => link.route)).toEqual([
      '/architecture-overview',
      '/examples/fundamentals',
      '/migrate',
      '/restoration',
    ]);
  });

  it('renders wrapped Markdown prose without forced line breaks', async () => {
    const request = httpMock.expectOne('assets/docs/core/README.md');
    request.flush(
      'A sentence wrapped in source\ncontinues as normal prose.\n\nA new paragraph.'
    );
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(component.markdownContent()).not.toContain('<br>');
    const content: HTMLElement =
      fixture.nativeElement.querySelector('.markdown-content');
    expect(content.querySelector('br')).toBeNull();
    expect(content.querySelectorAll('p')).toHaveLength(2);
    expect(
      content.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim()
    ).toContain('A sentence wrapped in source continues as normal prose.');
  });

  it('selectPackage() updates selectedPackage() and re-issues the README fetch', () => {
    // Package-agnostic on purpose. This named `events` and broke when that
    // package was deleted, exactly as an earlier version named `ng-forms` and
    // broke when THAT was deleted. The test is about the
    // selection-to-fetch wiring, not about which packages exist.
    const target = component.packages[component.packages.length - 1];
    expect(target).toBeDefined();

    component.selectPackage(target);

    expect(component.selectedPackage().id).toBe(target.id);

    // `match`, not `expectOne`. With a single package in the list the
    // constructor's initial load has already fetched this README, so selecting
    // it issues a SECOND request and `expectOne` fails on the count. Matching
    // and draining asserts the same wiring without assuming how many packages
    // ship — which is the assumption that broke this test twice.
    const requests = httpMock.match(target.readmePath);
    expect(requests.length).toBeGreaterThanOrEqual(1);
    requests.forEach((request) => request.flush('# Docs\n'));
  });

  it('clicking a package button in the DOM drives the same selection', () => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.package-button')
    );
    // Drive the LAST package rather than a named one: this test is about the
    // button-to-selection wiring, and hard-coding a package id made it a
    // hostage of the package list (it broke when ng-forms was deleted).
    const index = component.packages.length - 1;
    const target = component.packages[index];
    buttons[index].click();
    fixture.detectChanges();

    expect(component.selectedPackage().id).toBe(target.id);
    expect(buttons[index].classList.contains('active')).toBe(true);
  });
  it.each(['kernel', 'angular', 'react', 'vue'])(
    'resolves %s documentation links from the source document and keeps anchors in the docs route',
    async (id) => {
      httpMock.expectOne('assets/docs/core/README.md').flush('# Initial');
      await fixture.whenStable();
      const target = packageById(component.packages, id);
      component.selectPackage(target);
      httpMock.expectOne(target.readmePath).flush(`
## Ownership
[Same section](#ownership)
[Same document](README.md#ownership)
[Manifest](llms.txt)
[Package metadata](../angular/package.json)
[License](../../LICENSE)
[React guide](../react/README.md#ownership)
[External](https://example.com/guide?q=1#setup)
[Email](mailto:help@example.com)
[Demo](/entities)
![Diagram](./diagram.svg)
## Ownership
`);
      await fixture.whenStable();
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const href = (label: string) =>
        Array.from(root.querySelectorAll('.markdown-content a'))
          .find((element) => element.textContent === label)
          ?.getAttribute('href');
      expect(href('Same section')).toBe(`/docs?package=${id}#ownership`);
      expect(href('Same document')).toBe(`/docs?package=${id}#ownership`);
      expect(href('Manifest')).toBe('/llms.txt');
      expect(href('Package metadata')).toBe(
        'https://github.com/JBorgia/signal-tree/blob/main/packages/angular/package.json'
      );
      expect(href('License')).toBe(
        'https://github.com/JBorgia/signal-tree/blob/main/LICENSE'
      );
      expect(href('React guide')).toBe('/docs?package=react#ownership');
      expect(href('External')).toBe('https://example.com/guide?q=1#setup');
      expect(href('Email')).toBe('mailto:help@example.com');
      expect(href('Demo')).toBe('/entities');
      expect(root.querySelector('#ownership')?.textContent).toBe('Ownership');
      expect(root.querySelector('#ownership-1')?.textContent).toBe('Ownership');
      expect(
        root.querySelector('.markdown-content img')?.getAttribute('src')
      ).toBe(
        `https://raw.githubusercontent.com/JBorgia/signal-tree/main/packages/${id}/diagram.svg`
      );
    }
  );

  it('resolves guide links from docs/guides rather than from a package or served asset path', async () => {
    httpMock.expectOne('assets/docs/core/README.md').flush('# Initial');
    await fixture.whenStable();
    const target = packageById(component.packages, 'composition-recipes');
    component.selectPackage(target);
    httpMock
      .expectOne(target.readmePath)
      .flush(
        '[Architecture](../architecture/signaltree-architecture-guide.md)'
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector('.markdown-content a')
        ?.getAttribute('href')
    ).toBe(
      'https://github.com/JBorgia/signal-tree/blob/main/docs/architecture/signaltree-architecture-guide.md'
    );
  });

  it('anchors rendered headings while still sanitizing dangerous markup', async () => {
    // Both halves matter and they pull against each other. Heading anchors
    // only reach the DOM because they are applied AFTER sanitization, so this
    // test also has to prove that moving them there did not buy working deep
    // links by trusting the markdown: the script, the inline handler and the
    // javascript: URL below must all still be neutralized.
    const hostile = globalThis as unknown as { __pwned?: boolean };
    delete hostile.__pwned;

    httpMock
      .expectOne('assets/docs/core/README.md')
      .flush(
        [
          '## Ownership',
          '',
          '<script>globalThis.__pwned = true;</script>',
          '<img src="x" onerror="globalThis.__pwned = true">',
          '<a href="javascript:globalThis.__pwned = true">bad link</a>',
          '',
          '## Ownership',
          '',
          '## Ownership & Scope!',
          '',
        ].join('\n')
      );
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    // Anchors exist on the RENDERED headings, de-duplicated in document order.
    expect(root.querySelector('#ownership')?.textContent).toBe('Ownership');
    expect(root.querySelector('#ownership-1')?.textContent).toBe('Ownership');
    expect(root.querySelector('#ownership--scope')?.textContent).toBe(
      'Ownership & Scope!'
    );

    // Sanitization is untouched.
    expect(root.querySelector('.markdown-content script')).toBeNull();
    expect(
      root.querySelector('.markdown-content img')?.hasAttribute('onerror')
    ).not.toBe(true);
    const link = Array.from(root.querySelectorAll('.markdown-content a')).find(
      (element) => element.textContent === 'bad link'
    );
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
    expect(hostile.__pwned).toBeUndefined();
  });

  it('does not replace the selected package with an older response', async () => {
    const initial = httpMock.expectOne('assets/docs/core/README.md');
    const vue = packageById(component.packages, 'vue');
    component.selectPackage(vue);
    httpMock.expectOne(vue.readmePath).flush('# Vue setup');
    await fixture.whenStable();
    initial.flush('# Kernel setup');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.selectedPackage().id).toBe('vue');
    expect(
      fixture.nativeElement.querySelector('.markdown-content h1')?.textContent
    ).toBe('Vue setup');
    expect(component.loading()).toBe(false);
  });
});
