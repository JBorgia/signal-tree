/**
 * Runs scenario definitions against a store subject and evaluates them
 * against budgets.json. The CLI (cli.ts) always runs RUNS_PER_SCENARIO runs
 * with the parameters budgets.json gives; `runs` and `override` exist for the
 * harness's own tests (bench/test), which drive every scenario once on a test
 * subject with a smaller scale.
 */
import { readFileSync } from 'node:fs';
import { DEFINITIONS } from '../scenarios/index.ts';
import { missingCapabilities, type StoreSubject } from '../subjects/types.ts';
import { buildAngularApp } from './app-build.ts';
import { evaluateCondition, gateEntry, gateEnvironment, gateParameters, type Budgets, type ConditionResult } from './budgets.ts';
import type { ScenarioReply, ScenarioRequest } from './child.ts';
import { runChild } from './process.ts';
import { aaNoise, compareToBaseline, medians, RUNS_PER_SCENARIO, type Regression } from './stats.ts';
import type { AnyDefinition, MetricValues, ScenarioDefinition, Variant } from './types.ts';

export interface RunRecord {
  readonly set: 'A' | 'B';
  readonly pair: number;
  readonly metrics: MetricValues;
  readonly notes: Record<string, string | number>;
}

export interface ScenarioResult {
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

export interface ResultsFile {
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

export type RequestBase = Omit<ScenarioRequest, 'runIndex'>;

export interface HarnessOptions {
  readonly aa: boolean;
  readonly aaPairs: number;
  readonly skipBuild: boolean;
  readonly s5Compressed: boolean;
  /** Tests only; the CLI always uses RUNS_PER_SCENARIO. */
  readonly runs?: number;
  /** Tests only; the CLI never changes what budgets.json gives a scenario. */
  readonly override?: (request: RequestBase) => RequestBase;
  readonly log?: (message: string) => void;
}

function scenarioOf(id: string): ScenarioDefinition {
  const definition = DEFINITIONS.find((d) => d.id === id);
  if (!definition || definition.kind !== 'scenario') throw new Error(`${id} is not a runnable scenario`);
  return definition;
}

export function verdict(conditions: readonly ConditionResult[]): boolean | null {
  if (conditions.some((c) => c.pass === false)) return false;
  if (conditions.some((c) => c.pass === null)) return null;
  return true;
}

export class Harness {
  private appDir: string | undefined;
  private readonly cache = new Map<string, RunRecord[]>();
  private readonly budgets: Budgets;
  private readonly subject: StoreSubject;
  private readonly options: HarnessOptions;

  constructor(budgets: Budgets, subject: StoreSubject, options: HarnessOptions) {
    this.budgets = budgets;
    this.subject = subject;
    this.options = options;
  }

  private get runsPerScenario(): number {
    return this.options.runs ?? RUNS_PER_SCENARIO;
  }

  private ensureApp(): string {
    this.appDir ??= buildAngularApp(this.subject.id, { skip: this.options.skipBuild });
    return this.appDir;
  }

  /** Runs one scenario (A/A: interleaved A and B sets per pair), each run in a fresh process. */
  async runs(definition: ScenarioDefinition, variant: Variant): Promise<RunRecord[]> {
    const key = `${definition.id}:${variant}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const environment = gateEnvironment(this.budgets, definition.id);
    let request: RequestBase = {
      scenario: definition.id,
      subject: this.subject.id,
      variant,
      params: gateParameters(this.budgets, definition.id),
      scale: this.budgets.scale as Record<string, unknown>,
      cpuThrottlingRate: environment.cpuThrottlingRate,
      appDir: definition.environment === 'browser' ? this.ensureApp() : undefined,
      s5Compressed: this.options.s5Compressed,
    };
    if (this.options.override) request = this.options.override(request);
    const pairs = this.options.aa ? this.options.aaPairs : 1;
    const sets: ('A' | 'B')[] = this.options.aa ? ['A', 'B'] : ['A'];
    const records: RunRecord[] = [];
    const total = pairs * sets.length * this.runsPerScenario;
    const log = this.options.log ?? ((message: string) => process.stderr.write(`${message}\n`));
    for (let pair = 0; pair < pairs; pair++) {
      for (let i = 0; i < this.runsPerScenario; i++) {
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

  /** Runs, or reports as not applicable or external, every selected definition. */
  async run(selected: readonly AnyDefinition[]): Promise<Record<string, ScenarioResult>> {
    const out: Record<string, ScenarioResult> = {};
    for (const definition of selected) {
      if (definition.kind === 'external') {
        out[definition.id] = { id: definition.id, title: definition.title, status: 'external', owner: definition.owner };
        continue;
      }
      const missing = missingCapabilities(this.subject, definition.requires);
      if (missing.length) {
        out[definition.id] = { id: definition.id, title: definition.title, status: 'not-applicable', missingCapabilities: missing };
        continue;
      }
      try {
        out[definition.id] = definition.kind === 'scenario' ? await this.scenario(definition) : await this.composite(definition);
      } catch (error) {
        out[definition.id] = {
          id: definition.id,
          title: definition.title,
          status: 'error',
          error: error instanceof Error ? (error.stack ?? error.message) : String(error),
        };
      }
    }
    return out;
  }
}

/**
 * Marks regressions against a baseline file: a median worse by more than
 * max(3%, A/A noise). Noise comes from `noisePath` if given, else from the
 * baseline's own A/A section.
 */
export function applyBaseline(scenarios: Record<string, ScenarioResult>, baselinePath: string, noisePath?: string): void {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as ResultsFile;
  const noiseFile = noisePath ? (JSON.parse(readFileSync(noisePath, 'utf8')) as ResultsFile) : undefined;
  for (const result of Object.values(scenarios)) {
    const before = baseline.scenarios[result.id];
    if (!result.median || !before?.median) continue;
    const definition = DEFINITIONS.find((d) => d.id === result.id);
    if (!definition || definition.kind !== 'scenario') continue;
    const noise = noiseFile?.scenarios[result.id]?.aa?.noise ?? before.aa?.noise ?? {};
    result.regressions = compareToBaseline(result.median, before.median, definition.metrics, noise);
  }
}

/** Exit status: errors and regressions always fail; red gates fail unless recording. */
export function exitCode(scenarios: Record<string, ScenarioResult>, recordOnly: boolean): number {
  const results = Object.values(scenarios);
  const errors = results.filter((r) => r.status === 'error').length;
  const regressions = results.flatMap((r) => r.regressions ?? []).filter((r) => r.regressed).length;
  const red = results.filter((r) => r.status === 'ran' && r.pass !== true).length;
  if (errors || regressions) return 1;
  return red && !recordOnly ? 1 : 0;
}
