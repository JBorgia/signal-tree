import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findAttribution } from './attribution.mjs';
import { attributionProblems, commitsBetween } from './no-attribution.mjs';
import { HOOKS_PATH, setup } from './setup.mjs';

// The forms below are assembled from parts so this file never carries them whole.
const CO = 'Co-Authored-By:';
const forms = [
  `${CO} Claude Opus 5 <noreply@anthropic.com>`,
  `${CO} Claude Opus 5 (1M context) <noreply@anthropic.com>`,
  `${CO} Claude Opus 4.7 (1M context) <noreply@anthropic.com>`,
  `${CO} Claude Sonnet 4.6 <noreply@anthropic.com>`,
  `co-authored-by: claude <noreply@anthropic.com>`,
  `🤖 Generated with [Claude ${'Code'}](https://claude.com/claude-code)`,
  `Generated with Claude ${'Code'}`,
  `https://claude.ai/code/session_${'01ABCdef'}`,
  `Session: https://claude.ai/chat/${'4f1c'}`,
  `https://claude.ai/share/${'abc'}`,
];

describe('attribution patterns', () => {
  it.each(forms)('find %s', (line) => {
    expect(findAttribution(`fix: a thing\n\nBody.\n\n${line}\n`)).toHaveLength(1);
  });

  it.each([
    `${CO} Michael Rentmeister <mike@example.com>`,
    'Ask Claude to review the reducer.',
    'See https://claude.com/product for the model card.',
    'docs: mention the Claude Code CLI in the setup guide',
  ])('leave %s alone', (line) => {
    expect(findAttribution(line)).toEqual([]);
  });
});

describe('commit-msg hook', () => {
  const hook = new URL(`../${HOOKS_PATH}/commit-msg`, import.meta.url).pathname;
  const runHook = (message: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'signal-tree-hook-'));
    try {
      const file = join(dir, 'COMMIT_EDITMSG');
      writeFileSync(file, message);
      return spawnSync('node', [hook, file], { encoding: 'utf8' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it.each(forms)('rejects a message carrying %s', (line) => {
    const run = runHook(`feat: add a thing\n\n${line}\n`);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Commit rejected');
  });

  it('accepts a clean message and ignores git comment lines', () => {
    expect(runHook(`feat: add a thing\n\nWhy it matters.\n# ${forms[0]}\n`).status).toBe(0);
  });

  it('is installed by the setup script that pnpm install runs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'signal-tree-setup-'));
    try {
      spawnSync('git', ['init', '-q', dir]);
      expect(setup(dir)).toBe(true);
      expect(spawnSync('git', ['-C', dir, 'config', 'core.hooksPath'], { encoding: 'utf8' }).stdout.trim()).toBe(HOOKS_PATH);
      const outside = mkdtempSync(join(tmpdir(), 'signal-tree-nogit-'));
      expect(setup(outside)).toBe(false);
      rmSync(outside, { recursive: true, force: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('required PR check', () => {
  const repo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'signal-tree-pr-'));
    const git = (...args: string[]) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8' });
    git('init', '-q');
    git('commit', '-q', '--allow-empty', '-m', 'base');
    const base = git('rev-parse', 'HEAD').stdout.trim();
    return { dir, git, base };
  };

  it('fails on a commit carrying attribution, naming the commit', () => {
    const { dir, git, base } = repo();
    try {
      git('commit', '-q', '--allow-empty', '-m', 'feat: clean');
      git('commit', '-q', '--allow-empty', '-m', `fix: thing\n\n${forms[0]}`);
      const head = git('rev-parse', 'HEAD').stdout.trim();
      const problems = attributionProblems(commitsBetween(base, head, dir), '');
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(head.slice(0, 9));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails on a description carrying attribution', () => {
    expect(attributionProblems([], `Summary\n\n${forms[5]}\n`)).toEqual([expect.stringContaining('pull request description line 3')]);
  });

  it('passes clean commits and a clean description', () => {
    const { dir, git, base } = repo();
    try {
      git('commit', '-q', '--allow-empty', '-m', 'feat: clean\n\nBody.');
      const head = git('rev-parse', 'HEAD').stdout.trim();
      expect(attributionProblems(commitsBetween(base, head, dir), 'A plain description.')).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
