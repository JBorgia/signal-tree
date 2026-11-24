import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FILE_LIMIT, MAX_CODEOWNERS_BYTES, changedPaths, cli, isPlainPath, ownedPaths, parseCodeowners } from './codeowners.mjs';

// The shared, fail-closed CODEOWNERS matcher (ci/codeowners.mjs), used by
// approve-non-owned.mjs and the unattended gh wrapper.

const script = new URL('./codeowners.mjs', import.meta.url).pathname;
const REAL = readFileSync(new URL('../.github/CODEOWNERS', import.meta.url), 'utf8');
const isOwned = (codeowners: string, path: string) => ownedPaths(codeowners, [path]).length === 1;

describe('the real .github/CODEOWNERS', () => {
  it('parses without a problem and gives every rule an owner', () => {
    const { rules, problems } = parseCodeowners(REAL);
    expect(problems).toEqual([]);
    expect(rules.length).toBe(REAL.split('\n').filter((line) => line.trim() !== '' && !line.trim().startsWith('#')).length);
    expect(rules.every((rule: { owners: string[] }) => rule.owners.length > 0)).toBe(true);
  });

  it.each([
    'BRIEF.md',
    'bench/budgets.json',
    'bench/scenarios/s8.ts',
    'tests/port-manifest.json',
    'tests/support/fixtures.ts',
    'tests/oracle/src/gate.ts',
    'ci/done-check.mjs',
    'ci/codeowners.mjs',
    'ci/unattended/bin/gh',
    '.github/CODEOWNERS',
    '.github/workflows/approve-non-owned.yml',
    'package.json',
    'eslint.config.mjs',
    'vitest.config.ts',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.nvmrc',
    '.npmrc',
    'tsconfig.base.json',
    'tsconfig.json',
  ])('owns %s', (path) => expect(isOwned(REAL, path)).toBe(true));

  it.each([
    'packages/core/src/index.ts',
    'packages/core/package.json',
    'packages/core/tsconfig.json',
    'packages/angular/src/ci/helper.ts',
    'packages/core/src/bench/marks.ts',
    'tests/spec/s8.spec.ts',
    // Ruling of 2026-11-24 on test tags: protected by spec-test-entries.yml instead.
    'tests/spec-tests.json',
    'tests/port-manifest.json.bak',
    'tests/supporting.md',
    'benchmarks/notes.md',
    'docs/ci/README.md',
    'README.md',
    'brief.md.orig',
  ])('does not own %s', (path) => expect(isOwned(REAL, path)).toBe(false));

  it('owns a case variant of an owned path, which a case-insensitive checkout would write over it', () => {
    expect(ownedPaths(REAL, ['CI/done-check.mjs', 'Bench/budgets.json', 'brief.md', '.GitHub/workflows/ci.yml', 'PACKAGE.JSON'])).toHaveLength(5);
  });
});

describe('patterns', () => {
  const owns = (pattern: string, path: string) => isOwned(`${pattern} @owner`, path);
  const cases: Array<[string, string[], string[]]> = [
    // pattern, owned, not owned
    ['/docs/', ['docs/a.md', 'docs/x/y/z.md'], ['docs', 'src/docs/a.md', 'docsx/a.md']],
    ['/BRIEF.md', ['BRIEF.md', 'BRIEF.md/inside'], ['x/BRIEF.md', 'BRIEF.mdx']],
    ['apps/', ['apps/a.ts', 'x/apps/a.ts', 'x/y/apps/z/a.ts'], ['apps', 'x/apps', 'appsx/a.ts']],
    ['logs', ['logs', 'logs/a', 'x/logs', 'x/y/logs/z'], ['logsx', 'x/blogs']],
    ['*.js', ['a.js', 'x/y/b.js', 'x.js/inner.txt'], ['a.jsx', 'a.ts']],
    ['/*.md', ['README.md'], ['docs/README.md']],
    ['docs/*', ['docs/a.md', 'x/docs/a.md'], ['docs/build/a.md', 'docs']],
    ['/docs/*/', ['docs/build/a.md'], ['docs/a.md']],
    ['?.ts', ['a.ts', 'x/b.ts'], ['ab.ts', '.ts']],
    ['**/logs', ['logs/a', 'build/logs/a', 'deeply/nested/logs/a'], ['logsa/b']],
    ['/apps/**', ['apps/a', 'apps/x/y'], ['apps', 'x/apps/a']],
    ['/a/**/b', ['a/b', 'a/x/b', 'a/x/y/b', 'a/x/b/c'], ['a/bb', 'x/a/b']],
    ['/a/**/**/b', ['a/b', 'a/x/y/b'], ['b']],
    ['**', ['a', 'a/b/c'], []],
    ['*', ['a', 'a/b/c', '.hidden'], []],
    ['/.github/', ['.github/workflows/ci.yml'], ['x/.github/a']],
    ['/a+b(c)$.md', ['a+b(c)$.md'], ['aab(c)$.md', 'a+b(c).md']],
  ];
  it.each(cases)('%s', (pattern, owned, unowned) => {
    for (const path of owned) expect(owns(pattern, path), `${pattern} owns ${path}`).toBe(true);
    for (const path of unowned) expect(owns(pattern, path), `${pattern} does not own ${path}`).toBe(false);
  });

  it('matches a pattern with a / only in the middle at any depth, the reading that owns more', () => {
    expect(owns('docs/build', 'docs/build/a.md')).toBe(true);
    expect(owns('docs/build', 'x/docs/build/a.md')).toBe(true);
  });
});

