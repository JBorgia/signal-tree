import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const supplied = process.argv[2];
if (!supplied) throw new Error('Pass the isolated consumer directory containing freshly installed package tarballs.');
const root = resolve(supplied);
for (const name of ['consumer', 'lifecycle-consumer', 'receipt-consumer', 'no-link']) {
  const result = await build({ bundle: true, minify: true, format: 'esm', platform: 'browser', treeShaking: true,
    define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' }, external: ['@angular/*', 'rxjs', 'rxjs/*', 'tslib'],
    metafile: true, logLevel: 'info', entryPoints: [root + '/' + name + '.mjs'], outfile: root + '/' + name + '.production.mjs' });
  writeFileSync(root + '/' + name + '.metafile.json', JSON.stringify(result.metafile, null, 2));
}
