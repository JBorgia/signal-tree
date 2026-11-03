import { ComponentFixture, TestBed } from '@angular/core/testing';

import { appRoutes } from '../../app.routes';
import { IndependentPublicationComponent } from './independent-publication.component';

describe('IndependentPublicationComponent (v16 preview)', () => {
  let fixture: ComponentFixture<IndependentPublicationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IndependentPublicationComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(IndependentPublicationComponent);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  function button(host: HTMLElement, action: string): HTMLButtonElement {
    const control = host.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    if (!control) throw new Error(`Missing ${action} button`);
    return control;
  }

  it.each(['confirm', 'reject'] as const)(
    'delivers the literal before %s and preserves it after the local decision',
    async (decision) => {
      const page = fixture.componentInstance;
      const host: HTMLElement = fixture.nativeElement;
      button(host, 'propose').click();
      fixture.detectChanges();
      expect(page.hasPending()).toBe(true);
      expect(
        host.querySelector('[data-testid="route"]')?.textContent?.trim()
      ).toBe('west');

      // If the note waits for route settlement this test times out: the proposal
      // is deliberately not confirmed/rejected until delivery has been asserted.
      await page.publishIndependentNote();
      fixture.detectChanges();
      expect(page.error()).toBeUndefined();
      expect(page.hasPending()).toBe(true);
      expect(page.decision()).toBe('Pending local review');
      expect(page.deliveredNotes()).toEqual(['dispatch-ready']);
      expect(page.admission()?.state).toBe('started');
      expect(
        host.querySelector('[data-testid="endpoint"]')?.textContent?.trim()
      ).toBe('dispatch-ready');

      await page.publishIndependentNote();
      expect(page.error()).toBeUndefined();
      expect(page.admission()?.state).toBe('no-write');
      expect(page.deliveredNotes()).toEqual(['dispatch-ready']);
      expect(page.hasPending()).toBe(true);

      button(host, decision).click();
      fixture.detectChanges();
      expect(page.hasPending()).toBe(false);
      expect(page.tree.$.route()).toBe(
        decision === 'confirm' ? 'west' : 'north'
      );
      expect(page.tree.$.note()).toBe('dispatch-ready');
      expect(page.deliveredNotes()).toEqual(['dispatch-ready']);
    }
  );

  it('handles a mocked settlement rejection in the UI without settling the proposal', async () => {
    const page = fixture.componentInstance;
    const host: HTMLElement = fixture.nativeElement;
    const sentinel = new Error('UI settlement rejection sentinel');
    // This injects a rejected result into the UI catch/finally path. It does not
    // prove that a real Link endpoint failure rejects settled() or stops delivery.
    const settlement = jest
      .spyOn(page.noteConnection, 'settled')
      .mockRejectedValueOnce(sentinel);
    try {
      page.proposeWest();
      await page.publishIndependentNote();
      fixture.detectChanges();
      expect(settlement).toHaveBeenCalledTimes(1);
      expect(page.error()).toBe(sentinel.message);
      expect(host.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
        `Note publication failed: ${sentinel.message}`
      );
      expect(page.publishing()).toBe(false);
      expect(page.hasPending()).toBe(true);
      expect(page.tree.$.route()).toBe('west');
      const reject = button(host, 'reject');
      expect(reject.disabled).toBe(false);
      expect(
        button(host, 'confirm').disabled
      ).toBe(false);
      reject.click();
      fixture.detectChanges();
      expect(page.hasPending()).toBe(false);
      expect(page.decision()).toBe('Rejected locally');
      expect(page.tree.$.route()).toBe('north');
    } finally {
      settlement.mockRestore();
    }
  });

  it('reports a real before-callback declaration error without writing the note', async () => {
    const page = fixture.componentInstance;
    page.proposeWest();
    page.noteConnection.dispose();
    await page.publishIndependentNote();
    fixture.detectChanges();
    expect(page.error()).toContain('(before-callback: disposed)');
    expect(page.tree.$.note()).toBe('');
    expect(page.deliveredNotes()).toEqual([]);
    expect(page.publishing()).toBe(false);
    expect(page.hasPending()).toBe(true);
    page.reject();
    expect(page.tree.$.route()).toBe('north');
  });

  it('disposes the Link before destroying the tree, including an in-flight action', async () => {
    const page = fixture.componentInstance;
    const disposal = jest.spyOn(page.noteConnection, 'dispose');
    const destruction = jest.spyOn(page.tree, 'destroy');
    page.proposeWest();
    const publication = page.publishIndependentNote();
    fixture.destroy();
    const deliveredAtDestroy = [...page.deliveredNotes()];
    const admissionAtDestroy = page.admission();
    await publication;
    expect(disposal).toHaveBeenCalledTimes(1);
    expect(destruction).toHaveBeenCalledTimes(1);
    expect(page.tree.destroyed()).toBe(true);
    expect(disposal.mock.invocationCallOrder[0]).toBeLessThan(
      destruction.mock.invocationCallOrder[0]
    );
    expect(page.deliveredNotes()).toEqual(deliveredAtDestroy);
    expect(page.admission()).toBe(admissionAtDestroy);
    expect(page.error()).toBeUndefined();
    // Late UI invocations must neither publish nor create another transaction.
    page.proposeWest();
    await page.publishIndependentNote();
    expect(page.deliveredNotes()).toEqual(deliveredAtDestroy);
    page.ngOnDestroy();
    expect(disposal).toHaveBeenCalledTimes(1);
    expect(destruction).toHaveBeenCalledTimes(1);
  });

  it('labels the preview and separates receipt status from endpoint delivery', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent?.replace(
      /\s+/g,
      ' '
    );
    expect(text).toContain('v16 development preview · Unreleased');
    expect(text).toContain('not stable v15 guidance');
    expect(text).toContain('Admission snapshot');
    expect(text).toContain('In-memory endpoint');
    expect(text).toContain('cached computation');
    expect(text).toContain('do not prove backend durability');
    expect(fixture.componentInstance.example).toContain(
      "from '@signal-tree/angular'"
    );
    const route = appRoutes.find(
      (entry) => entry.path === 'independent-publication'
    );
    expect(route?.loadComponent).toBeDefined();
    expect(route?.component).toBeUndefined();
  });
});
