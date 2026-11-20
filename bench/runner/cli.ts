/**
 * pnpm bench: runs scenarios against a store subject, 5 fresh processes per
 * scenario, reports medians, evaluates budgets.json, measures A/A noise and
 * compares with a baseline. Results go to bench/out/ (gitignored).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFINITIONS } from '../scenarios/index.ts';
import { DEFAULT_SUBJECT, loadSubject } from '../subjects/index.ts';
import { missingCapabilities } from '../subjects/types.ts';
import { ALLOCATION_NODE_FLAGS, type allocationProbeSelfTest } from './alloc-probe.ts';
import { gateParameters, loadBudgets } from './budgets.ts';
import { applyBaseline, exitCode, Harness, resolveRecordOnly, type ResultsFile } from './harness.ts';
import { OUT_DIR } from './paths.ts';
import { runChild } from './process.ts';
import { RUNS_PER_SCENARIO } from './stats.ts';
import type { AnyDefinition } from './types.ts';

const USAGE = `usage: pnpm bench [ids...] [options]
  ids               gate ids (M1 M2 M3 S1 S2 S3 S4a S4b S4c S5 S6a S6b S6c S7 Q1), groups (M, S, S4, S6) or all (default)
  --subject <id>    store subject (default ${DEFAULT_SUBJECT})
  --aa              A/A mode: two interleaved sets of ${RUNS_PER_SCENARIO} runs per scenario; records noise per metric
  --aa-pairs <n>    repeat the A/A pair n times and keep the largest noise (default 1)
  --baseline <file> compare medians with a results or A/A file; regression = worse by more than max(3%, A/A noise)
  --noise <file>    A/A file to take noise from (default: the baseline's own A/A noise, if it has one)
  --record-only     exit 0 when gates are red (recording baselines), only while budgets.json is unapproved;
                    errors and regressions still fail
  --s5-compressed   nightly S5 (the default): compressed time, at least the budgeted minimum of writes, 5 runs
  --s5-full         weekly S5: the full session length, with budgets.json's run count
  --skip-build      reuse the reference app already built under bench/out/apps
  --out <dir>       write results there instead of bench/out
  --list            print scenarios, required capabilities and applicability, then exit
  --self-test       run the allocation probe self-test, then exit`;

const GROUPS: Record<string, string[]> = {
  M: ['M1', 'M2', 'M3'],
  S: ['S1', 'S2', 'S3', 'S4a', 'S4b', 'S4c', 'S5', 'S6a', 'S6b', 'S6c', 'S7'],
  S4: ['S4a', 'S4b', 'S4c'],
  S6: ['S6a', 'S6b', 'S6c'],
};

function selectDefinitions(ids: string[]): AnyDefinition[] {
  if (ids.length === 0 || ids.includes('all')) return [...DEFINITIONS];
  const wanted = new Set(ids.flatMap((id) => GROUPS[id] ?? [id]));
  for (const id of wanted) if (!DEFINITIONS.some((d) => d.id === id)) throw new Error(`unknown scenario "${id}"\n${USAGE}`);
  return DEFINITIONS.filter((d) => wanted.has(d.id));
}

function git(args: string[]): string | null {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function fmt(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  return abs !== 0 && (abs < 0.01 || abs >= 1e6) ? value.toExponential(3) : Number(value.toPrecision(4)).toString();
}

function printSummary(file: ResultsFile): void {
  const lines: string[] = [];
  lines.push(
    `subject ${file.subject.id} · budgets ${file.budgets.approved ? 'approved' : 'NOT approved'} · ${file.kind === 'aa' ? 'A/A' : 'results'}${file.recordOnly ? ' · recording only' : ''}`,
  );
  for (const result of Object.values(file.scenarios)) {
    if (result.status === 'not-applicable') {
      lines.push(`${result.id.padEnd(4)} not applicable: subject lacks ${result.missingCapabilities!.join(', ')}`);
      continue;
    }
    if (result.status === 'external') {
      lines.push(`${result.id.padEnd(4)} checked by ${result.owner}`);
      continue;
    }
    lines.push(`${result.id.padEnd(4)} ${result.status === 'error' ? `ERROR ${result.error?.split('\n')[0]}` : result.pass ? 'pass' : 'FAIL'}`);
    for (const condition of result.conditions) {
      const actual = typeof condition.actual === 'number' ? fmt(condition.actual) : JSON.stringify(condition.actual);
      lines.push(`     ${condition.pass ? 'ok  ' : 'FAIL'} ${condition.id}: ${actual} (${condition.text})${condition.detail ? ` — ${condition.detail}` : ''}`);
    }
    if (result.aa) {
      const relative = Object.entries(result.aa.noise.relative).map(([metric, value]) => `${metric} ${(value * 100).toFixed(1)}%`);
      const absolute = Object.entries(result.aa.noise.absolute).map(([metric, value]) => `${metric} ±${fmt(value)}`);
      lines.push(`     A/A noise: ${[...relative, ...absolute].join(', ')}`);
    }
    for (const r of result.regressions) {
      if (!r.regressed) continue;
      const by = r.mode === 'relative' ? `+${(r.worseBy * 100).toFixed(1)}% > ${(r.threshold * 100).toFixed(1)}%` : r.mode === 'absolute' ? `+${fmt(r.worseBy)} > ${fmt(r.threshold)}` : '';
      lines.push(`     REGRESSION ${r.metric}: ${fmt(r.baseline)} -> ${fmt(r.current)} ${by}${r.error ? ` (${r.error})` : ''}`);
    }
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      subject: { type: 'string', default: DEFAULT_SUBJECT },
      aa: { type: 'boolean', default: false },
      'aa-pairs': { type: 'string', default: '1' },
      baseline: { type: 'string' },
      noise: { type: 'string' },
      'record-only': { type: 'boolean', default: false },
      's5-compressed': { type: 'boolean', default: false },
      's5-full': { type: 'boolean', default: false },
      'skip-build': { type: 'boolean', default: false },
      out: { type: 'string' },
      list: { type: 'boolean', default: false },
      'self-test': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (values['self-test']) {
    const writes = gateParameters(loadBudgets().budgets, 'M1')['allocationWrites'] as number;
    const result = await runChild<Awaited<ReturnType<typeof allocationProbeSelfTest>>>('isolate', {
      moduleUrl: new URL('./alloc-probe.ts', import.meta.url).href,
      exportName: 'allocationProbeSelfTest',
      args: writes,
    }, ALLOCATION_NODE_FLAGS);
    process.stdout.write(`allocation probe self-test over ${writes} writes: allocating ${result.allocatingPerWrite}/write, plain ${result.plainPerWrite}/write -> ${result.ok ? 'ok' : 'FAILED'}\n`);
    return result.ok ? 0 : 1;
  }

  const { budgets, sha256 } = loadBudgets();
  const subject = await loadSubject(values.subject);
  const selected = selectDefinitions(positionals);

  if (values.list) {
    for (const definition of selected) {
      if (definition.kind === 'external') {
        process.stdout.write(`${definition.id.padEnd(4)} external (${definition.owner})  ${definition.title}\n`);
        continue;
      }
      const missing = missingCapabilities(subject, definition.requires);
      const where = definition.kind === 'scenario' ? definition.environment : 'composite';
      process.stdout.write(`${definition.id.padEnd(4)} ${where.padEnd(9)} ${missing.length ? `n/a (lacks ${missing.join(', ')})` : 'runs'}  ${definition.title}\n`);
    }
    return 0;
  }

  if (values['s5-full'] && values['s5-compressed']) throw new Error('--s5-full and --s5-compressed are exclusive');
  const s5Mode = values['s5-full'] ? 'full' : 'compressed';
  const { recordOnly, notice } = resolveRecordOnly(values['record-only'], budgets.approved);
  if (notice) process.stderr.write(`${notice}\n`);
  const aaPairs = Number(values['aa-pairs']);
  if (!Number.isInteger(aaPairs) || aaPairs < 1) throw new Error('--aa-pairs must be a positive integer');
  const commit = git(['rev-parse', 'HEAD']);
  const file: ResultsFile = {
    schema: 1,
    kind: values.aa ? 'aa' : 'results',
    startedAt: new Date().toISOString(),
    git: { commit, dirty: commit === null ? null : (git(['status', '--porcelain']) ?? '') !== '' },
    budgets: { sha256, approved: budgets.approved },
    recordOnly,
    subject: { id: subject.id, description: subject.description, packages: subject.packages, capabilities: [...subject.capabilities] },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: cpus()[0]?.model ?? 'unknown',
      cpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
    },
    runsPerScenario: RUNS_PER_SCENARIO,
    aaPairs: values.aa ? aaPairs : 0,
    s5Mode,
    baseline: values.baseline,
    scenarios: {},
  };

  const harness = new Harness(budgets, subject, {
    aa: values.aa,
    aaPairs,
    skipBuild: values['skip-build'],
    s5Mode,
  });
  file.scenarios = await harness.run(selected);
  if (values.baseline) applyBaseline(file.scenarios, budgets, values.baseline, values.noise);

  file.finishedAt = new Date().toISOString();
  const outDir = values.out ? resolve(values.out) : OUT_DIR;
  mkdirSync(outDir, { recursive: true });
  const stamp = file.startedAt.replace(/[:.]/g, '-');
  const path = join(outDir, `${file.kind}-${subject.id}-${stamp}.json`);
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  copyFileSync(path, join(outDir, `${file.kind}-${subject.id}-latest.json`));
  printSummary(file);
  process.stdout.write(`results: ${path}\n`);
  return exitCode(file.scenarios, recordOnly);
}

process.exitCode = await main();
