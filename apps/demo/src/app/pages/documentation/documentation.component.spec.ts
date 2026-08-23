import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DocumentationComponent } from './documentation.component';

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

  it('creates and defaults to the first package (core)', () => {
    expect(component).toBeTruthy();
    expect(component.selectedPackage().id).toBe('core');
  });

  it('renders one sidebar button per entry in packages, and one quick-link per entry in quickLinks', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.package-button');
    expect(buttons.length).toBe(component.packages.length);

    const links = fixture.nativeElement.querySelectorAll('.doc-quick-link');
    expect(links.length).toBe(component.quickLinks.length);
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
});
