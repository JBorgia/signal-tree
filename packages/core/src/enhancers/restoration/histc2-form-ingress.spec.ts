import { Component, Injector, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { toWritableSignal } from '../../lib/utils';
import { timeTravel } from './restoration';

/**
 * HIST-C2 STEP 6, outcome FORM-C2-B — the earned mutation-ingress adapter.
 *
 * `histc2-form-dom.spec.ts` established that a real user edit reaches the tree
 * through Angular's `FormField` directive, inside its own DOM listener, with no
 * application callback around it. The generic designation scope cannot reach
 * it, so the adapter at the composition seam is earned.
 *
 * The claim being tested is narrow and has to stay narrow:
 *
 *   writes ENTERING through this adapter  -> designate their causal turn
 *   other writes to the SAME state        -> remain ordinary
 *
 * The second line is what makes this ingress designation rather than HIST-B
 * location scoping, and it gets its own control.
 */

type Model = { name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const makeTree = () =>
  signalTree(
    { editForm: { name: 'ada' } as Model, ui: { panel: 'none' } },
    {
      enhancers: [
        timeTravel({
          maxHistorySize: 50,
        }),
      ],
    }
  );

@Component({
  selector: 'lib-st-ingress-host',
  standalone: true,
  imports: [FormField],
  template: `<input [formField]="f.name" />`,
})
class HostComponent {
  private readonly injector = inject(Injector);
  readonly tree = makeTree();
  readonly model = toWritableSignal(this.tree.$.editForm, this.injector, {
    undoable: true,
  });
  readonly f = form(this.model);
}

const turns = (tree: { getHistory(): readonly unknown[] }) =>
  tree.getHistory().length - 1;

const typeInto = (fixture: { nativeElement: HTMLElement }, value: string) => {
  const input = fixture.nativeElement.querySelector(
    'input'
  ) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
};

describe('HIST-C2 step 6: the earned mutation-ingress adapter', () => {
  it('a real DOM edit through the adapter DOES produce one reversible turn', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();
    const { tree, f } = fixture.componentInstance;
    const before = turns(tree);

    typeInto(fixture, 'grace');
    fixture.detectChanges();
    await flush();

    // The whole point of B: no application callback existed, and the edit is
    // reversible anyway.
    expect(tree.$.editForm.name()).toBe('grace');
    expect(turns(tree)).toBe(before + 1);

    tree.undo();
    await flush();
    TestBed.flushEffects();
    await flush();

    expect(tree.$.editForm.name()).toBe('ada');
    expect(f.name().value()).toBe('ada');
  });

  it('THE CONTROL — the same branch written through an ordinary tree handle stays non-reversible', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();
    const { tree } = fixture.componentInstance;
    const before = turns(tree);

    // Same state, same branch, different entrance.
    tree.$.editForm.name.set('written-directly');
    await flush();

    // If this recorded a turn, the adapter would be location scoping wearing a
    // different hat, and HIST-0 case 4 would apply to it.
    expect(tree.$.editForm.name()).toBe('written-directly');
    expect(turns(tree)).toBe(before);
  });

  it('MIXED TURN does NOT arise on the DOM path — the event boundary closes the turn', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();
    const { tree } = fixture.componentInstance;

    typeInto(fixture, 'grace');
    // MEASURED, and it changes the answer: the turn is already recorded HERE,
    // synchronously inside the DOM dispatch, because zone.js flushes at the
    // event boundary. The form edit has closed its own turn before any later
    // application write can join it.
    expect(turns(tree)).toBe(1);

    tree.$.ui.panel.set('inspector');
    fixture.detectChanges();
    await flush();

    // Undesignated and in a turn of its own, so it records nothing.
    expect(turns(tree)).toBe(1);

    tree.undo();
    await flush();

    // THE FINDING. Undo reverses the form edit and leaves the screen state
    // alone — not because anything filtered it, but because they were never
    // one causal turn. The mixed-turn consequence is REAL (proved
    // programmatically in histc2-signal-forms.spec.ts) but does not arise for
    // template-driven editing, where the DOM event boundary makes each edit its
    // own operation. That is the ergonomics answer the step-6 worry was after.
    expect(tree.$.editForm.name()).toBe('ada');
    expect(tree.$.ui.panel()).toBe('inspector');
  });

  it('and an adapter WITHOUT the option leaves the same edit non-reversible', async () => {
    @Component({
      selector: 'lib-st-plain-host',
      standalone: true,
      imports: [FormField],
      template: `<input [formField]="f.name" />`,
    })
    class PlainHost {
      private readonly injector = inject(Injector);
      readonly tree = makeTree();
      readonly model = toWritableSignal(this.tree.$.editForm, this.injector);
      readonly f = form(this.model);
    }

    const fixture = TestBed.createComponent(PlainHost);
    fixture.detectChanges();
    await flush();
    const { tree } = fixture.componentInstance;
    const before = turns(tree);

    const input = fixture.nativeElement.querySelector(
      'input'
    ) as HTMLInputElement;
    input.value = 'grace';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await flush();

    // The option is doing the work — not the fact that a form is bound.
    expect(tree.$.editForm.name()).toBe('grace');
    expect(turns(tree)).toBe(before);
  });
});
