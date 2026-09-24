import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'benchmark-detail-test-'));
const out = join(dir, 'handler.mjs');
await build({
  entryPoints: ['api/realistic-benchmark/[id].ts'],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const handler = (await import(pathToFileURL(out).href)).default;
after(() => rm(dir, { recursive: true, force: true }));
const id = 'a'.repeat(32);
const file = `https://gist.githubusercontent.com/JBorgia/${id}/raw/result.json`;
const valid = {
  owner: { login: 'JBorgia' },
  description: 'SignalTree Realistic Benchmark: control',
  files: { 'realistic-benchmark-control.json': { raw_url: file } },
};

async function run(gist, requestedId = id) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => (calls.length === 1 ? gist : { value: 7 }),
    };
  };
  const response = {
    code: 0,
    body: undefined,
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  try {
    await handler({ method: 'GET', query: { id: requestedId } }, response);
    return { ...response, calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('serves an owned benchmark', async () => {
  const result = await run(valid);
  assert.equal(result.code, 200);
  assert.equal(result.calls.length, 2);
});
for (const [name, overrides] of [
  ['foreign owner', { owner: { login: 'someone-else' } }],
  ['unrelated description', { description: 'Personal notes' }],
  ['missing owner', { owner: undefined }],
  ['unrelated file', { files: { 'notes.json': { raw_url: file } } }],
  [
    'foreign content host',
    {
      files: {
        'realistic-benchmark-control.json': {
          raw_url: 'https://example.com/private',
        },
      },
    },
  ],
])
  test(`refuses ${name} before fetching content`, async () => {
    const result = await run({ ...valid, ...overrides });
    assert.equal(result.code, 404);
    assert.equal(result.calls.length, 1);
  });
for (const bad of ['../user', 'a?token=123', ['a']])
  test(`refuses invalid id ${JSON.stringify(bad)}`, async () => {
    const result = await run(valid, bad);
    assert.equal(result.code, 400);
    assert.equal(result.calls.length, 0);
  });
