#!/usr/bin/env node
/**
 * C6-PERF-DISCRIMINATOR-0
 *
 * The property is NOT "get stable numbers". It is:
 *
 *     CAN THIS HARNESS DISTINGUISH A DELIBERATELY MATERIAL HOT-PATH REGRESSION
 *     FROM ITS OWN A/A VARIANCE?
 *
 * Sequential whole-suite runs on this machine gave +77%, +127% and +190% for
 * IDENTICAL code, so cross-run comparison has no authority. This interleaves
 * the arms inside ONE process, in randomized order, so drift hits every arm
 * equally instead of whichever ran while the machine was busy.
 *
 * ⚠️ THE BAD ARM IS A HARNESS SENSITIVITY CONTROL, NOT AN S1 SURROGATE. It adds
 * a wrapper cell per leaf — the architecture C6 has already forbidden — purely
 * to give a known-material regression to detect. If S1 later needs measuring,
 * it must be measured on its own mechanism, not on this stand-in.
 *
 * Preregistered, relative to the measured noise floor rather than to an invented
 * millisecond threshold:
 *
 *     A/A spread          = the noise envelope
 *     A/B must            separate consistently, in the expected direction,
 *                         and materially exceed that envelope
 *     otherwise           NO TIMING AUTHORITY on this machine — a valid closure
 */
import { performance } from 'node:perf_hooks';
import { signal } from '@angular/core';

const BLOCKS = Number(process.argv.find((a) => a.startsWith('--blocks='))?.slice(9) ?? 40);
const N = Number(process.argv.find((a) => a.startsWith('--n='))?.slice(4) ?? 20000);

/** ARM A — the native cell, exactly as the kernel allocates ordinary leaves. */
function armNative(n) {
  const cells = [];
  for (let i = 0; i < n; i++) cells.push(signal(i));
  let acc = 0;
  for (let i = 0; i < n; i++) { cells[i].set(i + 1); acc += cells[i](); }
  return acc;
}

/** ARM B — the forbidden architecture: a wrapper cell in front of every leaf. */
function armWrapped(n) {
  const cells = [];
  for (let i = 0; i < n; i++) {
    const inner = signal(i);
    const w = () => inner();
    w.set = (v) => inner.set(v);
    cells.push(w);
  }
  let acc = 0;
  for (let i = 0; i < n; i++) { cells[i].set(i + 1); acc += cells[i](); }
  return acc;
}

const time = (fn) => { const t0 = performance.now(); const r = fn(N); const dt = performance.now() - t0;
  if (typeof r !== 'number') throw new Error('arm did no work'); return dt; };

// warm both arms
for (let i = 0; i < 5; i++) { time(armNative); time(armWrapped); }

const a1 = [], a2 = [], b = [];
for (let i = 0; i < BLOCKS; i++) {
  // randomized order within each block so drift cannot align with one arm
  const order = [['a1', armNative], ['a2', armNative], ['b', armWrapped]]
    .sort(() => Math.random() - 0.5);
  for (const [label, fn] of order) {
    const dt = time(fn);
    (label === 'a1' ? a1 : label === 'a2' ? a2 : b).push(dt);
  }
}

const med = (xs) => { const s = [...xs].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (xs, p) => { const s = [...xs].sort((x, y) => x - y); return s[Math.floor(s.length * p)]; };

const mA1 = med(a1), mA2 = med(a2), mB = med(b);
const aa = Math.abs(mA1 - mA2) / Math.min(mA1, mA2) * 100;
const ab = (mB - med([...a1, ...a2])) / med([...a1, ...a2]) * 100;

console.log(`blocks=${BLOCKS}  n=${N}  (interleaved, randomized within block)\n`);
console.log(`  A1 median   ${mA1.toFixed(3)} ms   p10 ${pct(a1, 0.1).toFixed(3)}  p90 ${pct(a1, 0.9).toFixed(3)}`);
console.log(`  A2 median   ${mA2.toFixed(3)} ms   p10 ${pct(a2, 0.1).toFixed(3)}  p90 ${pct(a2, 0.9).toFixed(3)}`);
console.log(`  B  median   ${mB.toFixed(3)} ms   p10 ${pct(b, 0.1).toFixed(3)}  p90 ${pct(b, 0.9).toFixed(3)}`);
console.log(`\n  A/A spread (noise floor)   ${aa.toFixed(1)}%`);
console.log(`  A/B separation             ${ab >= 0 ? '+' : ''}${ab.toFixed(1)}%`);

const directionOk = mB > mA1 && mB > mA2;
const separates = ab > aa * 3 && ab > 5;
console.log(`\n  direction correct (B slower): ${directionOk}`);
console.log(`  separates from noise (>3× A/A and >5%): ${separates}`);
if (directionOk && separates) {
  console.log('\n✅ TIMING AUTHORITY: this harness can distinguish a material hot-path regression.');
  process.exit(0);
}
console.log('\n⚠️ NO TIMING AUTHORITY on this machine — a deliberately bad architecture is not');
console.log('   reliably separable from A/A variance. Deterministic invariants remain the');
console.log('   authority; defer any timing closure to a quiet runner.');
process.exit(0);
