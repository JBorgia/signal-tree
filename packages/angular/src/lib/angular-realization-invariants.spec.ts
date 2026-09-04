import {
  Component,
  computed,
  isSignal,
  provideZonelessChangeDetection,
  untracked,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { entityMap, signalTree } from '../index';

const causal = () =>
  signalTree({ a: 1, b: 2 }, { capabilities: ['causal-runtime'] });

describe('Angular realization invariants', () => {
  it('uses stable kernel-owned locations for ordinary leaves', () => {
    TestBed.configureTestingModule({});
    const tree = signalTree({ a: 1, nested: { b: 2 } });

    expect(isSignal(tree.$.a)).toBe(false);
    expect(typeof tree.$.a.set).toBe('function');
    expect(typeof tree.$.a.peek).toBe('function');
    expect(typeof tree.$.a.subscribe).toBe('function');
    expect(tree.$.a()).toBe(1);
    expect(tree.$.a).toBe(tree.$.a);
    expect(tree.$.nested).toBe(tree.$.nested);
    expect(tree.$.nested.b).toBe(tree.$.nested.b);
    tree.destroy();
  });

  it('participates directly in Angular dependency tracking', () => {
    TestBed.configureTestingModule({});
    const tree = signalTree({ a: 1 });
    let runs = 0;
    const doubled = computed(() => {
      runs++;
      return tree.$.a() * 2;
    });

    expect(doubled()).toBe(2);
    const before = runs;
    tree.$.a.set(5);
    expect(doubled()).toBe(10);
    expect(runs).toBeGreaterThan(before);
    tree.destroy();
  });

  it('keeps one ordinary cell across merge writes', () => {
    TestBed.configureTestingModule({});
    const tree = signalTree({ a: 1 });
    const leaf = tree.$.a;

    tree.$({ a: 7 });

    expect(tree.$.a).toBe(leaf);
    expect(untracked(() => leaf())).toBe(7);
    tree.destroy();
  });

  it('uses one stable kernel-owned location per causal scalar leaf', () => {
    TestBed.configureTestingModule({});
    const tree = causal();
    const leaf = tree.$.a;

    expect(isSignal(leaf)).toBe(false);
    expect(typeof leaf.set).toBe('function');
    expect(tree.$.a).toBe(leaf);
    expect(tree.$.a).not.toBe(tree.$.b);
    untracked(() => tree.$.a());
    untracked(() => tree.$.a());
    expect(tree.$.a).toBe(leaf);
    tree.destroy();
  });

  it('schedules a zoneless template after a direct location write', async () => {
    @Component({
      standalone: true,
      template: `{{ tree.$.count() }}`,
    })
    class HostComponent {
      readonly tree = signalTree(
        { count: 0 },
        { capabilities: ['causal-runtime'] }
      );
    }

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe('0');

    fixture.componentInstance.tree.$.count.set(1);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent.trim()).toBe('1');
    fixture.destroy();
  });

  it('connects causal scalar leaves directly to Angular computations', () => {
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
    expect(untracked(() => doubled())).toBe(10);
    expect(runs).toBeGreaterThan(before);
    tree.destroy();
  });

  it('keeps the causal cell stable across merge writes', () => {
    TestBed.configureTestingModule({});
    const tree = causal();
    const leaf = tree.$.a;

    tree.$({ a: 9, b: 2 });

    expect(untracked(() => leaf())).toBe(9);
    expect(tree.$.a).toBe(leaf);
    tree.destroy();
  });

  it('keeps branches as SignalTree accessors rather than Angular signals', () => {
    const tree = signalTree({ count: 0, user: { name: 'x' } });

    expect(isSignal(tree.$.count)).toBe(false);
    expect(isSignal(tree.$.user)).toBe(false);
    tree.destroy();
  });

  it('keeps EntityMap as a collection API rather than an Angular signal', () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
      plain: 1,
    });

    expect(isSignal(tree.$.plain)).toBe(false);
    expect(isSignal(tree.$.rows as never)).toBe(false);
    expect(typeof tree.$.rows).toBe('object');
    tree.destroy();
  });
});