describe('rules', () => {
  it('skips comments, inline comments and blank lines, and accepts users, teams and emails as owners', () => {
    const text = '\uFEFF# a comment\r\n\r\n   \n  # indented comment\n/ci/ @JBorgia @org/team-name docs@example.com # inline comment\n';
    const { rules, problems } = parseCodeowners(text);
    expect(problems).toEqual([]);
    expect(rules.map((r: { pattern: string; owners: string[]; line: number }) => [r.line, r.pattern, r.owners])).toEqual([[5, '/ci/', ['@JBorgia', '@org/team-name', 'docs@example.com']]]);
  });

  it('lets the last matching rule decide, so a later rule without owners clears ownership', () => {
    const text = '/apps/ @octocat\n/apps/github\n';
    expect(ownedPaths(text, ['apps/a.ts', 'apps/github/b.ts', 'apps/github'])).toEqual(['apps/a.ts']);
    expect(ownedPaths('/apps/github\n/apps/ @octocat\n', ['apps/github/b.ts'])).toEqual(['apps/github/b.ts']);
    expect(ownedPaths('* @a\n*.md\n', ['a.ts', 'b.md'])).toEqual(['a.ts']);
    expect(ownedPaths('*.md\n', ['b.md'])).toEqual([]);
  });

  it('clears ownership only where an ownerless rule matches under every reading', () => {
    // docs/build may be anchored (gitignore) or not; at x/ it might not match, so * still owns it.
    expect(ownedPaths('* @a\ndocs/build\n', ['docs/build/a.md', 'x/docs/build/a.md'])).toEqual(['x/docs/build/a.md']);
    // An ownerless rule matches case-sensitively only.
    expect(ownedPaths('* @a\n/Docs/\n', ['Docs/a.md', 'docs/a.md'])).toEqual(['docs/a.md']);
  });

  it('owns nothing under an empty CODEOWNERS or one of comments only', () => {
    expect(ownedPaths('', ['ci/a.mjs'])).toEqual([]);
    expect(ownedPaths('# nothing here\n', ['ci/a.mjs'])).toEqual([]);
  });

  it('keeps the first order and drops repeats', () => {
    expect(ownedPaths(REAL, ['ci/b.mjs', 'README.md', 'BRIEF.md', 'ci/b.mjs'])).toEqual(['ci/b.mjs', 'BRIEF.md']);
  });
});

describe('fails closed', () => {
  const unparseable: Array<[string, RegExp]> = [
    ['!/ci/ @a', /negation/],
    ['/ci/[ab].mjs @a', /character classes/],
    ['/docs/\\#x @a', /escapes/],
    ['/a\\ b @a', /escapes/],
    ['/a**b @a', /whole path segment/],
    ['/a/**b/c @a', /whole path segment/],
    ['/a//b @a', /empty, \. or \.\. segment/],
    ['/a/../ci/ @a', /empty, \. or \.\. segment/],
    ['/ @a', /empty pattern/],
    ['/ci/ JBorgia', /owner "JBorgia"/],
    ['/ci/ @-bad', /owner "@-bad"/],
    ['/ci/ @a @@b', /owner "@@b"/],
  ];
  it.each(unparseable)('every file counts as owned when a line reads %s', (line, problem) => {
    const text = `/docs/ @docs\n${line}\n*.md\n`;
    const { problems } = parseCodeowners(text);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^line 2 /);
    expect(problems[0]).toMatch(problem);
    expect(ownedPaths(text, ['README.md', 'src/a.ts'])).toEqual(['README.md', 'src/a.ts']);
  });

  it('every file counts as owned when CODEOWNERS is over 3 MB or not text', () => {
    const big = `/ci/ @a\n${'#'.repeat(MAX_CODEOWNERS_BYTES)}\n`;
    expect(parseCodeowners(big).problems[0]).toContain('limit');
    expect(ownedPaths(big, ['README.md'])).toEqual(['README.md']);
    expect(ownedPaths(undefined, ['README.md'])).toEqual(['README.md']);
  });

  it('a path that is not plain counts as owned', () => {
    for (const path of ['', '/ci/a', 'a/', 'a//b', './a', 'a/../ci/x', 'a\nb', 7]) {
      expect(isPlainPath(path), JSON.stringify(path)).toBe(false);
      expect(ownedPaths('', [path])).toEqual([path]);
    }
    expect(isPlainPath('packages/core/src/index.ts')).toBe(true);
  });
});

