import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aaNoise, compareToBaseline, median, medians, NO_NOISE } from '../runner/stats.ts';

test('median ignores non-finite values', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([Number.NaN, 2]), 2);
  assert.deepEqual(medians([{ a: 1 }, { a: 3, b: 2 }, { a: 2 }]), { a: 2, b: 2 });
});

test('A/A noise is relative for metrics that never read 0 and absolute for those that do', () => {
  const noise = aaNoise([{ x: 100, z: 0 }, { x: 100, z: 1 }, { x: 100, z: 0 }], [{ x: 104, z: 2 }, { x: 104, z: 2 }, { x: 104, z: 2 }]);
  assert.deepEqual(noise.relative, { x: 0.04 });
  assert.deepEqual(noise.absolute, { z: 2 });
  assert.deepEqual(noise.zero, ['z']);
});

const specs = {
  t: { unit: 'ms', better: 'lower', description: '' },
  r: { unit: 'x', better: 'higher', description: '' },
  frames: { unit: 'frames', better: 'lower', description: '', zeroable: true },
} as const;
const floors = (metric: string) => ({ frames: 1 })[metric];

test('a relative regression needs a worse median by more than max(3%, A/A noise)', () => {
  const noise = { relative: { t: 0.05 }, absolute: {}, zero: [] };
  const [t, r] = compareToBaseline({ t: 103.5, r: 0.9 }, { t: 100, r: 1 }, { t: specs.t, r: specs.r }, noise, floors);
  assert.equal(t!.regressed, false, '3.5% is inside 5% noise');
  assert.equal(r!.regressed, true, '10% worse on a higher-is-better metric');
  const [plain] = compareToBaseline({ t: 103.5 }, { t: 100 }, { t: specs.t }, NO_NOISE, floors);
  assert.equal(plain!.regressed, true, '3.5% exceeds the 3% floor');
});

test('a metric whose baseline is 0 is compared in absolute terms against its floor', () => {
  const [one] = compareToBaseline({ frames: 1 }, { frames: 0 }, { frames: specs.frames }, NO_NOISE, floors);
  assert.equal(one!.mode, 'absolute');
  assert.equal(one!.regressed, false, 'one frame is within the floor of 1');
  const [two] = compareToBaseline({ frames: 2 }, { frames: 0 }, { frames: specs.frames }, NO_NOISE, floors);
  assert.equal(two!.regressed, true, 'two frames is an absolute worsening of 2 > 1');
  const noisy = { relative: {}, absolute: { frames: 3 }, zero: ['frames'] };
  const [quiet] = compareToBaseline({ frames: 3 }, { frames: 1 }, { frames: specs.frames }, noisy, floors);
  assert.equal(quiet!.mode, 'absolute', 'it read 0 in an A/A set, so absolute even with a non-zero baseline');
  assert.equal(quiet!.regressed, false, 'a worsening of 2 is inside A/A noise of 3');
});

test('a needed floor that is missing, or a metric missing now, is a regression, never a disabled check', () => {
  const [noFloor] = compareToBaseline({ frames: 0.5 }, { frames: 0 }, { frames: specs.frames }, NO_NOISE, () => undefined);
  assert.equal(noFloor!.regressed, true);
  assert.match(noFloor!.error!, /no noise floor/);
  const [gone] = compareToBaseline({}, { t: 100 }, { t: specs.t }, NO_NOISE, floors);
  assert.equal(gone!.mode, 'missing');
  assert.equal(gone!.regressed, true);
});
