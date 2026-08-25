import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  reportTreeError,
  type TreeErrorSource,
} from './internals/error-reporter';

/**
 * ERROR-SURFACE-0 — should `onTreeError` be public, AND is `TreeErrorSource`
 * still the right vocabulary?
 *
 * Raised because LINK-2 wanted somewhere for a rejected outbound write to be
 * observable and found this already built. Carried as its OWN disposition so
 * `link()` cannot smuggle the decision in — and because exporting the function
 * while its taxonomy still names the APIs we are retiring would fossilise the
 * vocabulary we are deleting.
 *
 * The module's own rationale:
 *
 *     "one place to observe every error the library catches ... reporting to
 *      Sentry meant wiring a per-marker `onError` at every call site, forever"
 *
 * This file measures whether that is true today.
 */

/**
 * ⚠️ Resolving this took three attempts, and the failure mode is why the control
 * below exists. `import.meta.url` arrives vite-prefixed (`/@fs/...`) and is not
 * a usable filesystem path; and cwd is the WORKSPACE root under a direct
 * `vitest --root packages/core` but the PACKAGE root under `nx test core`. Each
 * wrong guess scanned nothing and would have reported zero reporters — which
 * "confirms" this file's finding for entirely the wrong reason.
 *
 * So: try both anchors, and assert the scan can see a file that certainly
 * exists before counting anything.
 */
const CANDIDATES = [
  join(process.cwd(), 'packages/core/src'),
  join(process.cwd(), 'src'),
];
const SRC =
  CANDIDATES.find((c) => {
    try {
      return statSync(c).isDirectory();
    } catch {
      return false;
    }
  }) ?? CANDIDATES[0];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.includes('.spec.') ? [full] : [];
  });

const PRODUCTION = sourceFiles(SRC).filter(
  (f) => !f.endsWith('error-reporter.ts')
);

// The known-positive control for the scan itself: if this file cannot be seen,
// every count below is a false zero.
if (!PRODUCTION.some((f) => f.endsWith('signal-tree.ts'))) {
  throw new Error(
    `ERROR-SURFACE-0: source scan found no signal-tree.ts under ${SRC}`
  );
}

const countIn = (needle: string) =>
  PRODUCTION.filter((f) => readFileSync(f, 'utf8').includes(needle));

describe('ERROR-SURFACE-0: is the central reporter actually central?', () => {
  it('⚠️ the ENTIRE library reports from exactly three places', async () => {
    const reporters = countIn('reportTreeError(');

    // ⚠️ THE FINDING IS NOT "it is not exported". It is that the capability was
    // built to be the one place every caught error surfaces, and then wired to
    // two markers — `stored()` and `asyncSource()` — BOTH of which this audit is
    // retiring. Every other catch in the library is still invisible.
    //
    // ⚠️ `link.ts` is the THIRD, and it moves the finding rather than closing
    // it. Production `link()` reports a rejected outbound send here instead of
    // growing an error member on its handle (LINK-2 case 3), which is the first
    // reporter wired to something that is NOT being retired. The disposition
    // question is unchanged: the `TreeErrorSource` taxonomy still needs deciding
    // before `onTreeError` is exported, and it now has a `'link'` member that a
    // consumer would see.
    expect(reporters.map((f) => f.split('/').pop()).sort()).toEqual([
      'async-source.ts',
      'link.ts',
      'stored.ts',
    ]);
  });

  it('⚠️ four of six TreeErrorSource values have NO reporter at all', async () => {
    const declared: TreeErrorSource[] = [
      'stored',
      'async-source',
      'async-query',
      'entity-loader',
      'persistence',
      'effect',
    ];
    const live = declared.filter((s) => countIn(`source: '${s}'`).length > 0);
    const dead = declared.filter((s) => countIn(`source: '${s}'`).length === 0);

    // The control: `live` being non-empty proves the search can find a source
    // that exists, so `dead` is not an artifact of the matcher.
    expect(live).toEqual(['stored', 'async-source']);
    expect(dead).toEqual([
      'async-query',
      'entity-loader',
      'persistence',
      'effect',
    ]);
  });

  it('the listener contract itself is sound — additive, and failure-isolated', () => {
    clearTreeErrorListenersForTesting();
    const seen: string[] = [];
    const offBad = onTreeError(() => {
      throw new Error('listener exploded');
    });
    const offGood = onTreeError((e) => seen.push(e.operation));

    // Not a criticism of the mechanism. It behaves correctly; it is simply
    // unreachable and under-wired.
    expect(() =>
      reportTreeError({
        error: new Error('x'),
        source: 'stored',
        operation: 'probe',
      })
    ).not.toThrow();
    expect(seen).toEqual(['probe']);

    offBad();
    offGood();
    clearTreeErrorListenersForTesting();
  });

  it('⚠️ PINNED — `onTreeError` is not exported from the barrel', async () => {
    const barrel = await import('../index');

    // Exporting it must flip this. Do NOT flip it without also disposing the
    // taxonomy: shipping `TreeErrorSource` as-is would publish a public union
    // in which four members name nothing and the other two name retiring APIs.
    expect('onTreeError' in barrel).toBe(false);
  });
});

/**
 * ## ERROR-SURFACE-0 — the disposition question, stated
 *
 * ```text
 * WAS IT INTENDED TO BE PUBLIC?
 *   Its rationale only makes sense if yes — a Sentry integration is an
 *   application concern, and the alternative it names (per-marker `onError` at
 *   every call site) is an application pattern.
 *
 * DOES ANY REQUIREMENT NEED IT?
 *   Not yet demonstrated. Two reporters exist, both in retiring APIs. Under the
 *   standing rule — only demonstrated third-party authoring need justifies a
 *   public primitive — "might be useful" is UNPROVEN, not PUBLIC.
 *
 * IS THE TAXONOMY RIGHT?
 *   No. `TreeErrorSource` is six values: four with no reporter, two naming APIs
 *   being retired or superseded. A public union should describe what CAN report,
 *   and today that is `stored` and `async-source`.
 * ```
 *
 * ⚠️ ORDER MATTERS. Export first and clean later, and the retired vocabulary
 * becomes a compatibility obligation. The taxonomy is disposed BEFORE the
 * function is exported, or neither happens.
 */
