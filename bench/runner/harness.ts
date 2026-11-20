/**
 * Runs scenario definitions against a store subject and evaluates them
 * against budgets.json. The CLI (cli.ts) always runs the required number of
 * runs (5, or the gate's own run count) with the parameters budgets.json
 * gives; `runs` and `override` exist for the harness's own tests
 * (bench/test), which drive every scenario once on a test subject with a
 * smaller scale.
 *
 * Results contract (read by ci/done-check.mjs): top level budgets.approved,
 * recordOnly (the effective value) and subject.id; per scenario status, pass
 * (true or false whenever the scenario ran or errored), conditions[] and
 * regressions[] (always arrays). conditionsNotApplicable[] lists conditions a
 * subject could not be measured on (S8's operations it lacks); they are not
 * in conditions[] and do not count toward pass.
 */
import { readFileSync } from 'node:fs';
import { DEFINITIONS } from '../scenarios/index.ts';
import { missingCapabilities, type StoreSubject } from '../subjects/types.ts';
import { buildAngularApp } from './app-build.ts';
import {
  evaluateCondition,
  gateEntry,
  gateEnvironment,
  gateParameters,
  noiseFloor,
  requiredRuns,
  type Budgets,
  type Condition,
  type ConditionResult,
  type Evidence,
} from './budgets.ts';
import type { ScenarioReply, ScenarioRequest } from './child.ts';
import { runChild } from './process.ts';
import { aaNoise, compareToBaseline, medians, mergeNoise, NO_NOISE, RUNS_PER_SCENARIO, type Noise, type Regression } from './stats.ts';
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
  pass?: boolean;
  conditions: ConditionResult[];
  regressions: Regression[];
  missingCapabilities?: string[];
  /** Conditions not evaluated because the subject lacks the capabilities their metric needs (S8's operations); they do not count toward pass. */
  conditionsNotApplicable?: NotApplicableCondition[];
  owner?: string;
  error?: string;
  environment?: { runtime: string; cpuThrottlingRate: number };
  variant?: Variant;
  requiredRuns?: number;
  runs?: RunRecord[];
  median?: MetricValues;
  aa?: { pairs: { a: MetricValues; b: MetricValues; noise: Noise }[]; noise: Noise };
  compared?: Record<string, { against: MetricValues; variant: MetricValues }>;
}

export interface ResultsFile {
  schema: 1;
  kind: 'results' | 'aa';
  startedAt: string;
  finishedAt?: string;
  git: { commit: string | null; dirty: boolean | null };
  budgets: { sha256: string; approved: boolean };
  /** Effective --record-only: honored only while budgets.json is not approved. */
  recordOnly: boolean;
  subject: { id: string; description: string; packages: Readonly<Record<string, string>>; capabilities: string[] };
  environment: Record<string, string | number>;
  runsPerScenario: number;
  aaPairs: number;
  s5Mode?: S5Mode;
  baseline?: string;
  scenarios: Record<string, ScenarioResult>;
}

export type RequestBase = Omit<ScenarioRequest, 'runIndex'>;
export type S5Mode = 'compressed' | 'full';

