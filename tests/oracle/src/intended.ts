// tests/intended-differences.json: the differences Jonathan has ruled
// intended. The runner validates the file against this schema and refuses to
// run on an invalid one.
//
// {
//   "differences": [
//     {
//       "subjects": ["v15", "v16"],          // the two subjects, any order
//       "pattern": "rollback",               // operation pattern (optional)
//       "field": "result.error.causeKind",   // outcome field (optional)
//       "reason": "why this difference is intended"
//     }
//   ]
// }
//
// An entry needs `pattern`, `field` or both; an omitted one matches anything.
// `*` in either is a wildcard (e.g. "result.error.*"). Keys other than these
// (and a top-level "$comment") are rejected.
import { readFileSync } from 'node:fs';

export interface IntendedDifference {
  readonly subjects: readonly [string, string];
  readonly pattern?: string;
  readonly field?: string;
  readonly reason: string;
}

export class IntendedDifferencesError extends Error {
  constructor(
    readonly file: string,
    readonly problems: readonly string[]
  ) {
    super(`${file} is invalid:\n  ${problems.join('\n  ')}`);
  }
}

const ENTRY_KEYS = new Set(['subjects', 'pattern', 'field', 'reason']);
const TOP_KEYS = new Set(['$comment', 'differences']);

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Returns the problems with `data`, or an empty list when it is valid. */
export function validateIntended(data: unknown): string[] {
  const problems: string[] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['top level must be an object'];
  for (const key of Object.keys(data)) if (!TOP_KEYS.has(key)) problems.push(`unknown top-level key "${key}"`);
  const list = (data as Record<string, unknown>)['differences'];
  if (!Array.isArray(list)) return [...problems, '"differences" must be an array'];
  list.forEach((entry: unknown, i) => {
    const at = `differences[${i}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`${at} must be an object`);
      return;
    }
    const e = entry as Record<string, unknown>;
    for (const key of Object.keys(e)) if (!ENTRY_KEYS.has(key)) problems.push(`${at}: unknown key "${key}"`);
    const subjects = e['subjects'];
    if (
      !Array.isArray(subjects) ||
      subjects.length !== 2 ||
      !subjects.every(nonEmpty) ||
      subjects[0] === subjects[1]
    ) {
      problems.push(`${at}.subjects must name two different subjects`);
    }
    for (const key of ['pattern', 'field'] as const) {
      if (key in e && !nonEmpty(e[key])) problems.push(`${at}.${key} must be a non-empty string when present`);
    }
    if (!('pattern' in e) && !('field' in e)) problems.push(`${at} must name a pattern, a field or both`);
    if (!nonEmpty(e['reason'])) problems.push(`${at}.reason must be a non-empty string`);
  });
  return problems;
}

export function loadIntended(file: string): IntendedDifference[] {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new IntendedDifferencesError(file, [`cannot read JSON: ${(error as Error).message}`]);
  }
  const problems = validateIntended(data);
  if (problems.length) throw new IntendedDifferencesError(file, problems);
  return (data as { differences: IntendedDifference[] }).differences;
}

const globToRegExp = (glob: string): RegExp =>
  new RegExp(`^${glob.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

/** Builds the coverage test for one subject pair. */
export function coverage(
  entries: readonly IntendedDifference[],
  a: string,
  b: string
): (pattern: string, field: string) => IntendedDifference | undefined {
  const relevant = entries
    .filter((e) => (e.subjects[0] === a && e.subjects[1] === b) || (e.subjects[0] === b && e.subjects[1] === a))
    .map((e) => ({
      entry: e,
      pattern: e.pattern === undefined ? undefined : globToRegExp(e.pattern),
      field: e.field === undefined ? undefined : globToRegExp(e.field),
    }));
  return (pattern, field) =>
    relevant.find((r) => (!r.pattern || r.pattern.test(pattern)) && (!r.field || r.field.test(field)))?.entry;
}
