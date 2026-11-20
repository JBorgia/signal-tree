import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BEHAVIOR_IDS, behaviorIdPattern } from './behavior-ids.mjs';
import { repoRoot } from './entry-graph.mjs';

/** The IDs in the first column of the tables under one BRIEF.md heading. */
function tableIds(brief: string, heading: string): string[] {
  const start = brief.indexOf(`\n${heading}`);
  expect(start, heading).toBeGreaterThan(-1);
  const rest = brief.slice(start + heading.length + 1);
  const end = rest.search(/\n#{2,3} /);
  const section = end === -1 ? rest : rest.slice(0, end);
  return [...section.matchAll(/^\| ([A-Z]\d+) \|/gm)].map((m) => m[1]!);
}

describe('behavior IDs', () => {
  const brief = readFileSync(join(repoRoot, 'BRIEF.md'), 'utf8');

  it('are exactly the rows of BRIEF.md 5.1, 5.2, 12.4 and 12.5, in table order', () => {
    expect(BEHAVIOR_IDS).toEqual([...tableIds(brief, '### 5.1 '), ...tableIds(brief, '### 5.2 '), ...tableIds(brief, '### 12.4 '), ...tableIds(brief, '### 12.5 ')]);
  });

  it('match in titles without reading T10 as T1', () => {
    const found = [...'[T10][T1][T13][O4][X3][W5][H1][D2][V8][F1] [T14] [Q1]'.matchAll(behaviorIdPattern())].map((m) => m[1]);
    expect(found).toEqual(['T10', 'T1', 'T13', 'O4', 'X3', 'W5', 'H1', 'D2', 'V8', 'F1']);
  });
});
