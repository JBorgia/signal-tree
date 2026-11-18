const assert = require('node:assert/strict');
const { test } = require('node:test');
const { resolveDemoSourceRef } = require('./demo-source-ref.cjs');

const source = '1234567890abcdef1234567890abcdef12345678';
const other = 'abcdef1234567890abcdef1234567890abcdef12';

test('a hosted preview uses its commit even when the archive has no Git metadata', () => {
  assert.equal(resolveDemoSourceRef({ hostedCommit: source }), source);
});

test('candidate and published-tag checkouts use the exact HEAD without inventing a tag', () => {
  assert.equal(resolveDemoSourceRef({ gitHead: source }), source);
  assert.equal(
    resolveDemoSourceRef({ hostedCommit: source, gitHead: source }),
    source
  );
});

test('matching commit identities are normalized and mismatches reject', () => {
  assert.equal(
    resolveDemoSourceRef({
      hostedCommit: source.toUpperCase(),
      gitHead: source,
    }),
    source
  );
  assert.throws(
    () => resolveDemoSourceRef({ hostedCommit: other, gitHead: source }),
    /disagree/
  );
});

test('absent, truncated, tag-shaped and URL-shaped identities cannot become misleading links', () => {
  assert.throws(() => resolveDemoSourceRef({}), /Cannot identify/);
  for (const bad of [
    '',
    '1234567',
    'v15.4.9',
    '../main',
    'https://example.com',
  ]) {
    assert.throws(
      () => resolveDemoSourceRef({ hostedCommit: bad, gitHead: source }),
      /complete Git commit/
    );
    assert.throws(
      () => resolveDemoSourceRef({ gitHead: bad }),
      /complete Git commit/
    );
  }
});

test('every Angular entry target generates source identity and deep-typing fixtures before compilation', () => {
  const project = require('../apps/demo/project.json');
  for (const name of ['build', 'serve', 'serve-static', 'extract-i18n', 'test']) {
    for (const required of [
      'generate-versions',
      'generate-deep-typing-proofs',
    ]) {
      assert(
        project.targets[name].dependsOn?.includes(required),
        `${name} requires ${required}`
      );
    }
  }
});
