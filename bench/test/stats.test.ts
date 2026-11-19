import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aaNoise, compareToBaseline, median, medians } from '../runner/stats.ts';

test('median ignores non-finite values', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([Number.NaN, 2]), 2);
  assert.deepEqual(medians([{ a: 1 }, { a: 3, b: 2 }, { a: 2 }]), { a: 2, b: 2 });
});

test('A/A noise is the relative gap between the two sets', () => {
  assert.deepEqual(aaNoise({ x: 100, y: 0 }, { x: 104, y: 0 }), { x: 0.04, y: 0 });
});

test('a regression needs a worse median by more than max(3%, A/A noise)', () => {
  const specs = { t: { unit: 'ms', better: 'lower', description: '' }, r: { unit: 'x', better: 'higher', description: '' } } as const;
  const [t, r] = compareToBaseline({ t: 103.5, r: 0.9 }, { t: 100, r: 1 }, specs, { t: 0.05 });
  assert.equal(t!.regressed, false, '3.5% is inside 5% noise');
  assert.equal(r!.regressed, true, '10% worse on a higher-is-better metric');
  const [plain] = compareToBaseline({ t: 103.5 }, { t: 100 }, { t: specs.t }, {});
  assert.equal(plain!.regressed, true, '3.5% exceeds the 3% floor');
});
