#!/usr/bin/env node
// Runs the UNCHANGED frozen transaction-options runner and records, in the
// report itself, what produced it.
//
// Why this exists: the frozen runner emits {profile, totals, results, runtime}
// and no hashes. A saved report therefore could not be identified without the
// prose around it, which falls short of self-contained provenance. This wrapper
// shells out to the frozen CLI so case selection and assertions are byte-for-byte
// the frozen ones, then prepends their identities. It writes nothing into
// tools/experiments/.
//
// Scope: this is the transaction-options PROMOTION SCREEN. It is NOT the
// SEMANTICS-2 matrix and its totals are not comparable to matrix rows.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXP = resolve('tools/experiments/transaction-options');
const SELF = resolve('docs/audits/2026-09-24-candidate-rebaseline/screen-with-provenance.mjs');

const hash = (path) => {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16);
  } catch {
    return 'missing';
  }
};

const [candidate, outPath, profile = 'live'] = process.argv.slice(2);
if (!candidate || !outPath) {
  console.error('Usage: screen-with-provenance.mjs <candidate> <out.json> [profile]');
  process.exit(2);
}

const candidatePath = resolve(EXP, `${candidate}.mjs`);
const raw = `${outPath}.raw.json`;

// The runner exits non-zero whenever anything is unresolved; it still writes the
// report, and the report is what we are here for. Its stderr is surfaced so a
// genuine crash is not mistaken for ordinary failures.
try {
  execFileSync(
    process.execPath,
    [resolve(EXP, 'runner.mjs'), candidatePath, `--out=${raw}`, `--profile=${profile}`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
} catch (error) {
  if (error.code === 'ENOENT') throw error;
}

const report = JSON.parse(readFileSync(raw, 'utf8'));
rmSync(raw, { force: true });

writeFileSync(
  outPath,
  JSON.stringify(
    {
      provenance: {
        screen: 'transaction-options promotion screen (NOT the SEMANTICS-2 matrix)',
        candidate,
        profile,
        node: process.version,
        generatedAt: new Date().toISOString(),
        // Standalone candidate files carry no meaningful repo SHA, so identity
        // is the content hash of each input that can change a verdict.
        sha256_16: {
          candidate: hash(candidatePath),
          runner: hash(resolve(EXP, 'runner.mjs')),
          assertions: hash(resolve(EXP, 'assertions.mjs')),
          scalarCases: hash(resolve(EXP, 'scalar-cases.mjs')),
          structuralCases: hash(resolve(EXP, 'structural-cases.mjs')),
          compositionCases: hash(resolve(EXP, 'composition-cases.mjs')),
          protocol: hash(resolve(EXP, 'PROTOCOL.md')),
          wrapper: hash(SELF),
        },
      },
      ...report,
    },
    null,
    2
  ) + '\n'
);
console.log(JSON.stringify({ candidate, profile, totals: report.totals }));
