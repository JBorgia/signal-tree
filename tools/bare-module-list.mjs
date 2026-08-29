import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

/**
 * The bare-module SUBJECT IDENTITY, exported so its control tests this code
 * rather than a copy of it.
 *
 *     IF A PATH WAS REQUIRED TO DISAMBIGUATE THE SUBJECT, THE PATH MUST
 *     PARTICIPATE IN THE SUBJECT'S IDENTITY.
 *
 * A basename scheme collapsed `lib/constants.ts` with
 * `enhancers/serialization/constants.ts`, and the package barrel with
 * `lib/markers/index.ts`. That today's bundle happens to contain only one of
 * each pair does not make the scheme valid.
 */
export function normalizeBareSubject(p) {
  return p
    .replace(/^.*dist\/packages\/core\/dist\//, () => (/\/shared\//.test(p) ? '' : 'core/'))
    .replace(/^shared\//, 'shared/')
    .replace(/\.js$/, '.ts');
}

/** True for the synthetic entry this file writes; never a subject. */
export function isProbeEntry(p) {
  return p.includes('/bml-') || /(^|\/)b\.js$/.test(p);
}

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join, basename } from 'node:path';
// ⚠️ THE BUNDLE ONLY RUNS WHEN THIS FILE IS THE ENTRY POINT. Its identity
// helpers above are imported by the control that defends them, and importing a
// module must not trigger an esbuild run as a side effect.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
  const CORE = `${ROOT}/dist/packages/kernel/dist/index.js`;
  const d = mkdtempSync(join(tmpdir(), 'bml-')); const e = join(d, 'b.js');
  writeFileSync(e, `import { signalTree } from ${JSON.stringify(CORE)};
  const t = signalTree({ a: 0, u: { n: 'x' } }); t.$.a.set(1); globalThis.__s=[t.$.a(),t.$.u.n()];`, 'utf8');
  const o = await build({ entryPoints: [e], bundle: true, minify: true, format: 'esm',
    platform: 'browser', treeShaking: true, external: ['@angular/*','rxjs','rxjs/*','tslib'],
    nodePaths: [`${ROOT}/node_modules`], write: false, legalComments: 'none', logLevel: 'silent',
    define: { ngDevMode: 'false' }, metafile: true });
  const inputs = Object.values(o.metafile.outputs)[0].inputs;
  // ⚠️ EMIT THE PATH, NOT JUST THE BASENAME. Reporting `basename(p)` made two
  // bare modules unresolvable — `constants.js` could be `lib/constants.ts` or
  // `enhancers/serialization/constants.ts`, and `index.js` could be the package
  // barrel or `lib/markers/index.ts`. Ownership cannot be joined to a subject
  // through a name that two subjects share, and the synthetic probe entry this
  // file writes was itself reported as a mysterious module called `b.js`.
  //
  //     JOIN BY SUBJECT IDENTITY, NOT BY RESEMBLANCE — a basename is a
  //     resemblance.
  console.log(JSON.stringify(Object.entries(inputs)
    // ⚠️ THE PROBE'S OWN ENTRY IS NOT A SUBJECT. This file writes a synthetic
    // entry module and bundles from it; esbuild reported it back as a module
    // called `b.js`, which entered the ownership census as a phantom
    // bare-reachable subject with no source and no owner. A measurement harness
    // must not appear in its own measurement.
    .filter(([p]) => !isProbeEntry(p))
    .filter(([, v]) => v.bytesInOutput > 0)
    .map(([p, v]) => ({
      module: basename(p),
      path: p,
      // ⚠️ THE SUBJECT IDENTITY, and it is deliberately NOT the basename.
      //
      //     IF A PATH WAS REQUIRED TO DISAMBIGUATE THE SUBJECT, THE PATH MUST
      //     PARTICIPATE IN THE SUBJECT'S IDENTITY.
      //
      // `constants.js` and `index.js` each resolved to two different source
      // files. That today's bundle happens to contain only one of each does not
      // make a basename key valid:
      //
      //     A UNIQUE RESULT IN TODAY'S BUNDLE DOES NOT MAKE A NON-UNIQUE KEY
      //     SCHEME VALID.
      //
      // Normalized to `<package>/<relative source path>`: stable across temp
      // directories, no dist prefix, no absolute filesystem path.
      subject: normalizeBareSubject(p),
      bytes: v.bytesInOutput,
    }))
    .sort((a, b) => b.bytes - a.bytes)));

}
