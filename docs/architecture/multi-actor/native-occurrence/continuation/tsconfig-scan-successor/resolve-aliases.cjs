const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const {pathToFileURL} = require('node:url');
const r = createRequire(process.cwd() + '/package.json');
(async () => {
 const {createServer} = await import(pathToFileURL(r.resolve('vite')).href);
 const rows = [];
 for (const [configFile, cases] of [
  ['packages/react/vitest.config.ts', [
   ['@signal-tree/kernel', 'packages/react/src/index.ts', 'packages/kernel/src/index.ts'],
   ['@signal-tree/kernel/adapter', 'packages/react/src/use-signal-tree.ts', 'packages/kernel/src/adapter.ts'],
  ]],
  ['apps/react-reference/vite.config.mts', [
   ['@signal-tree/react', 'apps/react-reference/src/app/app.tsx', 'packages/react/src/index.ts'],
   ['@signal-tree/kernel', 'apps/react-reference/src/app/reference-store.ts', 'packages/kernel/src/index.ts'],
   ['@signal-tree/kernel/adapter', 'apps/react-reference/src/app/reference-store.spec.ts', 'packages/kernel/src/adapter.ts'],
   ['@signal-tree/kernel', 'packages/react/src/index.ts', 'packages/kernel/src/index.ts'],
   ['@signal-tree/kernel/adapter', 'packages/react/src/use-signal-tree.ts', 'packages/kernel/src/adapter.ts'],
  ]],
 ]) {
  const server = await createServer({configFile:path.resolve(configFile),server:{middlewareMode:true,hmr:false},appType:'custom'});
  try {
   for (const [specifier,importer,expected] of cases) {
    const resolved = await server.pluginContainer.resolveId(specifier,path.resolve(importer));
    if (!resolved || path.resolve(resolved.id)!==path.resolve(expected)) throw Error(JSON.stringify({configFile,specifier,importer,expected,resolved}));
    rows.push({configFile,specifier,importer,resolved:resolved.id});
   }
  } finally { await server.close(); }
 }
 fs.writeFileSync('/private/tmp/st-c20-tsconfig-scan-successor/ALIAS-RESULTS.json',JSON.stringify(rows,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
