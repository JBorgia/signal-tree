// pnpm --filter @signal-tree/oracle oracle generate --runs 10000 [--seed N]
// pnpm --filter @signal-tree/oracle oracle --determinism --subject v16 --runs 10000
// pnpm --filter @signal-tree/oracle oracle replay out/cases/<id>.json
//
// Exit codes. generate: 0 done (a subject violating a property is a finding,
// not a failure), 2 bad arguments, 3 generator error (a property threw, or an
// asynchronous error escaped every sequence). --determinism: 0 every replay
// identical, 1 a replay differed, 2 bad arguments, 3 harness error.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CATALOG, isProperty } from './behaviors/catalog.js';
import { checkDeterminism } from './determinism.js';
import type { PluginMode } from './generate.js';
import { evaluate, generate, PropertyError, type SpecCase } from './generator.js';
import { formatSequence, type Outcome } from './model.js';
import { writeDeterminismReport, writeSpecReport } from './report.js';
import { installAsyncErrorCapture, takeStrayAsyncErrors } from './run.js';
import type { Subject } from './subject.js';
import { DEFAULT_SUBJECTS, SUBJECTS, loadSubject } from './subjects/registry.js';
import { canonical } from './trace.js';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Usage:
  oracle generate [options]                      generate sequences, check every behavior property,
                                                 write out/spec-report.{json,md} and out/cases/*.json
  oracle --determinism --subject <name> [options]  replay each sequence twice on one subject;
                                                 fail on any difference
  oracle replay <case.json> [--subjects a,b]      replay a case and print each subject's verdict

Subjects: ${Object.keys(SUBJECTS).join(', ')}

Options:
  --subjects <a,b>     subjects to replay (generate, replay; default ${DEFAULT_SUBJECTS.join(',')})
  --subject <name>     subject to check (--determinism)
  --runs <n>           sequences to generate (default 1000)
  --seed <n>           fast-check seed (default 20261119)
  --plugins <mode>     any | none | all: plugins each sequence installs (default any)
  --max-steps <n>      steps per sequence at most (default 30)
  --shrink-budget <n>  property evaluations per minimization (default 300)
  --out <dir>          report directory (default tests/oracle/out)
`;

class UsageError extends Error {}

function int(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new UsageError(`--${name} must be a non-negative integer`);
  return n;
}

async function subjectsNamed(list: string | undefined): Promise<Subject[]> {
  const names = list ? list.split(',').map((n) => n.trim()).filter(Boolean) : [...DEFAULT_SUBJECTS];
  if (names.length === 0) throw new UsageError('--subjects names no subject');
  for (const name of names) if (!SUBJECTS[name]) throw new UsageError(`unknown subject "${name}"`);
  return Promise.all(names.map(loadSubject));
}

const progress = (started: number, runs: number) => {
  const every = Math.max(1, Math.floor(runs / 10));
  return (done: number, total: number) => {
    if (done % every === 0 || done === total) {
      process.stderr.write(`  ${done}/${total} sequences, ${((performance.now() - started) / 1000).toFixed(1)} s\n`);
    }
  };
};

function describeOutcome(outcome: Outcome): string {
  switch (outcome.status) {
    case 'ok':
      return outcome.value === undefined ? 'ok' : `ok ${canonical(outcome.value)}`;
    case 'error': {
      const e = outcome.error;
      return `throws ${e.class}${e.causeKind ? ` (${e.causeKind})` : ''}: ${e.message}`;
    }
    default:
      return `${outcome.status} (${outcome.detail})`;
  }
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    options: {
      determinism: { type: 'boolean' },
      subject: { type: 'string' },
      subjects: { type: 'string' },
      runs: { type: 'string' },
      seed: { type: 'string' },
      plugins: { type: 'string' },
      'max-steps': { type: 'string' },
      'shrink-budget': { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean' },
    },
    allowPositionals: true,
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const plugins = (values.plugins ?? 'any') as PluginMode;
  if (!['any', 'none', 'all'].includes(plugins)) throw new UsageError('--plugins must be any, none or all');
  const runs = int(values.runs, 1000, 'runs');
  const seed = int(values.seed, 20261119, 'seed');
  const maxSteps = int(values['max-steps'], 30, 'max-steps');
  const shrinkBudget = int(values['shrink-budget'], 300, 'shrink-budget');
  const outDir = resolve(values.out ?? resolve(packageDir, 'out'));
  const [command, ...rest] = positionals;
  const out = process.stdout;

  if (values.determinism) {
    if (command !== undefined) throw new UsageError('--determinism takes no command');
    if (!values.subject) throw new UsageError('--determinism needs --subject');
    if (!SUBJECTS[values.subject]) throw new UsageError(`unknown subject "${values.subject}"`);
    const subject = await loadSubject(values.subject);
    const started = performance.now();
    const result = await checkDeterminism({ subject, runs, seed, plugins, maxSteps, onProgress: progress(started, runs) });
    const file = writeDeterminismReport(outDir, result);
    out.write(`determinism ${subject.name}: ${result.mismatches} mismatches in ${runs} sequences, seed ${seed}, ${(result.ms / 1000).toFixed(1)} s\n`);
    if (result.first) {
      out.write(`first at run ${result.first.run}, record ${result.first.record}:\n${formatSequence(result.first.sequence).join('\n')}\n`);
      out.write(`  first replay:  ${canonical(result.first.a)}\n  second replay: ${canonical(result.first.b)}\n`);
    }
    out.write(`report: ${file}\n`);
    return result.mismatches === 0 ? 0 : 1;
  }

  if (command === 'generate') {
    if (rest.length) throw new UsageError(`unexpected argument "${rest[0]}"`);
    const subjects = await subjectsNamed(values.subjects);
    const started = performance.now();
    const result = await generate({ subjects, runs, seed, plugins, maxSteps, shrinkBudget, onProgress: progress(started, runs) });
    const files = writeSpecReport(outDir, result);
    out.write(
      `${runs} sequences, seed ${seed}, subjects ${subjects.map((s) => s.name).join(', ')}: generation ${(result.generateMs / 1000).toFixed(1)} s, minimization ${(result.shrinkMs / 1000).toFixed(1)} s\n`
    );
    for (const entry of CATALOG) {
      const stats = result.stats.get(entry.id);
      if (!stats) {
        out.write(`  ${entry.id.padEnd(4)} not generated\n`);
        continue;
      }
      const counts = subjects.map((s) => `${s.name} ${stats.holds[s.name]} holds / ${stats.violates[s.name]} violates`);
      out.write(`  ${entry.id.padEnd(4)} exercised ${String(stats.exercised).padStart(5)}: ${counts.join(', ')}\n`);
    }
    out.write(`${result.cases.length} cases in ${files.cases}\nreport: ${files.markdown}\n        ${files.json}\n`);
    return 0;
  }

  if (command === 'replay') {
    const [file, ...extra] = rest;
    if (!file || extra.length) throw new UsageError('replay takes one case file');
    const c = JSON.parse(readFileSync(resolve(file), 'utf8')) as SpecCase;
    const subjects = await subjectsNamed(values.subjects);
    const properties = CATALOG.filter(isProperty);
    out.write(`${formatSequence(c.sequence).join('\n')}\n\nexpected (${c.behaviors.join(', ')}) at step ${c.step}: ${canonical(c.expected)}\n`);
    for (const subject of subjects) {
      const { trace, verdicts } = await evaluate(subject, c.sequence, properties);
      out.write(`\n${subject.name}:\n`);
      for (const record of trace.records) out.write(`  ${record.index} ${record.label}: ${describeOutcome(record.outcome)}\n`);
      for (const [id, v] of verdicts) {
        out.write(`  ${id} ${v.holds ? 'holds' : `violates (${v.kind})`} at step ${v.step}: ${v.detail}\n`);
        if (!v.holds) out.write(`     expected ${canonical(v.expected)}\n     observed ${canonical(v.observed)}\n`);
      }
    }
    return 0;
  }

  throw new UsageError(command === undefined ? 'name a command: generate, replay, or --determinism' : `unknown command "${command}"`);
}

const uninstall = installAsyncErrorCapture();
try {
  let code = await main();
  const stray = takeStrayAsyncErrors();
  if (stray.length) {
    process.stderr.write(`harness: ${stray.length} asynchronous errors outside any sequence: ${canonical(stray[0])}\n`);
    code = 3;
  }
  process.exitCode = code;
} catch (error) {
  if (error instanceof UsageError || (error as { code?: string }).code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
    process.stderr.write(`${(error as Error).message}\n\n${USAGE}`);
    process.exitCode = 2;
  } else {
    process.stderr.write(`${error instanceof PropertyError ? 'generator error: ' : ''}${(error as Error).stack ?? String(error)}\n`);
    process.exitCode = 3;
  }
} finally {
  uninstall();
}
