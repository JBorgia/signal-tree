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
import { applyBaseline, exitCode, Harness, type ResultsFile } from './harness.ts';
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
  --record-only     exit 0 when gates are red (recording baselines); errors and regressions still fail
  --s5-compressed   nightly S5: compress time, at least the budgeted minimum of writes
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

function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

function fmt(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  return abs !== 0 && (abs < 0.01 || abs >= 1e6) ? value.toExponential(3) : Number(value.toPrecision(4)).toString();
}

function printSummary(file: ResultsFile): void {
  const lines: string[] = [];
  lines.push(`subject ${file.subject.id} · budgets ${file.budgets.approved ? 'approved' : 'NOT approved'} · ${file.kind === 'aa' ? 'A/A' : 'results'}`);
  for (const result of Object.values(file.scenarios)) {
    if (result.status === 'not-applicable') {
      lines.push(`${result.id.padEnd(4)} not applicable: subject lacks ${result.missingCapabilities!.join(', ')}`);
      continue;
    }
    if (result.status === 'external') {
      lines.push(`${result.id.padEnd(4)} checked by ${result.owner}`);
      continue;
    }
    if (result.status === 'error') {
      lines.push(`${result.id.padEnd(4)} ERROR ${result.error?.split('\n')[0]}`);
      continue;
    }
    const state = result.pass === true ? 'pass' : result.pass === false ? 'FAIL' : 'incomplete';
    lines.push(`${result.id.padEnd(4)} ${state}`);
    for (const condition of result.conditions ?? []) {
      const actual = typeof condition.actual === 'number' ? fmt(condition.actual) : JSON.stringify(condition.actual);
      lines.push(`     ${condition.pass === true ? 'ok  ' : condition.pass === false ? 'FAIL' : '??  '} ${condition.id}: ${actual} (${condition.text})`);
    }
    if (result.aa) {
      const noise = Object.entries(result.aa.noise)
        .map(([metric, value]) => `${metric} ${(value * 100).toFixed(1)}%`)
        .join(', ');
      lines.push(`     A/A noise: ${noise}`);
    }
    for (const regression of result.regressions ?? []) {
      if (regression.regressed) lines.push(`     REGRESSION ${regression.metric}: ${fmt(regression.baseline)} -> ${fmt(regression.current)} (+${(regression.worseBy * 100).toFixed(1)}% > ${(regression.threshold * 100).toFixed(1)}%)`);
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

  const aaPairs = Number(values['aa-pairs']);
  if (!Number.isInteger(aaPairs) || aaPairs < 1) throw new Error('--aa-pairs must be a positive integer');
  const commit = git(['rev-parse', 'HEAD']);
  const file: ResultsFile = {
    schema: 1,
    kind: values.aa ? 'aa' : 'results',
    startedAt: new Date().toISOString(),
    git: { commit, dirty: commit === null ? null : (git(['status', '--porcelain']) ?? '') !== '' },
    budgets: { sha256, approved: budgets.approved },
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
    baseline: values.baseline,
    scenarios: {},
  };

  const harness = new Harness(budgets, subject, {
    aa: values.aa,
    aaPairs,
    skipBuild: values['skip-build'],
    s5Compressed: values['s5-compressed'],
  });
  file.scenarios = await harness.run(selected);
  if (values.baseline) applyBaseline(file.scenarios, values.baseline, values.noise);

  file.finishedAt = new Date().toISOString();
  const outDir = values.out ? resolve(values.out) : OUT_DIR;
  mkdirSync(outDir, { recursive: true });
  const stamp = file.startedAt.replace(/[:.]/g, '-');
  const path = join(outDir, `${file.kind}-${subject.id}-${stamp}.json`);
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  copyFileSync(path, join(outDir, `${file.kind}-${subject.id}-latest.json`));
  printSummary(file);
  process.stdout.write(`results: ${path}\n`);
  return exitCode(file.scenarios, values['record-only']);
}

process.exitCode = await main();
