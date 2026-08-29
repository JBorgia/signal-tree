import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { computed, isSignal, untracked, type WritableSignal } from '@angular/core';
import { signalTree } from './signal-tree';

/**
 * S1 through the SCALAR LEAF REALIZATION.
 *
 * SCALAR-REALIZATION-SEAM-0 replaced the machinery that originally earned S1:
 * the leaf is now built by `ScalarLeafRealization.createLeaf`, with kernel
 * orchestration installing `set`/`update` over it. These rows prove the swap
 * preserved native identity rather than trusting the full suite.
 */
const causal = () => signalTree({ a: 1, b: 2 }, { capabilities: ['causal-runtime'] });

describe('S1 — scalar leaves under the Angular realization', () => {
  it('the leaf IS a native Angular signal, not a wrapper around one', () => {
    TestBed.configureTestingModule({});
    const leaf = causal().$.a;
    expect(isSignal(leaf)).toBe(true);
    expect(typeof (leaf as unknown as WritableSignal<number>).set).toBe('function');
  });

  it('one cell per leaf — repeated access returns the SAME object', () => {
    TestBed.configureTestingModule({});
    const tree = causal();
    expect(tree.$.a).toBe(tree.$.a);
    expect(tree.$.a).not.toBe(tree.$.b);
  });

  it('reading allocates no per-read wrapper', () => {
    TestBed.configureTestingModule({});
    const tree = causal();
    const first = tree.$.a;
    untracked(() => tree.$.a());
    untracked(() => tree.$.a());
    expect(tree.$.a).toBe(first);
  });

  it('the leaf participates in the ANGULAR graph directly', () => {
    TestBed.configureTestingModule({});
    const tree = causal();
    let runs = 0;
    const doubled = computed(() => {
      runs++;
      return tree.$.a() * 2;
    });
    expect(untracked(() => doubled())).toBe(2);
    const before = runs;
    tree.$.a.set(5);
    // a native dependency edge: the computed re-runs off kernel truth
    expect(untracked(() => doubled())).toBe(10);
    expect(runs).toBeGreaterThan(before);
  });

  it('the merge write path reaches the same single cell', () => {
    TestBed.configureTestingModule({});
    const tree = causal();
    const leaf = tree.$.a;
    tree({ a: 9 });
    expect(untracked(() => leaf())).toBe(9);
    expect(tree.$.a).toBe(leaf);
  });
});
