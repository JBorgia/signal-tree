// Writes the spec report (JSON for tools, Markdown for reading) and the
// candidate cases under out/. Nothing under out/ is committed (BRIEF.md 6.1).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BehaviorId } from './behaviors/types.js';
import type { DeterminismResult } from './determinism.js';
import { coreGate, instanceFloor, NIGHTLY_FLOOR, PR_FLOOR, SEQUENCES_PER_INSTANCE, type GateResult } from './gate.js';
import type { GenerateResult, SpecCase } from './generator.js';
import { canonical } from './trace.js';

type PerSubject = Readonly<Record<string, number>>;

/**
 * Counts per subject. An instance is a checked case: a sequence in which the
 * behavior (or clause) was checked on that subject, so instances = holds +
 * violates.
 */
export interface Counts {
  readonly holds: PerSubject;
  readonly violates: PerSubject;
  readonly instances: PerSubject;
}

export interface ClauseReport extends Counts {
  readonly text: string;
  /** Subjects on which the clause was never checked. */
  readonly unreached: readonly string[];
}

export interface BehaviorReport extends Counts {
  readonly generatable: boolean;
  readonly reason?: string;
  /** Sequences in which the behavior applied on at least one subject. */
  readonly exercised: number;
  /** The non-vacuity floor and, per subject, whether its instances reach it; not-generatable entries are excluded. */
  readonly floor: { readonly required: number; readonly met: Readonly<Record<string, boolean>> } | { readonly excluded: 'not generatable' };
  /** Per clause, for a property with clauses. The floor is per behavior; a clause with no instances is listed in unreachedClauses. */
  readonly clauses?: Readonly<Record<string, ClauseReport>>;
  /** Case ids (files under cases/) for this behavior. */
  readonly cases: readonly string[];
}

export interface DeterminismReport {
  readonly subject: string;
  readonly runs: number;
  readonly seed: number;
  readonly mismatches: number;
}

export interface SpecReport {
  readonly runs: number;
  readonly seed: number;
  readonly plugins: string;
  readonly maxSteps: number;
  readonly subjects: readonly { readonly name: string; readonly description: string }[];
  readonly timing: { readonly generateMs: number; readonly shrinkMs: number };
  /** The non-vacuity floor for this run (one instance per `sequencesPerInstance` sequences) and the two ruled points. */
  readonly floor: {
    readonly required: number;
    readonly sequencesPerInstance: number;
    readonly pr: typeof PR_FLOOR;
    readonly nightly: typeof NIGHTLY_FLOOR;
  };
  /** The core gate: applied only when the core is a subject. */
  readonly gate: GateResult;
  readonly behaviors: Readonly<Record<BehaviorId, BehaviorReport>>;
  /** Catalog entries that cannot be generated yet; excluded from the floor. */
  readonly notGeneratable: readonly BehaviorId[];
  /** Clauses never checked on some subject. */
  readonly unreachedClauses: readonly {
    readonly behavior: BehaviorId;
    readonly clause: string;
    readonly text: string;
    readonly subjects: readonly string[];
  }[];
  readonly violations: readonly {
    readonly behavior: BehaviorId;
    readonly subject: string;
    readonly kind: string;
    readonly count: number;
    readonly firstRun: number;
    readonly case: string;
  }[];
  readonly cases: readonly string[];
  readonly determinism?: DeterminismReport;
}

export const REPORT_JSON = 'spec-report.json';
export const REPORT_MARKDOWN = 'spec-report.md';
export const CASES_DIR = 'cases';
export const DETERMINISM_JSON = 'determinism-report.json';

