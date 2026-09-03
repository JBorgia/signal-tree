import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AsyncDemoComponent } from './async-demo.component';

describe('AsyncDemoComponent', () => {
  let fixture: ComponentFixture<AsyncDemoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsyncDemoComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AsyncDemoComponent);
    fixture.detectChanges();
  });

  it('teaches one-shot external ingress and persistent Link separately', () => {
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('External truth & Link');
    expect(host.textContent).toContain('external()');
    expect(host.textContent).toContain('link()');
    expect(host.textContent).toContain('retrieve()');
    expect(host.textContent).toContain('settled()');
    expect(host.textContent).toContain('dispose()');
    expect(host.textContent).toContain('onTreeError');
    expect(host.textContent).toContain('operation, treeId, path');
    expect(host.textContent).toContain('stopReporting()');
    expect(host.textContent).toContain('switchMap');
    expect(host.textContent).toContain('application concerns');
    expect(host.textContent).not.toContain('loader()');
    expect(host.textContent).not.toContain('marker family');
  });

  it('does not render a self-referential pointer link', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        'a[routerLink="/external-truth"]'
      )
    ).toBeNull();
  });
});
