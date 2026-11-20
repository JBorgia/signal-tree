// Writes the spec report (JSON for tools, Markdown for reading) and the
// candidate cases under out/. Nothing under out/ is committed (BRIEF.md 6.1).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BehaviorId } from './behaviors/types.js';
import type { DeterminismResult } from './determinism.js';
import type { GenerateResult, SpecCase } from './generator.js';
import { canonical } from './trace.js';

export interface BehaviorReport {
  readonly generatable: boolean;
  readonly reason?: string;
  /** Sequences in which the behavior applied on at least one subject. */
  readonly exercised: number;
  readonly holds: Readonly<Record<string, number>>;
  readonly violates: Readonly<Record<string, number>>;
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
  readonly behaviors: Readonly<Record<BehaviorId, BehaviorReport>>;
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
  const behaviors = {} as Record<BehaviorId, BehaviorReport>;
  for (const entry of result.catalog) {
    const stats = result.stats.get(entry.id);
    const { reason } = entry;
    behaviors[entry.id] = {
      generatable: entry.generatable,
      ...(reason ? { reason } : {}),
      exercised: stats?.exercised ?? 0,
      holds: stats ? { ...stats.holds } : zeros(),
      violates: stats ? { ...stats.violates } : zeros(),
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
    behaviors,
    violations: result.groups.map((g) => ({ ...g })),
    cases: result.cases.map((c) => c.id),
  };
}

/** Writes spec-report.json, spec-report.md and cases/<id>.json, replacing earlier cases. */
export function writeSpecReport(dir: string, result: GenerateResult): { json: string; markdown: string; cases: string } {
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
  return { json, markdown, cases: casesDir };
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
  const lines = [
    '# Spec report',
    '',
    `${report.runs} sequences, seed ${report.seed}, plugins ${report.plugins}, at most ${report.maxSteps} steps.`,
    `Subjects: ${report.subjects.map((s) => `${s.name} (${s.description})`).join(', ')}.`,
    `Generation ${(report.timing.generateMs / 1000).toFixed(1)} s, minimization ${(report.timing.shrinkMs / 1000).toFixed(1)} s.`,
    '',
    'Expected outcomes come from each behavior\'s BRIEF.md row. A subject violates a behavior when it',
    'disagrees with the row; counts are sequences. Cases are under `cases/`.',
    '',
    `| ID | Exercised | ${names.map((n) => `${n} holds | ${n} violates`).join(' | ')} | Notes |`,
    `| --- | --- | ${names.map(() => '--- | ---').join(' | ')} | --- |`,
  ];
  for (const [id, b] of Object.entries(report.behaviors)) {
    const counts = names.map((n) => (b.generatable ? `${b.holds[n] ?? 0} | ${b.violates[n] ?? 0}` : '– | –')).join(' | ');
    const note = b.generatable ? (b.reason ? `partial: ${b.reason}` : '') : `not generated: ${b.reason}`;
    lines.push(`| ${id} | ${b.generatable ? b.exercised : '–'} | ${counts} | ${cell(clip(note, 160))} |`);
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

function determinismMarkdown(d: DeterminismReport): string {
  return `## Determinism\n\n${d.subject}: ${d.mismatches} mismatches in ${d.runs} sequences, seed ${d.seed}.\n`;
}
