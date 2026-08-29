import { computed, isSignal, untracked } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';

/**
 * C6 — the DETERMINISTIC half of the framework-neutrality performance
 * requirement.
 *
 *     FRAMEWORK NEUTRALITY MUST NOT REQUIRE DUPLICATE CANONICAL CELLS,
 *     PER-OPERATION FRAMEWORK DISPATCH, OR MULTI-FRAMEWORK CODE IN A SINGLE
 *     VERTICAL'S HOT PATH.
 *
 * ⚠️ THESE ARE NOT TIMINGS. Wall-clock belongs in `bench-c6-baseline.mjs`,
 * which records rather than gates, because this repository deliberately refuses
 * flaky timing assertions. The facts below do not move with the machine: either
 * an ordinary leaf IS the framework's own cell or it is a wrapper around one,
 * and that is decidable.
 *
 * They are written to survive C6 unchanged. A neutrality change that introduces
 * a wrapper cell, a second reactive graph, or a dispatch layer breaks them —
 * which is the entire point.
 */
describe('C6 neutrality invariants — the Angular vertical stays native', () => {
  it('an ordinary leaf IS the framework cell, not a wrapper around one', () => {
    TestBed.configureTestingModule({});
    const tree = signalTree({ a: 1 });
    const leaf = tree.$.a;

    // If a neutrality layer wrapped the cell, this would be false for the
    // wrapper — the wrapper would be callable but not a framework signal.
    expect(isSignal(leaf)).toBe(true);
    expect(typeof leaf.set).toBe('function');
    expect(leaf()).toBe(1);
  });

  it('the leaf participates in the FRAMEWORK graph directly — no second graph', () => {
    TestBed.configureTestingModule({});
    const tree = signalTree({ a: 1 });

    // A framework-native computed must track the leaf. A SignalTree-owned cell
    // bridged into Angular would need explicit republication to achieve this;
    // a native cell gets it for free. This is the "no duplicate graph" proof.
    let runs = 0;
    const doubled = computed(() => { runs++; return tree.$.a() * 2; });

    expect(doubled()).toBe(2);
    const afterFirst = runs;
    tree.$.a.set(5);
    expect(doubled()).toBe(10);
    expect(runs).toBeGreaterThan(afterFirst);
  });

  it('reading a leaf allocates no per-read wrapper — identity is stable', () => {
    TestBed.configureTestingModule({});
    const tree = signalTree({ a: 1, nested: { b: 2 } });

    // A dispatch/adapter layer that produced a fresh accessor per property read
    // would fail identity here, and would allocate on every hot-path touch.
    expect(tree.$.a).toBe(tree.$.a);
    expect(tree.$.nested).toBe(tree.$.nested);
    expect(tree.$.nested.b).toBe(tree.$.nested.b);
  });

  it('the merge write path reaches the same single cell', () => {
    TestBed.configureTestingModule({});
    const tree = signalTree({ a: 1 });
    const leaf = tree.$.a;

    tree({ a: 7 });

    // Same object, new value — not a replaced cell, and not a shadow copy that
    // leaves the original stale.
    expect(tree.$.a).toBe(leaf);
    expect(untracked(() => leaf())).toBe(7);
  });

  it('a causal tree still exposes exactly ONE cell per leaf', () => {
    TestBed.configureTestingModule({});
    const tree = signalTree({ a: 1 }, { capabilities: ['causal-runtime'] });
    const leaf = tree.$.a;

    // The causal path deliberately keeps canonical storage in the neutral
    // scalar-slot kernel and exposes an observation cell over it. That is one
    // OBSERVABLE cell, and it must stay one.
    expect(isSignal(leaf)).toBe(true);
    expect(tree.$.a).toBe(leaf);
    tree.$.a.set(4);
    expect(untracked(() => tree.$.a())).toBe(4);
  });
});
