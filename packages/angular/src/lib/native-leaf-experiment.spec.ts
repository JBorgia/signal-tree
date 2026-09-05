import {
  Component,
  isSignal,
  provideZonelessChangeDetection,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  batching,
  SignalTreeRollbackError,
  signalTree,
  transactions,
} from '../index';

const native = <T>(value: unknown): WritableSignal<T> =>
  value as WritableSignal<T>;

describe('native Angular leaf realization', () => {
  it('keeps kernel truth and Angular derived state coherent', () => {
    const tree = signalTree(
      { count: 1 },
      { derived: ($) => ({ doubled: () => $.count() * 2 }) }
    );
    const count = native<number>(tree.$.count);

    expect(isSignal(count)).toBe(true);
    expect(isSignal(tree.$.doubled)).toBe(true);
    expect(tree.$.doubled()).toBe(2);
    count.set(3);
    expect(tree.$()).toEqual({ count: 3 });
    expect(tree.$.doubled()).toBe(6);
    tree.destroy();
  });

  it('preserves replacement and derivation intent', async () => {
    const tree = signalTree({ count: 0 }, { enhancers: [transactions()] });
    const count = native<number>(tree.$.count);
    const pending = tree.transaction(() => count.set(1));

    count.update((value) => value + 1);
    await Promise.resolve();
    await Promise.resolve();

    expect(() => pending.rollback()).toThrow(SignalTreeRollbackError);
    expect(count()).toBe(2);
    tree.destroy();
  });

  it('routes native methods through construction-time write interceptors', () => {
    const tree = signalTree({ count: 0 }, { enhancers: [batching()] });

    tree.coalesce(() => {
      tree.$.count.set(1);
      tree.$.count.set(2);
      expect(tree.$.count()).toBe(0);
    });

    expect(tree.$.count()).toBe(2);
    tree.destroy();
  });

  it('invalidates a zoneless rendered consumer', async () => {
    @Component({ standalone: true, template: `{{ tree.$.count() }}` })
    class Host {
      readonly tree = signalTree({ count: 0 });
    }

    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe('0');

    native<number>(fixture.componentInstance.tree.$.count).set(1);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent.trim()).toBe('1');
    fixture.destroy();
  });
});
