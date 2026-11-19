// Writes the difference list (JSON for tools, Markdown for reading) under out/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonical, type FieldDiff } from './compare.js';
import { formatSequence, type Json, type Outcome } from './model.js';
import type { DifferenceGroup, OracleResult } from './oracle.js';

const clip = (text: string, max = 160) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function describeOutcome(outcome: Outcome): string {
  switch (outcome.status) {
    case 'ok':
      return outcome.value === undefined ? 'ok' : `ok ${clip(canonical(outcome.value), 80)}`;
    case 'error': {
      const e = outcome.error;
      const tags = [e.causeKind, e.st, e.reason && `${e.stage}/${e.reason}`].filter(Boolean).join(', ');
      return `throws ${e.class}${tags ? ` (${tags})` : `: ${clip(e.message, 70)}`}`;
    }
    case 'unsupported':
      return 'unsupported';
    case 'skipped':
      return `skipped (${outcome.detail})`;
  }
}

/** What each side did, for the group's primary field. */
export function sides(group: DifferenceGroup): [string, string] {
  const d = group.example.divergence;
  const field = d.primary.field;
  if (field.startsWith('result.') && field !== 'result.error.message' && field !== 'result.value') {
    return [describeOutcome(d.aOutcome), describeOutcome(d.bOutcome)];
  }
  return [clip(show(d.primary.a)), clip(show(d.primary.b))];
}

const show = (value: Json): string => (typeof value === 'string' ? value : canonical(value));

export interface ReportContext {
  readonly aDescription: string;
  readonly bDescription: string;
  readonly authority?: string;
  /** Command replaying a fast-check path. */
  readonly replayCommand: (path: string) => string;
  /** Command replaying group n's minimal sequence from the JSON report. */
  readonly replayGroupCommand: (group: number) => string;
}

export function writeReport(dir: string, result: OracleResult, ctx: ReportContext): { json: string; markdown: string } {
  mkdirSync(dir, { recursive: true });
  const base = join(dir, `${result.a}-vs-${result.b}`);
  const json = `${base}.json`;
  const markdown = `${base}.md`;
  writeFileSync(json, `${JSON.stringify(toJsonReport(result, ctx), null, 2)}\n`);
  writeFileSync(markdown, toMarkdown(result, ctx));
  return { json, markdown };
}

function toJsonReport(result: OracleResult, ctx: ReportContext) {
  return {
    a: { name: result.a, description: ctx.aDescription },
    b: { name: result.b, description: ctx.bDescription },
    authority: ctx.authority ?? null,
    runs: result.runs,
    seed: result.seed,
    plugins: result.plugins,
    maxSteps: result.maxSteps,
    compareMs: Math.round(result.compareMs),
    shrinkMs: Math.round(result.shrinkMs),
    uncoveredGroups: result.groups.length,
    uncoveredRuns: result.groups.reduce((sum, g) => sum + g.count, 0),
    coveredRuns: result.coveredRuns,
    coveredKeys: Object.fromEntries(result.coveredKeys),
    groups: result.groups.map((g, i) => {
      const [aSide, bSide] = sides(g);
      const d = g.example.divergence;
      return {
        key: g.key,
        pattern: g.pattern,
        field: g.field,
        count: g.count,
        firstRun: g.firstRun,
        [result.a]: aSide,
        [result.b]: bSide,
        example: {
          seed: g.example.seed,
          path: g.example.path,
          shrunk: g.example.shrunk,
          shrinks: g.example.shrinkRuns,
          fastCheckSteps: g.example.fastCheckSteps,
          replay: ctx.replayGroupCommand(i + 1),
          replayFastCheckPath: ctx.replayCommand(g.example.path),
          steps: formatSequence(g.example.sequence),
          divergesAtStep: d.step,
          fields: d.fields.map((f: FieldDiff) => ({ field: f.field, [result.a]: f.a, [result.b]: f.b })),
          outcomes: { [result.a]: d.aOutcome, [result.b]: d.bOutcome },
          sequence: g.example.sequence,
        },
      };
    }),
  };
}

