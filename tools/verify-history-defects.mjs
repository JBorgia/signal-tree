#!/usr/bin/env node
/**
 * Reproduces the history defects filed as TODO 6a-6d, by OUTCOME.
 *
 *   node tools/verify-history-defects.mjs
 *
 * Every check performs writes, lets the microtask queue drain, then calls
 * undo() and inspects the state. Reading getRestorationHistory().length or canUndo()
 * without a following undo() is NOT evidence — that is how the original
 * time-travel audit mis-scored itself (see docs/audits/2026-08/).
 *
 * 6a is GONE — `form()` and `history()` were deleted in b57ba293 (FORM-DEL),
 * so its subject no longer exists; see the tombstone below. 6b and 6d still
 * reproduce as documented.
 *
 * Exits 0 when the documented behaviours reproduce (6b/6d) and the fixed
 * behaviour holds (6a), 1 when a documented defect no longer reproduces —
 * i.e. this goes RED when something is FIXED, and the fixer should update
 * the docs it cites. It is a provenance tool for the figures published in
 * docs/guides/time-travel-in-production.md, not a regression test.
 *
 * Runs against the BUILT package, because an `as any` attachment is invisible
 * to a type-level read. Requires `npx nx build kernel` first.
 */
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve('dist/packages/kernel/dist/index.js');
if (!existsSync(DIST)) {
  console.error('✗ dist not found — run `npx nx build kernel` first.');
  process.exit(1);
}
const core = await import(pathToFileURL(DIST).href);
const { signalTree, createAuditTracker } = core;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, reproduced, detail) => {
  results.push({ name, reproduced, detail });
  console.log(
    `${reproduced ? '✓ reproduces' : '✗ NO LONGER REPRODUCES'}  ${name}`
  );
  console.log(`    ${detail}`);
};

// -- 6a: DELETED WITH ITS SUBJECT ------------------------------------------
//
// 6a asked whether `restoration()` covers `form()` state, and whether
// `form({ history: history() })` is the recommended path. Both `form()` and
// `history()` were deleted from @signal-tree/kernel in b57ba293 (FORM-DEL), so the
// question no longer has a subject and the checks cannot be rewritten to ask it
// of anything else.
//
// This is a tombstone, not a gap: the block imported `form` and `history` from
// the built barrel, so the tool crashed on load from FORM-DEL onward and
// neither 6b nor 6d has run since. Removing it is what makes the surviving
// checks reachable again.
//
// docs/guides/time-travel-in-production.md cites this tool for its figures.
// Anything it says about form() is describing a removed API.

// -- 6b: createAuditTracker samples, so it drops changes -------------------
// NB: the 100 ms interval is NOT measured here. It is a source constant —
// `setInterval(handleChange, 100)` at packages/kernel/src/lib/audit/audit.ts:156.
// The sleeps below are CHOSEN from that constant; what these checks establish
// is the consequence (changes are dropped), not the number.
{
  const t = signalTree({ n: 0 });
  const log = [];
  const stop = createAuditTracker(t, log);
  await sleep(120);
  const base = log.length;
  t.$.n(1);
  await sleep(0); // both writes inside one sampling window
  t.$.n(2);
  await sleep(250);
  const collapsed = log.length - base;
  stop();
  check(
    '6b audit tracker: two writes in one window log a single entry',
    collapsed === 1,
    `writes n=1 then n=2 with no gap -> ${collapsed} entry (intermediate state lost)`
  );
}
{
  const t = signalTree({ name: 'a' });
  const log = [];
  const stop = createAuditTracker(t, log);
  await sleep(120);
  const base = log.length;
  t.$.name('TEMP');
  await sleep(0);
  t.$.name('a'); // reverted inside the same window
  await sleep(250);
  const seen = log.length - base;
  stop();
  check(
    '6b audit tracker: write-then-revert inside one window is INVISIBLE',
    seen === 0,
    `set 'TEMP' then back to 'a' -> ${seen} entries; the trail has no record it happened`
  );
}
{
  // Why it polls at all: the tracker only avoids setInterval when the tree has a
  // .subscribe method to attach to (audit.ts:150). It never does.
  const t = signalTree({ n: 0 });
  const hasSubscribe = 'subscribe' in t;
  console.log(
    `    (why it polls: tree has .subscribe? ${hasSubscribe ? 'yes' : 'NO'} ` +
      `-> the setInterval fallback at audit.ts:160 always runs)`
  );
}

// --------------------------------------------------------------------------
const gone = results.filter((r) => !r.reproduced);
console.log(
  `\n${results.length - gone.length}/${
    results.length
  } documented behaviours reproduce.`
);
if (gone.length) {
  console.log(
    '\n⚠️ A documented defect no longer reproduces. That is good news — but the docs\n' +
      '   citing it are now wrong. Update docs/guides/time-travel-in-production.md and\n' +
      '   the matching TODO item before landing the fix.'
  );
  for (const g of gone) console.log(`   · ${g.name}`);
  process.exit(1);
}
process.exit(0);
