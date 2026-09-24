// A separate Node process gives this regression real GC without a skipped test
// or a requirement to change the normal Vitest worker flags.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { expect, it } from 'vitest';

it('escaped fields release destroyed owners while live batching and retired-field collection survive', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'batching-detachment-'));
  try {
    const output = join(scratch, 'probe.mjs');
    buildSync({
      stdin: {
        resolveDir: dirname(fileURLToPath(import.meta.url)),
        contents: `
          import { signalTree, entityMap, leaf } from '../../index';
          import { batching } from './batching';
          import { getPathNotifier } from '../../lib/path-notifier';
          const collect = async () => {
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 5));
              globalThis.gc();
            }
          };
          const held = [];
          const released = [];
          for (const enabled of [false, true]) {
            const refs = (() => {
              const tree = signalTree({ rows: entityMap(), unrelated: leaf({ buffer: new ArrayBuffer(1024 * 1024) }) }, { enhancers: enabled ? [batching()] : [] });
              tree.$.rows.addOne({id: 'r', x: 0});
              const field = tree.$.rows.byIdOrFail('r').x;
              field();
              held.push(field);
              const refs = [new WeakRef(tree), new WeakRef(tree.$.unrelated())];
              tree.destroy();
              return refs;
            })();
            getPathNotifier()?.flushSync();
            await collect();
            released.push(refs.every(ref => ref.deref() === undefined));
          }
          const tree = signalTree({ rows: entityMap() }, { enhancers: [batching()] });
          const retired = (() => {
            const refs = [];
            for (let i = 0; i < 40; i++) {
              tree.$.rows.addOne({id: String(i), x: 0});
              const field = tree.$.rows.byIdOrFail(String(i)).x;
              field(); refs.push(new WeakRef(field));
              tree.$.rows.removeOne(String(i));
            }
            return refs;
          })();
          tree.$.rows.addOne({id: 'live', x: 0});
          const live = tree.$.rows.byIdOrFail('live').x;
          getPathNotifier()?.flushSync();
          await collect();
          let inside;
          tree.coalesce(() => { live(1); live(2); inside = live(); });
          const result = { released, retired: retired.filter(ref => ref.deref()).length, inside, after: live(), held: held.map(field => typeof field) };
          tree.destroy();
          console.log(JSON.stringify(result));
        `,
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: output,
      define: { ngDevMode: 'true', __DEV__: 'true' },
    });
    const result = JSON.parse(
      execFileSync(process.execPath, ['--expose-gc', output], {
        encoding: 'utf8',
      }).trim()
    );
    expect(result).toEqual({
      released: [true, true],
      retired: 0,
      inside: 0,
      after: 2,
      held: ['function', 'function'],
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}, 15000);
