import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Exercise the real checker and git inventory, not a copied classifier regexp.
const checker = fileURLToPath(new URL('./check-source-controls.mjs', import.meta.url));
function checkFile(name, bytes, args = []) {
  const cwd = mkdtempSync(join(tmpdir(), 'source-controls-classification-'));
  try {
    for (const args of [['init', '--quiet'], ['config', 'core.autocrlf', 'false']]) {
      const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const target = join(cwd, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    const added = spawnSync('git', ['add', '--', name], { cwd, encoding: 'utf8' });
    assert.equal(added.status, 0, added.stderr);
    return spawnSync(process.execPath, [checker, ...args], { cwd, encoding: 'utf8' });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

for (const name of ['evidence.heapsnapshot.xz', 'evidence.XZ', 'evidence.tar.gz', 'image.png']) {
  test(`binary suffix excludes ${name} from text scanning`, () => {
    const result = checkFile(name, Buffer.from([0, 1, 127]));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /no unexpected control characters in 0 tracked files/);
  });
}

for (const name of ['source.ts', 'README.md', 'evidence.xz.ts', 'evidence.XZ.md', 'evidence.xz/source.ts', 'unknown.format', 'no-extension']) {
  test(`text NUL remains rejected in ${name}`, () => {
    const result = checkFile(name, Buffer.from('text\0\n'));
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.ok(result.stderr.includes(`${name}:1  NUL`), result.stderr);
    assert.match(result.stderr, /1 unexpected control character/);
  });
}

test('ordinary text with TAB/LF/CR is still scanned and accepted', () => {
  const result = checkFile('source.ts', Buffer.from('const a = 1;\n\tconst b = 2;\r\n'));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no unexpected control characters in 1 tracked files/);
});

test('existing byte-level positive control remains effective', () => {
  const result = checkFile('source.ts', Buffer.from('const a = 1;\n'), ['--self-test']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /detector finds a planted NUL and accepts TAB\/LF\/CR/);
});
