import { evidenceRef, type RealizationEvidence } from '@signal-tree/studio-query';
import { describe, expect, it, vi } from 'vitest';

import { createRealizationCapture, type ObservedFrame } from './capture';

const frame = (after: unknown): ObservedFrame => ({
  ownerId: 1, path: 'value', ownerPath: 'value', before: 0, after, participation: 'realized',
});
const make = (options: { maxEffects?: number; maxBytes?: number } = {}) =>
  createRealizationCapture({ treeId: 'tree', ownerId: 1, ...options });

describe('bounded rolling capture', () => {
  it.each([NaN, Infinity, -1, 0, 1.5, 10001])('refuses invalid effect capacity %s', (maxEffects) => {
    expect(() => make({ maxEffects })).toThrow(RangeError);
  });
  it.each([NaN, Infinity, -1, 0, 1.5, 16 * 1024 * 1024 + 1])('refuses invalid byte capacity %s', (maxBytes) => {
    expect(() => make({ maxBytes })).toThrow(RangeError);
  });
  it('evicts by bytes below the count capacity and releases accounting on dispose', () => {
    const capture = make({ maxBytes: 2048 });
    for (let i = 0; i < 20; i++) capture.accept(frame(i));
    const snapshot = capture.snapshot();
    expect(snapshot.retention.retained).toBeGreaterThan(0);
    expect(snapshot.retention.retained).toBeLessThan(20);
    expect(snapshot.retention.retainedBytes).toBeLessThanOrEqual(2048);
    expect(snapshot.retention.truncated).toBe(true);
    expect(snapshot.effects.at(-1)?.after).toEqual({ kind: 'value', value: 19 });
    capture.dispose();
    expect(capture.snapshot().retention.retainedBytes).toBe(0);
  });
  it('records an explicit budget marker instead of cloning enormous values', () => {
    const capture = make();
    capture.accept(frame('x'.repeat(100_000)));
    capture.accept(frame(new Array(1_000_000)));
    for (const effect of capture.snapshot().effects) {
      expect(effect.after).toMatchObject({ kind: 'unserializable', valueType: 'capture-budget' });
    }
    expect(capture.snapshot().retention.truncated).toBe(false);
  });
  it('bounds deep traversal and never invokes application getters', () => {
    const capture = make();
    let deep: object = {};
    for (let index = 0; index < 100; index++) deep = { next: deep };
    capture.accept(frame(deep));
    const getter = vi.fn(() => 'secret');
    capture.accept(frame(Object.defineProperty({}, 'value', { enumerable: true, get: getter })));
    expect(capture.snapshot().effects[0]?.after).toMatchObject({ valueType: 'capture-budget' });
    expect(capture.snapshot().effects[1]?.after.kind).toBe('unserializable');
    expect(getter).not.toHaveBeenCalled();
  });
  it('retains bounded cyclic Map/Set values independently of their source', () => {
    const value = new Map<string, unknown>();
    value.set('self', value);
    value.set('set', new Set([1]));
    const capture = make();
    capture.accept(frame(value));
    value.set('late', true);
    const result = capture.snapshot().effects[0]!.after;
    expect(result.kind).toBe('value');
    if (result.kind !== 'value') return;
    const retained = result.value as Map<string, unknown>;
    expect(retained.get('self')).toBe(retained);
    expect(retained.get('set')).toEqual(new Set([1]));
    expect(retained.has('late')).toBe(false);
  });
  it('preserves bounded BigInt but refuses enormous magnitude before conversion', () => {
    const capture = make();
    capture.accept(frame(BigInt(42)));
    capture.accept(frame(BigInt(1) << BigInt(100_000)));
    expect(capture.snapshot().effects[0]?.after).toEqual({ kind: 'value', value: BigInt(42) });
    expect(capture.snapshot().effects[1]?.after).toMatchObject({ valueType: 'capture-budget' });
  });
  it('preserves shared references and explicitly refuses binary values unsupported by transport', () => {
    const shared = { count: 1 };
    const capture = make();
    capture.accept(frame({ a: shared, b: shared }));
    capture.accept(frame(new ArrayBuffer(8)));
    const first = capture.snapshot().effects[0]!.after;
    expect(first.kind).toBe('value');
    if (first.kind === 'value') {
      const value = first.value as { a: object; b: object };
      expect(value.a).toBe(value.b);
      expect(value.a).not.toBe(shared);
    }
    expect(capture.snapshot().effects[1]?.after.kind).toBe('unserializable');
  });
  it('assigns distinct evidence identities when capture restarts on the same tree', () => {
    const first = make();
    first.accept(frame(1));
    const one = first.snapshot();
    first.dispose();
    const second = make();
    second.accept(frame(2));
    const two = second.snapshot();
    expect(one.captureId).toBeTruthy();
    expect(two.captureId).not.toBe(one.captureId);
    expect(one.effects[0]?.captureId).toBe(one.captureId);
    const evidence = (snapshot: typeof one): RealizationEvidence => ({
      ...snapshot.effects[0]!, kind: 'realization', treeId: snapshot.treeId,
    });
    expect(evidenceRef(evidence(one))).not.toBe(evidenceRef(evidence(two)));
  });
});