export interface HarnessOptions {
  readonly aa: boolean;
  readonly aaPairs: number;
  readonly skipBuild: boolean;
  /** S5: 'compressed' (nightly, 5 runs, at least 2M writes) or 'full' (weekly, 8 hours, budgets.json's run count). */
  readonly s5Mode: S5Mode;
  /** Tests only: runs per scenario, also the required count. The CLI never sets it. */
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

export interface NotApplicableCondition {
  id: string;
  text: string;
  missingCapabilities: string[];
}

/**
 * Evaluates a scenario's conditions. A condition whose metric needs
 * capabilities the subject lacks (ScenarioDefinition.metricRequires) is not
 * evaluated and goes to `notApplicable`; every other condition is evaluated,
 * so a metric the scenario failed to produce still fails.
 */
export function judgeConditions(
  definition: ScenarioDefinition,
  subject: StoreSubject,
  conditions: readonly Condition[],
  evidence: Evidence,
): { conditions: ConditionResult[]; notApplicable: NotApplicableCondition[] } {
  const out: { conditions: ConditionResult[]; notApplicable: NotApplicableCondition[] } = { conditions: [], notApplicable: [] };
  for (const condition of conditions) {
    const missing = missingCapabilities(subject, definition.metricRequires?.[condition.metric ?? ''] ?? []);
    if (missing.length) out.notApplicable.push({ id: condition.id, text: condition.text, missingCapabilities: missing });
    else out.conditions.push(evaluateCondition(condition, evidence));
  }
  return out;
}

/** A scenario passes only when it has conditions and every one passed. */
export function verdict(conditions: readonly ConditionResult[]): boolean {
  return conditions.length > 0 && conditions.every((c) => c.pass === true);
}

/** --record-only is honored only while budgets.json is unapproved. */
export function resolveRecordOnly(requested: boolean, approved: boolean): { recordOnly: boolean; notice?: string } {
  if (requested && approved) {
    return { recordOnly: false, notice: 'budgets.json is approved: --record-only is ignored and red gates fail the run.' };
  }
  return { recordOnly: requested };
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

  /** Runs one measurement takes, which is also how many finite values each gated metric needs. */
  runsFor(id: string): number {
    if (this.options.runs !== undefined) return this.options.runs;
    return requiredRuns(this.budgets, id, id === 'S5' ? this.options.s5Mode : undefined, RUNS_PER_SCENARIO);
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
      s5Compressed: this.options.s5Mode === 'compressed',
    };
    if (this.options.override) request = this.options.override(request);
    const pairs = this.options.aa ? this.options.aaPairs : 1;
    const sets: ('A' | 'B')[] = this.options.aa ? ['A', 'B'] : ['A'];
    const perSet = this.runsFor(definition.id);
    const records: RunRecord[] = [];
    const total = pairs * sets.length * perSet;
    const log = this.options.log ?? ((message: string) => process.stderr.write(`${message}\n`));
    for (let pair = 0; pair < pairs; pair++) {
      for (let i = 0; i < perSet; i++) {
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
    const required = this.runsFor(definition.id);
    const result: ScenarioResult = {
      id: definition.id,
      title: definition.title,
      status: 'ran',
      environment: gateEnvironment(this.budgets, definition.id),
      variant: 'bare',
      requiredRuns: required,
      conditions: [],
      regressions: [],
    };
    const records = await this.runs(definition, 'bare');
    result.runs = records;
    const measured = records.filter((r) => r.set === 'A' && r.pair === 0).map((r) => r.metrics);
    result.median = medians(measured);
    if (this.options.aa) {
      const pairs = [];
      for (let pair = 0; pair < this.options.aaPairs; pair++) {
        const aRuns = records.filter((r) => r.set === 'A' && r.pair === pair).map((r) => r.metrics);
        const bRuns = records.filter((r) => r.set === 'B' && r.pair === pair).map((r) => r.metrics);
        pairs.push({ a: medians(aRuns), b: medians(bRuns), noise: aaNoise(aRuns, bRuns) });
      }
      result.aa = { pairs, noise: mergeNoise(pairs.map((p) => p.noise)) };
      const missingFloors = result.aa.noise.zero.filter(
        (metric) => definition.metrics[metric]?.better !== 'none' && noiseFloor(this.budgets, definition.id, metric) === undefined,
      );
      if (missingFloors.length) {
        result.status = 'error';
        result.error = `read 0 in an A/A set but budgets.json has no noise floor: ${missingFloors.map((m) => `${definition.id}.${m}`).join(', ')}`;
      }
    }
    // Every run of the measurement is evidence for 'every-run' conditions (both A/A sets).
    const evidence = { median: result.median, runs: records.map((r) => r.metrics), requiredRuns: required };
    const judged = judgeConditions(definition, this.subject, gateEntry(this.budgets, definition.id).conditions ?? [], evidence);
    result.conditions = judged.conditions;
    if (judged.notApplicable.length) result.conditionsNotApplicable = judged.notApplicable;
    result.pass = result.status === 'ran' && verdict(result.conditions);
    return result;
  }

  async composite(definition: Extract<AnyDefinition, { kind: 'composite' }>): Promise<ScenarioResult> {
    const entry = gateEntry(this.budgets, definition.id);
    const result: ScenarioResult = { id: definition.id, title: definition.title, status: 'ran', compared: {}, conditions: [], regressions: [] };
    for (const id of definition.compare.scenarios) {
      const scenario = scenarioOf(id);
      const required = this.runsFor(id);
      const pick = (records: RunRecord[]) => records.filter((r) => r.set === 'A' && r.pair === 0).map((r) => r.metrics);
      const againstRuns = pick(await this.runs(scenario, definition.compare.against));
      const variantRuns = pick(await this.runs(scenario, definition.compare.variant));
      const against = medians(againstRuns);
      const variant = medians(variantRuns);
      result.compared![id] = { against, variant };
      const gated = (gateEntry(this.budgets, id).conditions ?? []).map((c) => c.metric).filter((m): m is string => !!m);
      const enough = (runs: MetricValues[], metric: string) => runs.filter((r) => Number.isFinite(r[metric])).length >= required;
      for (const condition of entry.conditions ?? []) {
        for (const metric of gated) {
          const base = against[metric];
          const now = variant[metric];
          const relative =
            base === undefined || now === undefined || !enough(againstRuns, metric) || !enough(variantRuns, metric)
              ? Number.NaN
              : base === 0
                ? now === 0
                  ? 0
                  : Number.POSITIVE_INFINITY
                : now / base - 1;
          result.conditions.push({
            ...evaluateCondition({ ...condition, metric: 'relative' }, { median: { relative }, runs: [{ relative }], requiredRuns: 1 }),
            id: `${condition.id}:${id}.${metric}`,
          });
        }
      }
    }
    result.pass = verdict(result.conditions);
    return result;
  }

  /** Runs, or reports as not applicable or external, every selected definition. */
  async run(selected: readonly AnyDefinition[]): Promise<Record<string, ScenarioResult>> {
    const out: Record<string, ScenarioResult> = {};
    for (const definition of selected) {
      const base = { id: definition.id, title: definition.title, conditions: [], regressions: [] };
      if (definition.kind === 'external') {
        out[definition.id] = { ...base, status: 'external', owner: definition.owner };
        continue;
      }
      const missing = missingCapabilities(this.subject, definition.requires);
      if (missing.length) {
        out[definition.id] = { ...base, status: 'not-applicable', missingCapabilities: missing };
        continue;
      }
      try {
        out[definition.id] = definition.kind === 'scenario' ? await this.scenario(definition) : await this.composite(definition);
      } catch (error) {
        out[definition.id] = { ...base, status: 'error', pass: false, error: error instanceof Error ? (error.stack ?? error.message) : String(error) };
      }
    }
    return out;
  }
}

/**
 * Marks regressions against a baseline file. Noise comes from `noisePath` if
 * given, else from the baseline's own A/A section; floors from budgets.json.
 */
export function applyBaseline(scenarios: Record<string, ScenarioResult>, budgets: Budgets, baselinePath: string, noisePath?: string): void {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as ResultsFile;
  const noiseFile = noisePath ? (JSON.parse(readFileSync(noisePath, 'utf8')) as ResultsFile) : undefined;
  for (const result of Object.values(scenarios)) {
    const before = baseline.scenarios[result.id];
    if (!result.median || !before?.median) continue;
    const definition = DEFINITIONS.find((d) => d.id === result.id);
    if (!definition || definition.kind !== 'scenario') continue;
    const noise = noiseFile?.scenarios[result.id]?.aa?.noise ?? before.aa?.noise ?? NO_NOISE;
    result.regressions = compareToBaseline(result.median, before.median, definition.metrics, noise, (metric) => noiseFloor(budgets, result.id, metric));
  }
}

/** Exit status: errors and regressions always fail; red gates fail unless the effective record-only is on. */
export function exitCode(scenarios: Record<string, ScenarioResult>, recordOnly: boolean): number {
  const results = Object.values(scenarios);
  const errors = results.filter((r) => r.status === 'error').length;
  const regressions = results.flatMap((r) => r.regressions).filter((r) => r.regressed).length;
  const red = results.filter((r) => r.status === 'ran' && r.pass !== true).length;
  if (errors || regressions) return 1;
  return red && !recordOnly ? 1 : 0;
}