function toMarkdown(result: OracleResult, ctx: ReportContext): string {
  const { a, b } = result;
  const label = (name: string) => (ctx.authority === name ? `${name} (authority)` : name);
  const lines: string[] = [
    `# Oracle differences: ${a} vs ${b}`,
    '',
    `- ${a}: ${ctx.aDescription}`,
    `- ${b}: ${ctx.bDescription}`,
    ...(ctx.authority ? [`- Authority where it covers a behavior: ${ctx.authority}`] : []),
    `- Sequences: ${result.runs}, seed ${result.seed}, plugins ${result.plugins}, at most ${result.maxSteps} steps`,
    `- Compare: ${(result.compareMs / 1000).toFixed(1)} s; shrink: ${(result.shrinkMs / 1000).toFixed(1)} s`,
    `- Sequences with an unlisted difference: ${result.groups.reduce((s, g) => s + g.count, 0)} in ${result.groups.length} groups`,
    `- Sequences whose differences were all listed as intended: ${result.coveredRuns}`,
    '',
    'Each sequence is counted once, in the group of its first unlisted difference (operation pattern,',
    'highest-priority differing field and, for vocabulary fields, both values). Later steps are not',
    'compared because state may already have diverged.',
    '',
  ];
  if (result.groups.length === 0) {
    lines.push('No unlisted differences.', '');
    return lines.join('\n');
  }
  lines.push(`| # | Pattern | Field | ${label(a)} | ${label(b)} | Count |`, '| --- | --- | --- | --- | --- | --- |');
  result.groups.forEach((g, i) => {
    const [aSide, bSide] = sides(g);
    lines.push(`| ${i + 1} | \`${g.pattern}\` | \`${g.field}\` | ${cell(aSide)} | ${cell(bSide)} | ${g.count} |`);
  });
  lines.push('', '### By field', '', 'One cause often surfaces under several operation patterns; this rolls the groups up by field.', '');
  lines.push('| Field | Groups | Sequences | Patterns |', '| --- | --- | --- | --- |');
  const byField = new Map<string, DifferenceGroup[]>();
  for (const g of result.groups) byField.set(g.field, [...(byField.get(g.field) ?? []), g]);
  for (const [field, groups] of [...byField].sort((x, y) => total(y[1]) - total(x[1]))) {
    const patterns = [...new Set(groups.map((g) => g.pattern))];
    lines.push(`| \`${field}\` | ${groups.length} | ${total(groups)} | ${cell(clip(patterns.join(', '), 200))} |`);
  }
  lines.push('');
  result.groups.forEach((g, i) => {
    const d = g.example.divergence;
    lines.push(
      `## ${i + 1}. \`${g.pattern}\` · \`${g.field}\``,
      '',
      `${g.count} sequences. Minimal example (diverges at step ${d.step}):`,
      '',
      '```text',
      ...formatSequence(g.example.sequence),
      '```',
      '',
      `Seed ${g.example.seed}, fast-check path \`${g.example.path}\`${g.example.shrunk ? ` (${g.example.shrinkRuns} shrinks` : ' (not shrunk'}, ${g.example.fastCheckSteps} steps before trimming).`,
      '',
      `Replay: \`${ctx.replayGroupCommand(i + 1)}\``,
      '',
      `| Field | ${label(a)} | ${label(b)} |`,
      '| --- | --- | --- |',
      ...d.fields.map((f) => `| \`${f.field}\` | ${cell(clip(show(f.a), 200))} | ${cell(clip(show(f.b), 200))} |`),
      '',
      `Step ${d.step} outcome: ${a} ${cell(describeOutcome(d.aOutcome))}; ${b} ${cell(describeOutcome(d.bOutcome))}.`,
      ''
    );
  });
  return lines.join('\n');
}

const total = (groups: readonly DifferenceGroup[]) => groups.reduce((sum, g) => sum + g.count, 0);

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