export function specReport(result: GenerateResult): SpecReport {
  const names = result.subjects.map((s) => s.name);
  const zeros = () => Object.fromEntries(names.map((n) => [n, 0]));
  const required = instanceFloor(result.runs);
  const counts = (holds: PerSubject, violates: PerSubject): Counts => ({
    holds: { ...holds },
    violates: { ...violates },
    instances: Object.fromEntries(names.map((n) => [n, (holds[n] ?? 0) + (violates[n] ?? 0)])),
  });
  const behaviors = {} as Record<BehaviorId, BehaviorReport>;
  const unreachedClauses: SpecReport['unreachedClauses'][number][] = [];
  for (const entry of result.catalog) {
    const stats = result.stats.get(entry.id);
    const { reason } = entry;
    const total = stats ? counts(stats.holds, stats.violates) : counts(zeros(), zeros());
    let clauses: Record<string, ClauseReport> | undefined;
    if (entry.generatable && entry.clauses && stats) {
      clauses = {};
      for (const [clause, text] of Object.entries(entry.clauses)) {
        const c = stats.clauses[clause];
        const clauseCounts = c ? counts(c.holds, c.violates) : counts(zeros(), zeros());
        const unreached = names.filter((n) => clauseCounts.instances[n] === 0);
        clauses[clause] = { text, ...clauseCounts, unreached };
        if (unreached.length) unreachedClauses.push({ behavior: entry.id, clause, text, subjects: unreached });
      }
    }
    behaviors[entry.id] = {
      generatable: entry.generatable,
      ...(reason ? { reason } : {}),
      exercised: stats?.exercised ?? 0,
      ...total,
      floor: entry.generatable
        ? { required, met: Object.fromEntries(names.map((n) => [n, (total.instances[n] ?? 0) >= required])) }
        : { excluded: 'not generatable' },
      ...(clauses ? { clauses } : {}),
      cases: result.cases.filter((c) => c.behaviors.includes(entry.id)).map((c) => c.id),
    };
  }
  return {
    runs: result.runs,
    seed: result.seed,
    plugins: result.plugins,
    maxSteps: result.maxSteps,
    subjects: result.subjects,
    timing: { generateMs: Math.round(result.generateMs), shrinkMs: Math.round(result.shrinkMs) },
    floor: { required, sequencesPerInstance: SEQUENCES_PER_INSTANCE, pr: PR_FLOOR, nightly: NIGHTLY_FLOOR },
    gate: coreGate(result),
    behaviors,
    notGeneratable: result.catalog.filter((e) => !e.generatable).map((e) => e.id),
    unreachedClauses,
    violations: result.groups.map((g) => ({ ...g })),
    cases: result.cases.map((c) => c.id),
  };
}

/** Writes spec-report.json, spec-report.md and cases/<id>.json, replacing earlier cases. */
export function writeSpecReport(
  dir: string,
  result: GenerateResult
): { json: string; markdown: string; cases: string; report: SpecReport } {
  mkdirSync(dir, { recursive: true });
  const casesDir = join(dir, CASES_DIR);
  rmSync(casesDir, { recursive: true, force: true });
  mkdirSync(casesDir, { recursive: true });
  for (const c of result.cases) writeFileSync(join(casesDir, `${c.id}.json`), `${JSON.stringify(c, null, 2)}\n`);
  const report = specReport(result);
  const json = join(dir, REPORT_JSON);
  const markdown = join(dir, REPORT_MARKDOWN);
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdown, toMarkdown(report, result.cases));
  return { json, markdown, cases: casesDir, report };
}

/**
 * Writes determinism-report.json and, when a spec report is already in `dir`,
 * records the result in its `determinism` field (and its Markdown) so one
 * artifact carries both.
 */
