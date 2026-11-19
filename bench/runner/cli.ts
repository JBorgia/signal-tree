/**
 * pnpm bench: runs scenarios against a store subject, 5 fresh processes per
 * scenario, reports medians, evaluates budgets.json, measures A/A noise and
 * compares with a baseline. Results go to bench/out/ (gitignored).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFINITIONS } from '../scenarios/index.ts';
import { DEFAULT_SUBJECT, loadSubject } from '../subjects/index.ts';
import { missingCapabilities, type StoreSubject } from '../subjects/types.ts';
import { ALLOCATION_NODE_FLAGS, type allocationProbeSelfTest } from './alloc-probe.ts';
import { buildAngularApp } from './app-build.ts';
import { evaluateCondition, gateEntry, gateEnvironment, gateParameters, loadBudgets, type Budgets, type ConditionResult } from './budgets.ts';
import type { ScenarioReply, ScenarioRequest } from './child.ts';
import { OUT_DIR } from './paths.ts';
import { runChild } from './process.ts';
import { aaNoise, compareToBaseline, medians, RUNS_PER_SCENARIO, type Regression } from './stats.ts';
import type { AnyDefinition, MetricValues, ScenarioDefinition, Variant } from './types.ts';

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
  --list            print scenarios, required capabilities and applicability, then exit
  --self-test       run the allocation probe self-test, then exit`;

interface RunRecord {
  readonly set: 'A' | 'B';
  readonly pair: number;
  readonly metrics: MetricValues;
  readonly notes: Record<string, string | number>;
}

interface ScenarioResult {
  id: string;
  title: string;
  status: 'ran' | 'not-applicable' | 'external' | 'error';
  missingCapabilities?: string[];
  owner?: string;
  error?: string;
  environment?: { runtime: string; cpuThrottlingRate: number };
  variant?: Variant;
  runs?: RunRecord[];
  median?: MetricValues;
  aa?: { pairs: { a: MetricValues; b: MetricValues; noise: MetricValues }[]; noise: MetricValues };
  compared?: Record<string, { against: MetricValues; variant: MetricValues }>;
  conditions?: ConditionResult[];
  pass?: boolean | null;
  regressions?: Regression[];
}

interface ResultsFile {
  schema: 1;
  kind: 'results' | 'aa';
  startedAt: string;
  finishedAt?: string;
  git: { commit: string | null; dirty: boolean | null };
  budgets: { sha256: string; approved: boolean };
  subject: { id: string; description: string; packages: Readonly<Record<string, string>>; capabilities: string[] };
  environment: Record<string, string | number>;
  runsPerScenario: number;
  aaPairs: number;
  baseline?: string;
  scenarios: Record<string, ScenarioResult>;
}

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

function scenarioOf(id: string): ScenarioDefinition {
  const definition = DEFINITIONS.find((d) => d.id === id);
  if (!definition || definition.kind !== 'scenario') throw new Error(`${id} is not a runnable scenario`);
  return definition;
}

class Harness {
  private appDir: string | undefined;
  private readonly cache = new Map<string, RunRecord[]>();
  private readonly budgets: Budgets;
  private readonly subject: StoreSubject;
  private readonly options: { aa: boolean; aaPairs: number; skipBuild: boolean; s5Compressed: boolean };

  constructor(budgets: Budgets, subject: StoreSubject, options: { aa: boolean; aaPairs: number; skipBuild: boolean; s5Compressed: boolean }) {
    this.budgets = budgets;
    this.subject = subject;
    this.options = options;
  }

  private ensureApp(): string {
    this.appDir ??= buildAngularApp(this.subject.id, { skip: this.options.skipBuild });
    return this.appDir;
  }

  /** Runs one scenario RUNS_PER_SCENARIO times (A/A: interleaved A and B sets per pair), each in a fresh process. */
  async runs(definition: ScenarioDefinition, variant: Variant): Promise<RunRecord[]> {
    const key = `${definition.id}:${variant}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const environment = gateEnvironment(this.budgets, definition.id);
    const request: Omit<ScenarioRequest, 'runIndex'> = {
      scenario: definition.id,
      subject: this.subject.id,
      variant,
      params: gateParameters(this.budgets, definition.id),
      scale: this.budgets.scale as Record<string, unknown>,
      cpuThrottlingRate: environment.cpuThrottlingRate,
      appDir: definition.environment === 'browser' ? this.ensureApp() : undefined,
      s5Compressed: this.options.s5Compressed,
    };
    const pairs = this.options.aa ? this.options.aaPairs : 1;
    const sets: ('A' | 'B')[] = this.options.aa ? ['A', 'B'] : ['A'];
    const records: RunRecord[] = [];
    const total = pairs * sets.length * RUNS_PER_SCENARIO;
    for (let pair = 0; pair < pairs; pair++) {
      for (let i = 0; i < RUNS_PER_SCENARIO; i++) {
        for (const set of sets) {
          const runIndex = records.length + 1;
          log(`[${definition.id}${variant === 'bare' ? '' : `:${variant}`}] run ${runIndex}/${total}${this.options.aa ? ` (pair ${pair + 1}, set ${set})` : ''}`);
          const reply = await runChild<ScenarioReply>('scenario', { ...request, runIndex } satisfies ScenarioRequest);
          records.push({ set, pair, metrics: reply.metrics, notes: reply.notes });
        }
      }
    }
    this.cache.set(key, records);
    return records;
  }

  async scenario(definition: ScenarioDefinition): Promise<ScenarioResult> {
    const result: ScenarioResult = {
      id: definition.id,
      title: definition.title,
      status: 'ran',
      environment: gateEnvironment(this.budgets, definition.id),
      variant: 'bare',
    };
    const records = await this.runs(definition, 'bare');
    result.runs = records;
    result.median = medians(records.filter((r) => r.set === 'A' && r.pair === 0).map((r) => r.metrics));
    if (this.options.aa) {
      const pairs = [];
      for (let pair = 0; pair < this.options.aaPairs; pair++) {
        const a = medians(records.filter((r) => r.set === 'A' && r.pair === pair).map((r) => r.metrics));
        const b = medians(records.filter((r) => r.set === 'B' && r.pair === pair).map((r) => r.metrics));
        pairs.push({ a, b, noise: aaNoise(a, b) });
      }
      const noise: MetricValues = {};
      for (const { noise: pairNoise } of pairs) for (const [metric, value] of Object.entries(pairNoise)) noise[metric] = Math.max(noise[metric] ?? 0, value);
      result.aa = { pairs, noise };
    }
    result.conditions = (gateEntry(this.budgets, definition.id).conditions ?? []).map((condition) => evaluateCondition(condition, result.median!));
    result.pass = verdict(result.conditions);
    return result;
  }

  async composite(definition: Extract<AnyDefinition, { kind: 'composite' }>): Promise<ScenarioResult> {
    const entry = gateEntry(this.budgets, definition.id);
    const result: ScenarioResult = { id: definition.id, title: definition.title, status: 'ran', compared: {}, conditions: [] };
    for (const id of definition.compare.scenarios) {
      const scenario = scenarioOf(id);
      const pick = (records: RunRecord[]) => medians(records.filter((r) => r.set === 'A' && r.pair === 0).map((r) => r.metrics));
      const against = pick(await this.runs(scenario, definition.compare.against));
      const variant = pick(await this.runs(scenario, definition.compare.variant));
      result.compared![id] = { against, variant };
      const gated = (gateEntry(this.budgets, id).conditions ?? []).map((c) => c.metric).filter((m): m is string => !!m);
      for (const condition of entry.conditions ?? []) {
        for (const metric of gated) {
          const base = against[metric];
          const now = variant[metric];
          const relative = base === undefined || now === undefined ? Number.NaN : base === 0 ? (now === 0 ? 0 : Number.POSITIVE_INFINITY) : now / base - 1;
          result.conditions!.push({
            ...evaluateCondition({ ...condition, metric: 'relative' }, { relative }),
            id: `${condition.id}:${id}.${metric}`,
          });
        }
      }
    }
    result.pass = verdict(result.conditions!);
    return result;
  }
}

function verdict(conditions: readonly ConditionResult[]): boolean | null {
  if (conditions.some((c) => c.pass === false)) return false;
  if (conditions.some((c) => c.pass === null)) return null;
  return true;
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

  for (const definition of selected) {
    if (definition.kind === 'external') {
      file.scenarios[definition.id] = { id: definition.id, title: definition.title, status: 'external', owner: definition.owner };
      continue;
    }
    const missing = missingCapabilities(subject, definition.requires);
    if (missing.length) {
      file.scenarios[definition.id] = { id: definition.id, title: definition.title, status: 'not-applicable', missingCapabilities: missing };
      continue;
    }
    try {
      file.scenarios[definition.id] = definition.kind === 'scenario' ? await harness.scenario(definition) : await harness.composite(definition);
    } catch (error) {
      file.scenarios[definition.id] = {
        id: definition.id,
        title: definition.title,
        status: 'error',
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      };
    }
  }

  if (values.baseline) {
    const baseline = JSON.parse(readFileSync(values.baseline, 'utf8')) as ResultsFile;
    const noiseFile = values.noise ? (JSON.parse(readFileSync(values.noise, 'utf8')) as ResultsFile) : undefined;
    for (const result of Object.values(file.scenarios)) {
      const before = baseline.scenarios[result.id];
      if (!result.median || !before?.median) continue;
      const definition = DEFINITIONS.find((d) => d.id === result.id);
      if (!definition || definition.kind !== 'scenario') continue;
      const noise = noiseFile?.scenarios[result.id]?.aa?.noise ?? before.aa?.noise ?? {};
      result.regressions = compareToBaseline(result.median, before.median, definition.metrics, noise);
    }
  }

  file.finishedAt = new Date().toISOString();
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = file.startedAt.replace(/[:.]/g, '-');
  const path = join(OUT_DIR, `${file.kind}-${subject.id}-${stamp}.json`);
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  copyFileSync(path, join(OUT_DIR, `${file.kind}-${subject.id}-latest.json`));
  printSummary(file);
  process.stdout.write(`results: ${path}\n`);

  const results = Object.values(file.scenarios);
  const errors = results.filter((r) => r.status === 'error').length;
  const regressions = results.flatMap((r) => r.regressions ?? []).filter((r) => r.regressed).length;
  const red = results.filter((r) => r.status === 'ran' && r.pass !== true).length;
  if (errors || regressions) return 1;
  return red && !values['record-only'] ? 1 : 0;
}

process.exitCode = await main();
