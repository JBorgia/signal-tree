import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PRODUCTION_DEFINE = {
  ngDevMode: 'false',
  'process.env.NODE_ENV': '"production"',
};

const canon = (v) =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === 'object'
    ? Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, canon(v[k])])
      )
    : v;

/** Execute the exact measured browser bytes in Node; no second build with different settings. */
export function verifyBundle(
  bytes,
  { directory, name, expected, preloads = ['@angular/compiler'] }
) {
  const bundle = join(directory, `${name}.verify.mjs`);
  const runner = join(directory, `${name}.run.mjs`);
  writeFileSync(bundle, bytes);
  writeFileSync(
    runner,
    `
globalThis.ngDevMode = false;
${preloads.map((spec) => `await import(${JSON.stringify(spec)});`).join('\n')}
await import(${JSON.stringify(pathToFileURL(bundle).href)});
if (globalThis.__done) await globalThis.__done;
if (globalThis.__result === undefined) throw new Error('fixture did not set __result');
process.stdout.write('\\n@@RESULT@@' + JSON.stringify(globalThis.__result));
`
  );
  const out = execFileSync(process.execPath, [runner], {
    cwd: directory,
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });
  const marker = out.lastIndexOf('@@RESULT@@');
  if (marker < 0) throw new Error('no result marker in output');
  const got = JSON.parse(out.slice(marker + '@@RESULT@@'.length));
  if (JSON.stringify(canon(got)) !== JSON.stringify(canon(expected)))
    throw new Error(
      `result mismatch: got ${JSON.stringify(got)}, expected ${JSON.stringify(
        expected
      )}`
    );
  return got;
}
