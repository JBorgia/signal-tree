#!/usr/bin/env node
/**
 * Controls for the `batchUpdates` occurrence ledger.
 *
 * ⚠️ THE FALSIFIER THAT MATTERS puts an unrelated `batchUpdates` declaration
 * and a GENUINE authored option IN THE SAME FILE. The previous classifier
 * discarded every authored occurrence in any file containing a `PropertySignature`
 * of that name, so it would have dismissed the real claimant on the strength of
 * its neighbour.
 *
 *     SAME FILE DOES NOT IMPLY SAME SEMANTIC DOMAIN.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { discoverOccurrences } from './batch-updates-claimants.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const dir = mkdtempSync(join(ROOT, 'tools', '.bul-'));
let bad = 0;
const check = (label, ok) => {
  if (!ok) bad++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${label}`);
};

try {
  // The falsifier: BOTH domains in one file.
  const mixed = join(dir, 'mixed.ts');
  writeFileSync(
    mixed,
    `interface Metrics { batchUpdates: number }
const metrics: Metrics = { batchUpdates: 0 };
declare function signalTree(s: unknown, c: unknown): unknown;
const tree = signalTree({}, { batchUpdates: false });
export { metrics, tree };
`,
    'utf8'
  );
  const found = discoverOccurrences([mixed]);
  // Three tokens, not four: the `Metrics` type ANNOTATION on line 2 is not a
  // `batchUpdates` token. My first control asserted 4 and failed — the count was
  // my error, not the tool's.
  check('all three occurrences in a mixed file are DISCOVERED', found.length === 3);
  check(
    'the unrelated interface member is discovered',
    found.some((o) => o.line === 1 && o.context === 'PropertySignature')
  );
  check(
    'the GENUINE authored option is discovered despite sharing a file with an unrelated declaration',
    found.some((o) => o.line === 4 && o.context === 'PropertyAssignment')
  );
  // ⚠️ THE DEAD HEURISTIC, RE-ENACTED. If any same-file rule returns, this
  // demonstrates precisely what it destroys.
  const filesWithSignature = new Set(
    found.filter((o) => o.context === 'PropertySignature').map((o) => o.file)
  );
  const survivorsUnderOldRule = found.filter(
    (o) => o.context === 'PropertyAssignment' && !filesWithSignature.has(o.file)
  );
  check(
    'the retired same-file heuristic WOULD have destroyed the genuine claimant',
    survivorsUnderOldRule.length === 0
  );

  // Discovery must not depend on the token being a config option at all.
  const stringKey = join(dir, 'strkey.ts');
  writeFileSync(stringKey, `declare const c: Record<string, unknown>;\nc['batchUpdates'] = false;\n`, 'utf8');
  check(
    'element access with a string key is discovered',
    discoverOccurrences([stringKey]).length === 1
  );

  const none = join(dir, 'none.ts');
  writeFileSync(none, `export const unrelated = 1;\n`, 'utf8');
  check('a file without the token yields nothing', discoverOccurrences([none]).length === 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(bad ? `\n❌ ${bad} ledger control(s) failed.` : '\n✅ all ledger controls pass.');
process.exit(bad ? 1 : 0);
