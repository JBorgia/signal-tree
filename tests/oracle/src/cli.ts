// pnpm --filter @signal-tree/oracle oracle --a v15 --b v16 --runs 10000 [--seed N]
//
// Exit codes: 0 no unlisted differences, 1 unlisted differences found,
// 2 bad arguments or an invalid intended-differences file, 3 the harness saw
// an asynchronous error outside any sequence.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { IntendedDifferencesError, loadIntended } from './intended.js';
import { readFileSync } from 'node:fs';
import { formatSequence, type Sequence } from './model.js';
import { replay, replaySequence, runOracle } from './oracle.js';
import { describeOutcome, sides, writeReport } from './report.js';
import { installAsyncErrorCapture, takeStrayAsyncErrors } from './run.js';
import { AUTHORITY, SUBJECTS, loadSubject } from './subjects/registry.js';
import type { PluginMode } from './generate.js';
import { canonical } from './compare.js';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Usage: oracle --a <subject> --b <subject> [options]

Subjects: ${Object.keys(SUBJECTS).join(', ')}

Options:
  --runs <n>           sequences to generate (default 1000)
  --seed <n>           fast-check seed (default 20261119)
  --plugins <mode>     any | none | all: plugins each sequence installs (default any)
  --max-steps <n>      steps per sequence at most (default 30)
  --shrink-budget <n>  property runs per difference group while shrinking (default 400)
  --intended <file>    intended differences (default tests/intended-differences.json)
  --out <dir>          report directory (default tests/oracle/out)
  --replay <path>      replay one fast-check path (from a report) and print both traces
  --replay-group <n>   replay group n's minimal sequence from the last report for this pair
`;

function fail(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}

function int(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) fail(`--${name} must be a non-negative integer`);
  return n;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      a: { type: 'string' },
      b: { type: 'string' },
      runs: { type: 'string' },
      seed: { type: 'string' },
      plugins: { type: 'string' },
      'max-steps': { type: 'string' },
      'shrink-budget': { type: 'string' },
      intended: { type: 'string' },
      out: { type: 'string' },
      replay: { type: 'string' },
      'replay-group': { type: 'string' },
      help: { type: 'boolean' },
    },
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (!values.a || !values.b) fail('--a and --b are required');
  const plugins = (values.plugins ?? 'any') as PluginMode;
  if (!['any', 'none', 'all'].includes(plugins)) fail('--plugins must be any, none or all');
  const runs = int(values.runs, 1000, 'runs');
  const seed = int(values.seed, 20261119, 'seed');
  const maxSteps = int(values['max-steps'], 30, 'max-steps');
  const shrinkBudget = int(values['shrink-budget'], 400, 'shrink-budget');
  const intendedFile = resolve(values.intended ?? resolve(packageDir, '..', 'intended-differences.json'));
  const outDir = resolve(values.out ?? resolve(packageDir, 'out'));

  let intended;
  try {
    intended = loadIntended(intendedFile);
  } catch (error) {
    if (error instanceof IntendedDifferencesError) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    throw error;
  }

  let a, b;
  try {
    [a, b] = await Promise.all([loadSubject(values.a), loadSubject(values.b)]);
  } catch (error) {
    fail((error as Error).message);
  }

  const uninstall = installAsyncErrorCapture();
  const defaults = [
    plugins === 'any' ? '' : ` --plugins ${plugins}`,
    maxSteps === 30 ? '' : ` --max-steps ${maxSteps}`,
  ].join('');
  const command = `pnpm --filter @signal-tree/oracle oracle --a ${a.name} --b ${b.name}`;
  const replayCommand = (path: string) => `${command} --seed ${seed}${defaults} --replay ${path}`;
  const replayGroupCommand = (group: number) => `${command} --replay-group ${group}`;
  const reportJson = resolve(outDir, `${a.name}-vs-${b.name}.json`);

  try {
    if (values.replay !== undefined || values['replay-group'] !== undefined) {
      let replayed;
      if (values.replay !== undefined) {
        replayed = await replay({ a, b, seed, plugins, maxSteps, intended }, values.replay);
      } else {
        const n = int(values['replay-group'], 0, 'replay-group');
        const report = JSON.parse(readFileSync(reportJson, 'utf8')) as { groups: { example: { sequence: Sequence } }[] };
        const group = report.groups[n - 1];
        if (!group) fail(`${reportJson} has no group ${n}`);
        replayed = await replaySequence({ a, b, intended }, group.example.sequence);
      }
      const { sequence, comparison, traces } = replayed;
      const out = process.stdout;
      out.write(`${formatSequence(sequence).join('\n')}\n\n`);
      traces[0].forEach((ra, i) => {
        const rb = traces[1][i]!;
        out.write(`step ${i} ${ra.label}\n`);
        out.write(`  ${a.name}: ${describeOutcome(ra.outcome)}  state ${canonical(ra.observation.state)}\n`);
        out.write(`  ${b.name}: ${describeOutcome(rb.outcome)}  state ${canonical(rb.observation.state)}\n`);
      });
      const d = comparison.uncovered;
      out.write(d ? `\nfirst unlisted difference at step ${d.step}: ${d.key}\n` : '\nno unlisted difference\n');
      return d ? 1 : 0;
    }

    const started = performance.now();
    const step = Math.max(1, Math.floor(runs / 10));
    const result = await runOracle({
      a,
      b,
      runs,
      seed,
      plugins,
      maxSteps,
      intended,
      shrinkBudget,
      onProgress: (done, total) => {
        if (done % step === 0 || done === total) {
          process.stderr.write(`  ${done}/${total} sequences, ${((performance.now() - started) / 1000).toFixed(1)} s\n`);
        }
      },
    });
    const authority = a.name === AUTHORITY || b.name === AUTHORITY ? AUTHORITY : undefined;
    const files = writeReport(outDir, result, {
      aDescription: a.description,
      bDescription: b.description,
      ...(authority && a.name !== b.name ? { authority } : {}),
      replayCommand,
      replayGroupCommand,
    });
    const uncoveredRuns = result.groups.reduce((sum, g) => sum + g.count, 0);
    const out = process.stdout;
    out.write(
      `${a.name} vs ${b.name}: ${runs} sequences, seed ${seed}, compare ${(result.compareMs / 1000).toFixed(1)} s, shrink ${(result.shrinkMs / 1000).toFixed(1)} s\n`
    );
    out.write(`unlisted differences: ${uncoveredRuns} sequences in ${result.groups.length} groups; intended: ${result.coveredRuns} sequences\n`);
    result.groups.forEach((g, i) => {
      const [aSide, bSide] = sides(g);
      out.write(`  ${i + 1}. ${g.pattern} | ${g.field} | ${a.name}: ${aSide} | ${b.name}: ${bSide} | ${g.count}\n`);
    });
    out.write(`report: ${files.markdown}\n        ${files.json}\n`);
    const stray = takeStrayAsyncErrors();
    if (stray.length) {
      process.stderr.write(`harness: ${stray.length} asynchronous errors outside any sequence: ${canonical(stray[0])}\n`);
      return 3;
    }
    return uncoveredRuns === 0 ? 0 : 1;
  } finally {
    uninstall();
  }
}

process.exitCode = await main();
