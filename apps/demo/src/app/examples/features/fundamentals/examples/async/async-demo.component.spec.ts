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
    expect(host.textContent).toContain(
      'Incoming data, without a second store.'
    );
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

  it('applies a resolved response through the live one-shot preview', async () => {
    const component = fixture.componentInstance;
    expect(component.tree.$.results()).toEqual([]);
    const pending = component.loadUsers();
    expect(component.loading()).toBe(true);
    await pending;
    fixture.detectChanges();
    expect(component.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Ada, Lin');
  });

  it('retrieves, sends, and receives preferences through the live Link', async () => {
    const component = fixture.componentInstance;
    expect(component.tree.$.preferences.density()).toBe('compact');
    await component.retrievePreferences();
    expect(component.tree.$.preferences.density()).toBe('comfortable');
    await component.changeDensity();
    expect(component.endpointDensity()).toBe('compact');
    component.receivePreferences();
    expect(component.tree.$.preferences.density()).toBe('comfortable');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-local-density]').textContent
    ).toBe('comfortable');
    expect(
      fixture.nativeElement.querySelector('[data-endpoint-density]').textContent
    ).toBe('comfortable');
  });

  it('does not apply an in-flight response after the page is destroyed', async () => {
    const pending = fixture.componentInstance.loadUsers();
    fixture.destroy();
    await expect(pending).resolves.toBeUndefined();
  });

  it('keeps overlapping demo commands from replacing a pending retrieval', async () => {
    const component = fixture.componentInstance;
    const retrieval = component.retrievePreferences();
    fixture.detectChanges();
    expect(component.preferencesPending()).toBe(true);
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    );
    const receive = buttons.find((button) =>
      button.textContent?.includes('Receive endpoint update')
    );
    expect(receive?.disabled).toBe(true);
    const ignoredEdit = component.changeDensity();
    component.receivePreferences();
    await Promise.all([retrieval, ignoredEdit]);
    expect(component.tree.$.preferences.density()).toBe('comfortable');
    expect(component.endpointDensity()).toBe('comfortable');
    expect(component.activity()).toBe(
      'Retrieved the simulated endpoint value.'
    );
    expect(component.preferencesPending()).toBe(false);
    await component.changeDensity();
    expect(component.endpointDensity()).toBe('compact');
  });

  it('sends a local edit after retrieval in a separate browser event turn', async () => {
    const button = (label: string): HTMLButtonElement => {
      const match = Array.from(
        (
          fixture.nativeElement as HTMLElement
        ).querySelectorAll<HTMLButtonElement>('button')
      ).find((candidate) => candidate.textContent?.includes(label));
      if (!match) throw new Error(`Missing button: ${label}`);
      return match;
    };
    const nextTurn = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 10));
    await nextTurn();
    button('Retrieve preferences').click();
    await fixture.whenStable();
    await nextTurn();
    fixture.detectChanges();
    expect(fixture.componentInstance.tree.$.preferences.density()).toBe(
      'comfortable'
    );
    button('Toggle locally').click();
    await fixture.whenStable();
    await nextTurn();
    fixture.detectChanges();
    expect(fixture.componentInstance.tree.$.preferences.density()).toBe(
      'compact'
    );
    expect(fixture.componentInstance.endpointDensity()).toBe('compact');
    expect(fixture.componentInstance.activity()).toBe(
      'Local edit acknowledged by the simulated endpoint.'
    );
  });

  it('sends linked nested leaf edits with production diagnostics disabled', async () => {
    const runtime = globalThis as unknown as { ngDevMode: unknown };
    const previous = runtime.ngDevMode;
    runtime.ngDevMode = false;
    const productionFixture = TestBed.createComponent(AsyncDemoComponent);
    try {
      const component = productionFixture.componentInstance;
      productionFixture.detectChanges();
      await component.retrievePreferences();
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      await component.changeDensity();
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      expect(component.tree.$.preferences.density()).toBe('compact');
      expect(component.endpointDensity()).toBe('compact');
    } finally {
      productionFixture.destroy();
      runtime.ngDevMode = previous;
    }
  });
});
