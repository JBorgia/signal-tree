// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Fresh Node subprocess per case: the test runner cannot accidentally hold a
// raw record, reader snapshot, or a WeakRef target across collection jobs.
const fixture = fileURLToPath(
  new URL('./confirmed-destroy.gc.ts', import.meta.url)
);
const child = `
const {buildSync}=require('esbuild');
const {execFileSync}=require('node:child_process');
const code=buildSync({entryPoints:[process.argv[1]],bundle:true,write:false,platform:'node',format:'esm',target:'node24'}).outputFiles[0].text;
const suffix='\\nconsole.log(JSON.stringify(await run('+JSON.stringify(process.argv[2])+')));';
process.stdout.write(execFileSync(process.execPath,['--expose-gc','--input-type=module','-e',code+suffix],{encoding:'utf8'}));
`;

describe('confirmed record ownership ends at destroy', () => {
  it.each(['destroyed', 'live', 'external', 'raw-snapshot', 'reader-snapshot'])(
    '%s preserves only legitimate payload owners',
    (mode) => {
      const result = JSON.parse(
        execFileSync(process.execPath, ['-e', child, fixture, mode], {
          encoding: 'utf8',
        })
      );
      expect(result.retained).toBe(
        ['live', 'raw-snapshot', 'reader-snapshot'].includes(mode)
      );
      expect(result.before).toBe(mode === 'external' ? 0 : 2);
      expect(result.after).toBe(mode === 'live' ? 2 : 0);
      expect(result.refusal).toBe(mode !== 'live');
      if (mode.endsWith('snapshot')) expect(result.callerCount).toBe(2);
    },
    20000
  );
});
