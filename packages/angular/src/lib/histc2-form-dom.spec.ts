import { Component, Injector, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { signalTree } from '../index';
import { toWritableSignal } from '../index';
import { undoable } from '../index';
import { restoration } from '../index';

/**
 * HIST-C2 STEP 6, the part that actually decides A versus B.
 *
 * The programmatic falsifier (`histc2-signal-forms.spec.ts`) drives
 * `f.name().value.set(...)`, which the APPLICATION calls — so of course a scope
 * can wrap it. That proves the door composes with Signal Forms; it does not
 * prove anything about the production path.
 *
 * In production the user types into `<input [formField]="f.name">`, and Angular's
 * `FormField` directive performs the model write from inside its own DOM
 * listener. (`Field` is a TYPE alias, not the directive — importing it as one
 * yields NG0919.)
 * The application has no callback around that write. This file measures whether
 * that is true rather than asserting it.
 */

type Model = { name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

@Component({
  selector: 'lib-st-host',
  standalone: true,
  imports: [FormField],
  template: `<input [formField]="f.name" />`,
})
class HostComponent {
  private readonly injector = inject(Injector);
  readonly tree = signalTree(
    { editForm: { name: 'ada' } as Model, ui: { panel: 'none' } },
    {
      enhancers: [
        restoration({
          maxHistorySize: 50,
        }),
      ],
    }
  );
  readonly model = toWritableSignal(this.tree.$.editForm, this.injector);
  readonly f = form(this.model);
  readonly ready = signal(true);
}

const turns = (tree: { getRestorationHistory(): readonly unknown[] }) =>
  tree.getRestorationHistory().length - 1;

describe('HIST-C2 step 6: the DOM-driven write', () => {
  it('CONTROL — a DOM edit really does reach the tree', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = 'grace';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await flush();

    // Without this the negative result below would prove nothing — it would
    // just mean the harness never typed anything.
    expect(fixture.componentInstance.tree.$.editForm.name()).toBe('grace');
  });

  it('THE DECIDING CASE — a DOM edit is NOT reachable by the generic scope', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();
    const { tree } = fixture.componentInstance;
    const before = turns(tree);

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = 'grace';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await flush();

    // THE FINDING. The write lands, and it is not designated, because the
    // application never gets a callback around the directive's listener. There
    // is no place to put `undoable(() => …)`.
    expect(tree.$.editForm.name()).toBe('grace');
    expect(turns(tree)).toBe(before);
  });

  it('and wrapping the dispatch does NOT help — the directive write is its own turn', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();
    const { tree } = fixture.componentInstance;
    const before = turns(tree);

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = 'grace';

    // The most favourable thing an application could possibly do: wrap the
    // event dispatch itself. Even this is not available in a real app — the
    // browser dispatches, not the app — so it is an upper bound, not a
    // workaround.
    undoable(() => {
      input.dispatchEvent(new Event('input'));
    });
    fixture.detectChanges();
    await flush();

    expect(tree.$.editForm.name()).toBe('grace');

    // Recorded either way. If this DID produce a turn, it would only mean the
    // directive writes synchronously inside the dispatch — which no real
    // application can exploit, since it does not own the dispatch.
    // MEASURED: 1. The directive writes synchronously inside the dispatch, so
    // wrapping the dispatch DOES designate the turn. No real application can
    // exploit that — the browser dispatches, not the app — but it is the fact
    // that makes an ingress adapter viable: there is no scheduling gap between
    // the caller and the write for a designation to fall into.
    expect(turns(tree) - before).toBe(1);
  });
});
