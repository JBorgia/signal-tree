import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { toWritableSignal } from '../../lib/utils';
import { undoable } from '../../lib/undoable';
import { timeTravel } from './restoration';

/**
 * HIST-C2 STEP 6 — the production ergonomics falsifier.
 *
 * Not a test of HIST-C, which is settled. The question is only:
 *
 * > does the GENERIC operation door reach the write that Angular Signal Forms
 * > actually performs on a SignalTree branch?
 *
 * Binary disposition:
 *
 *   FORM-C2-A  the generic scope reaches it  -> no form-specific API earned
 *   FORM-C2-B  the framework owns/schedules the write outside a practical
 *              designation boundary -> the smallest mutation-ingress adapter is
 *              earned
 *
 * A third outcome — "mark this form branch historical" — is NOT admissible.
 * Location-scoped eligibility is already refuted (HIST-0 case 4) and shown
 * defective in shipped form (recordHistory:false).
 *
 * The composition seam is `toWritableSignal()`, the precedent established by the
 * forms case study: Angular owns the form abstraction, SignalTree owns the
 * state, and the seam is an ordinary writable signal.
 */

type Model = { name: string; email: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const designatedTree = () =>
  signalTree(
    {
      editForm: { name: 'ada', email: 'ada@example.com' } as Model,
      ui: { panel: 'none' },
    },
    {
      enhancers: [
        timeTravel({
          maxHistorySize: 50,
        }),
      ],
    }
  );

/** History length excluding the INIT baseline. */
const turns = (tree: { getHistory(): readonly unknown[] }) =>
  tree.getHistory().length - 1;

describe('HIST-C2 step 6: Angular Signal Forms over an ordinary branch', () => {
  it('C1 CONTROL — Signal Forms binds to a SignalTree branch at all', () => {
    const tree = designatedTree();
    const injector = TestBed.inject(Injector);

    const model = toWritableSignal(tree.$.editForm, injector);
    const f = runInInjectionContext(injector, () => form(model));

    // Without this the rest of the file proves nothing about Signal Forms.
    expect(f.name().value()).toBe('ada');
    expect(f.email().value()).toBe('ada@example.com');
  });

  it('C2 CONTROL — a field write reaches the tree, and is SYNCHRONOUS', () => {
    const tree = designatedTree();
    const injector = TestBed.inject(Injector);
    const model = toWritableSignal(tree.$.editForm, injector);
    const f = runInInjectionContext(injector, () => form(model));

    f.name().value.set('grace');

    // Read the tree immediately, with no await. If this were deferred, the
    // synchronous designation contract could never hold and the answer would be
    // FORM-C2-B on scheduling grounds alone.
    expect(tree.$.editForm.name()).toBe('grace');
  });

  it('THE FALSIFIER — a field write inside the generic scope produces ONE reversible turn', async () => {
    const tree = designatedTree();
    const injector = TestBed.inject(Injector);
    const model = toWritableSignal(tree.$.editForm, injector);
    const f = runInInjectionContext(injector, () => form(model));
    await flush();

    undoable(() => {
      f.name().value.set('grace');
    });
    await flush();

    expect(turns(tree)).toBe(1);
    expect(tree.$.editForm.name()).toBe('grace');

    tree.undo();
    await flush();
    // The tree->model direction is an Angular `effect`, so the form side needs
    // the effect scheduler run before it can be read. Omitting this produced a
    // false 'Signal Forms does not observe restoration' reading.
    TestBed.flushEffects();
    await flush();

    expect(tree.$.editForm.name()).toBe('ada');
    // And the form sees the restored value — one authority, no sync loop.
    expect(f.name().value()).toBe('ada');
  });

  it('and an UNDESIGNATED field write to the same model stays non-reversible', async () => {
    const tree = designatedTree();
    const injector = TestBed.inject(Injector);
    const model = toWritableSignal(tree.$.editForm, injector);
    const f = runInInjectionContext(injector, () => form(model));
    await flush();

    f.name().value.set('grace');
    await flush();

    // The control that separates operation designation from location scoping:
    // the SAME model, the SAME field, undesignated, records nothing.
    expect(turns(tree)).toBe(0);
    expect(tree.$.editForm.name()).toBe('grace');
  });

  it('MIXED TURN — one designated form write promotes the whole causal turn', async () => {
    const tree = designatedTree();
    const injector = TestBed.inject(Injector);
    const model = toWritableSignal(tree.$.editForm, injector);
    const f = runInInjectionContext(injector, () => form(model));
    await flush();

    // Same tick: a form edit and an ordinary screen-state mutation.
    undoable(() => {
      f.name().value.set('grace');
    });
    tree.$.ui.panel.set('inspector');
    await flush();

    expect(turns(tree)).toBe(1);

    tree.undo();
    await flush();

    // EXPOSED, NOT SPECIAL-CASED. This is the HIST-C contract: the UI half
    // belongs to the same causal turn, so it reverses with it. If that reads
    // wrong in a real form UX, the answer is not to filter the UI half — that
    // is HIST-B — it is that the application needs an explicit operation
    // boundary, and case 5 showed we have not earned that machinery.
    expect(tree.$.editForm.name()).toBe('ada');
    expect(tree.$.ui.panel()).toBe('none');
  });

  it('SAME-LOCATION CONTROL — an ordinary tree handle write to the form branch is non-reversible', async () => {
    const tree = designatedTree();
    const injector = TestBed.inject(Injector);
    const model = toWritableSignal(tree.$.editForm, injector);
    runInInjectionContext(injector, () => form(model));
    await flush();

    tree.$.editForm.name.set('written-directly');
    await flush();

    // Eligibility follows the OPERATION, never the branch. A form-bound branch
    // is not "the historical branch".
    expect(turns(tree)).toBe(0);
    expect(tree.$.editForm.name()).toBe('written-directly');
  });
});