describe('changed paths of a pull request', () => {
  const file = (filename: string, previous?: string) => (previous ? { filename, status: 'renamed', previous_filename: previous } : { filename, status: 'modified' });

  it('lists each file and the old path of a renamed one, from one array or gh --slurp pages', () => {
    const files = [file('docs/a.md'), file('src/new.ts', 'ci/old.mjs')];
    expect(changedPaths(files, 2)).toEqual(['docs/a.md', 'src/new.ts', 'ci/old.mjs']);
    expect(changedPaths([[files[0]], [files[1]]], 2)).toEqual(['docs/a.md', 'src/new.ts', 'ci/old.mjs']);
    expect(changedPaths([], 0)).toEqual([]);
  });

  it(`refuses more than ${FILE_LIMIT} files, an incomplete listing and malformed entries`, () => {
    const many = Array.from({ length: FILE_LIMIT }, (_, i) => file(`f${i}`));
    expect(changedPaths(many, FILE_LIMIT)).toHaveLength(FILE_LIMIT);
    expect(() => changedPaths(many, FILE_LIMIT + 1)).toThrow(`${FILE_LIMIT + 1} files changed; GitHub lists at most ${FILE_LIMIT}`);
    expect(() => changedPaths([file('a')], 2)).toThrow('GitHub listed 1 changed files of 2');
    expect(() => changedPaths([{ status: 'added' }], 1)).toThrow('has no filename');
    expect(() => changedPaths([{ filename: 'a', previous_filename: 3 }], 1)).toThrow('malformed previous_filename');
    expect(() => changedPaths({ message: 'Not Found' }, 1)).toThrow('not a list');
    expect(() => changedPaths([file('a')], Number.NaN)).toThrow('is not a number');
  });
});

describe('command line', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const inputs = (codeowners: string, files: unknown) => {
    const dir = mkdtempSync(join(tmpdir(), 'signal-tree-codeowners-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'CODEOWNERS'), codeowners);
    writeFileSync(join(dir, 'files.json'), JSON.stringify(files));
    return [join(dir, 'CODEOWNERS'), join(dir, 'files.json')];
  };
  const run = (...args: string[]) => spawnSync('node', [script, ...args], { encoding: 'utf8' });

  it('exits 0 with no output when nothing is owned', () => {
    const r = run('owned', ...inputs(REAL, [[{ filename: 'packages/core/src/index.ts' }]]), '1');
    expect([r.status, r.stdout, r.stderr]).toEqual([0, '', '']);
  });

  it('exits 1 and prints each owned path, the old path of a rename included', () => {
    const r = run('owned', ...inputs(REAL, [[{ filename: 'docs/x.mjs', previous_filename: 'ci/x.mjs' }, { filename: 'BRIEF.md' }, { filename: 'README.md' }]]), '3');
    expect([r.status, r.stdout]).toEqual([1, 'ci/x.mjs\nBRIEF.md\n']);
  });

  it('exits 1, owning every file and saying why, when CODEOWNERS has a line it cannot parse', () => {
    const r = run('owned', ...inputs('!/ci/ @a\n', [{ filename: 'README.md' }]), '1');
    expect([r.status, r.stdout]).toEqual([1, 'README.md\n']);
    expect(r.stderr).toContain('line 1 ("!/ci/"): negation');
  });

  it('exits 2 when it cannot decide: usage, unreadable input, a bad count or an incomplete listing', () => {
    const [codeowners, files] = inputs(REAL, [{ filename: 'README.md' }]);
    expect(run().status).toBe(2);
    expect(run('owned', codeowners, files).status).toBe(2);
    expect(run('owned', join(codeowners, 'missing'), files, '1').status).toBe(2);
    expect(run('owned', codeowners, files, 'null').status).toBe(2);
    const short = run('owned', codeowners, files, '2');
    expect(short.status).toBe(2);
    expect(short.stderr).toContain('GitHub listed 1 changed files of 2');
    const [, notJson] = inputs(REAL, []);
    writeFileSync(notJson, 'gh: Not Found (HTTP 404)');
    expect(run('owned', codeowners, notJson, '0').status).toBe(2);
  });

  it('runs in-process with the same results', () => {
    const out: string[] = [];
    const err: string[] = [];
    const status = cli(['owned', ...inputs(REAL, [{ filename: 'ci/a.mjs' }]), '1'], { out: (line: string) => out.push(line), err: (line: string) => err.push(line) });
    expect([status, out, err]).toEqual([1, ['ci/a.mjs'], []]);
  });
});