export function writeDeterminismReport(dir: string, result: DeterminismResult): string {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, DETERMINISM_JSON);
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  const specFile = join(dir, REPORT_JSON);
  if (existsSync(specFile)) {
    const report = JSON.parse(readFileSync(specFile, 'utf8')) as SpecReport;
    const determinism: DeterminismReport = {
      subject: result.subject,
      runs: result.runs,
      seed: result.seed,
      mismatches: result.mismatches,
    };
    writeFileSync(specFile, `${JSON.stringify({ ...report, determinism }, null, 2)}\n`);
    const markdown = join(dir, REPORT_MARKDOWN);
    if (existsSync(markdown)) {
      const text = readFileSync(markdown, 'utf8').replace(/\n## Determinism\n[\s\S]*$/, '\n');
      writeFileSync(markdown, `${text.trimEnd()}\n\n${determinismMarkdown(determinism)}`);
    }
  }
  return file;
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const clip = (text: string, max = 140) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function toMarkdown(report: SpecReport, cases: readonly SpecCase[]): string {
  const names = report.subjects.map((s) => s.name);
  const triple = (c: Counts, n: string) => `${c.holds[n] ?? 0} / ${c.violates[n] ?? 0} / ${c.instances[n] ?? 0}`;
  const lines = [
    '# Spec report',
    '',
    `${report.runs} sequences, seed ${report.seed}, plugins ${report.plugins}, at most ${report.maxSteps} steps.`,
    `Subjects: ${report.subjects.map((s) => `${s.name} (${s.description})`).join(', ')}.`,
    `Generation ${(report.timing.generateMs / 1000).toFixed(1)} s, minimization ${(report.timing.shrinkMs / 1000).toFixed(1)} s.`,
    '',
    'Expected outcomes come from each behavior\'s BRIEF.md row. A subject violates a behavior when it',
    'disagrees with the row. Counts are sequences: holds / violates / instances, where an instance is a',
    `sequence in which the behavior was checked. Floor: ${report.floor.required} instances per behavior for this run`,
    `(one per ${report.floor.sequencesPerInstance} sequences: ${report.floor.pr.instances} at ${report.floor.pr.runs}, ${report.floor.nightly.instances} at ${report.floor.nightly.runs}). Cases are under \`cases/\`.`,
    '',
    ...gateMarkdown(report.gate),
  ];
  if (report.unreachedClauses.length) {
    lines.push(
      '**Clauses never reached:** ' +
        report.unreachedClauses.map((u) => `${u.behavior}(${u.clause}) on ${u.subjects.join(', ')}`).join('; ') +
        '. The floor is per behavior, so these do not fail it; see Clauses below.',
      ''
    );
  }
  lines.push(
    `| ID | ${names.map((n) => `${n} holds / violates / instances`).join(' | ')} | Floor | Notes |`,
    `| --- | ${names.map(() => '---').join(' | ')} | --- | --- |`
  );
  for (const [id, b] of Object.entries(report.behaviors)) {
    const counts = names.map((n) => (b.generatable ? triple(b, n) : '–')).join(' | ');
    const floor =
      'required' in b.floor
        ? `${b.floor.required}: ${names.map((n) => `${n} ${(b.floor as { met: Record<string, boolean> }).met[n] ? 'met' : '**below**'}`).join(', ')}`
        : 'excluded (not generatable)';
    const note = b.generatable ? (b.reason ? `partial: ${b.reason}` : '') : `not generated: ${b.reason}`;
    lines.push(`| ${id} | ${counts} | ${floor} | ${cell(clip(note, 160))} |`);
  }
  const withClauses = Object.entries(report.behaviors).filter(([, b]) => b.clauses);
  if (withClauses.length) {
    lines.push('', '## Clauses', '', `| Clause | ${names.map((n) => `${n} holds / violates / instances`).join(' | ')} |`, `| --- | ${names.map(() => '---').join(' | ')} |`);
    for (const [id, b] of withClauses) {
      for (const [clause, c] of Object.entries(b.clauses ?? {})) {
        const cells = names.map((n) => ((c.instances[n] ?? 0) === 0 ? '**never reached**' : triple(c, n))).join(' | ');
        lines.push(`| ${id}(${clause}) ${cell(c.text)} | ${cells} |`);
      }
    }
  }
  if (report.notGeneratable.length) {
    lines.push('', `Excluded from the floor as not generatable: ${report.notGeneratable.join(', ')}.`);
  }
  lines.push('', '## Violations', '');
  if (report.violations.length === 0) lines.push('None.', '');
  for (const v of report.violations) {
    const c = cases.find((x) => x.id === v.case);
    lines.push(`### ${v.behavior} · ${v.subject} · ${v.kind} (${v.count} sequences)`, '');
    if (c) {
      lines.push(
        c.detail,
        '',
        '```text',
        ...c.steps,
        '```',
        '',
        `Expected at step ${c.step}: \`${clip(canonical(c.expected), 300)}\``,
        '',
        ...Object.entries(c.provenance).map(
          ([name, p]) => `- ${name}: ${p}${c.observed[name] === undefined ? '' : ` — \`${clip(canonical(c.observed[name]), 240)}\``}`
        ),
        '',
        `Case: \`cases/${c.id}.json\``,
        ''
      );
    }
  }
  if (report.determinism) lines.push(determinismMarkdown(report.determinism));
  return lines.join('\n');
}

function gateMarkdown(gate: GateResult): string[] {
  if (!gate.applied) return [`**Core gate:** not applied; \`${gate.subject}\` is not a subject of this run.`, ''];
  const awaiting = gate.awaitingPlugins.map((a) => `- ${a.behavior}: ${a.instances} instance(s), not floored until the core has ${a.plugin}`);
  if (gate.exitCode === 0) {
    const scope = gate.awaitingPlugins.length ? 'every property it can replay' : 'every property';
    return [`**Core gate:** passed; \`${gate.subject}\` holds ${scope} with at least ${gate.floor} instances of each.`, ...(awaiting.length ? ['', 'Waiting for plugins:', ...awaiting] : []), ''];
  }
  return [
    `**Core gate: failed** (exit ${gate.exitCode}).`,
    ...gate.violated.map((v) => `- ${v.behavior}: violated in ${v.sequences} sequence(s)`),
    ...gate.belowFloor.map((b) => `- ${b.behavior}: ${b.instances} instance(s), below the floor of ${gate.floor}`),
    ...(awaiting.length ? ['', 'Waiting for plugins:', ...awaiting] : []),
    '',
  ];
}

function determinismMarkdown(d: DeterminismReport): string {
  return `## Determinism\n\n${d.subject}: ${d.mismatches} mismatches in ${d.runs} sequences, seed ${d.seed}.\n`;
}
