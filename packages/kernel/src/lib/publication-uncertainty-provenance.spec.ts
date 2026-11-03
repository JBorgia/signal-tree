import { expect, it } from 'vitest';
import { installTerminalRecord } from './internals/intrinsic-mutation';
import * as lifecycle from './experimental-publication/lifecycle';

let nextSource = 910_000;
function harness() {
  const source = nextSource++;
  const channel = {};
  lifecycle.registerOwnerSource(source, {});
  lifecycle.registerConnection(channel, { supported: true, report: error => { throw error; }, wake: () => undefined });
  const open = (id: number) => {
    lifecycle.ownerTransition(source, {kind: 'opened', transactionId: id});
    const cell = lifecycle.ownerCell(source, id);
    if (!cell) throw Error('Missing test owner');
    return cell;
  };
  const author = (inputs: readonly lifecycle.NativeInput[]) => {
    let result: lifecycle.NativeRequirement | undefined;
    lifecycle.runDeclaration(channel, {kind: 'independent'}, () => {
      const prepared = lifecycle.prepareNativeRequirement([], false, inputs);
      lifecycle.finalizeNativeRequirement(prepared.requirement);
      installTerminalRecord(prepared.record);
      result = prepared.requirement;
    });
    if (!result) throw Error('Authored operation did not execute');
    return result;
  };
  return {source, open, author, close: () => {lifecycle.disposeConnection(channel); lifecycle.unregisterOwnerSource(source);}};
}

it('actual unavailable-input consumption acquires a window; derived historical uncertainty does not rebase', () => {
  const h = harness();
  try {
    const p = h.open(1);
    const raw = lifecycle.unavailableRequirement();
    const first = h.author([lifecycle.captureNativeInput(raw)]);
    expect(lifecycle.nativeProof(first)).toMatchObject({unknown: true, unavailableInput: false, historicalWindow: true, possible: [p]});
    lifecycle.ownerTransition(h.source, {kind: 'confirmed', transactionId: 1});
    const r = h.open(2);
    const derived = h.author([lifecycle.captureNativeInput(first)]);
    expect(lifecycle.nativeProof(derived).possible).toEqual([p]);
    expect(lifecycle.nativeProof(derived).possible).not.toContain(r);
    expect(lifecycle.nativeProof(derived).unknown).toBe(true);
    // A second actual consumption of raw inspection data is a new input event.
    const directAgain = h.author([lifecycle.captureNativeInput(raw)]);
    expect(lifecycle.nativeProof(directAgain).possible).toEqual([r]);
    expect(lifecycle.nativeProof(raw).unavailableInput).toBe(true);
  } finally {h.close();}
});

it('mixed input preserves inherited windows and adds only the newly unavailable input window', () => {
  const h = harness();
  try {
    const p = h.open(1);
    const historical = h.author([lifecycle.captureNativeInput(lifecycle.unavailableRequirement())]);
    lifecycle.ownerTransition(h.source, {kind: 'confirmed', transactionId: 1});
    const r = h.open(2);
    const mixed = h.author([lifecycle.captureNativeInput(historical), lifecycle.captureNativeInput(lifecycle.unavailableRequirement())]);
    expect(new Set(lifecycle.nativeProof(mixed).possible)).toEqual(new Set([p, r]));
    expect(lifecycle.nativeProof(mixed)).toMatchObject({unknown: true, unavailableInput: false, historicalWindow: true});
    expect(lifecycle.nativeProof(historical).possible).toEqual([p]);
  } finally {h.close();}
});

it('selecting unavailable support preserves its provenance without authoring a new window', () => {
  const h = harness();
  try {
    h.open(1);
    const unavailable = lifecycle.nativeProof(lifecycle.unavailableRequirement());
    const selected = lifecycle.combineProofs([lifecycle.nativeProof(lifecycle.initialRequirement()), unavailable]);
    expect(selected).toMatchObject({unknown: true, unavailableInput: true, invalid: false, possible: []});
  } finally {h.close();}
});

it('a known literal independent write remains known while unrelated owners are pending', () => {
  const h = harness();
  try {
    h.open(1);
    const literal = h.author([]);
    expect(lifecycle.nativeProof(literal)).toMatchObject({unknown: false, invalid: false, possible: []});
  } finally {h.close();}
});
