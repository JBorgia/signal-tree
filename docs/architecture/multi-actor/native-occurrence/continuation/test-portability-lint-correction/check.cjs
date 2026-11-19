const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('/private/tmp/st-v16-integration-candidate/node_modules/typescript');
const b='/private/tmp/st-test-sink-lint-correction',s='/private/tmp/st-v16-integration-candidate';
const manifest=JSON.parse(fs.readFileSync(b+'/HASHES.json','utf8'));
const printer=ts.createPrinter({removeComments:true});
function parse(file){const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);assert.equal(sf.parseDiagnostics.length,0,file);return sf;}
function normalized(sf){return printer.printFile(sf).replace(/from '[^']*optional-diagnostic'/g,"from 'normalized-helper'");}
let imports=0;
for(const x of manifest.files.filter(x=>x.file.endsWith('.spec.ts'))){
 const before=parse(b+'/before/'+x.file),after=parse(b+'/overlay/'+x.file);
 assert.equal(normalized(before),normalized(after),x.file);
 const declaration=after.statements.filter(ts.isImportDeclaration).find(n=>n.moduleSpecifier.text.endsWith('optional-diagnostic'));
 assert.equal(path.resolve(path.dirname(b+'/overlay/'+x.file),declaration.moduleSpecifier.text)+'.ts',b+'/overlay/packages/kernel/test/optional-diagnostic.ts');
 imports++;
}
assert.equal(imports,14);
assert.deepEqual(fs.readFileSync(b+'/before/tools/testing/optional-diagnostic.ts'),fs.readFileSync(b+'/overlay/packages/kernel/test/optional-diagnostic.ts'));
parse(b+'/overlay/packages/kernel/test/optional-diagnostic.ts');
// Overlay-aware file enumeration only: no Program, typechecking, emit, or Nx graph creation.
const configPath=s+'/packages/kernel/tsconfig.lib.prod.json';
const host={...ts.sys,readDirectory(root,extensions,excludes,includes,depth){
 const existing=ts.sys.readDirectory(root,extensions,excludes,includes,depth);
 const rel=path.relative(s,root);
 const extra=ts.sys.readDirectory(path.join(b,'overlay',rel),extensions,excludes,includes,depth).map(p=>path.join(s,path.relative(b+'/overlay',p)));
 return [...new Set([...existing,...extra])];
}};
const config=ts.getParsedCommandLineOfConfigFile(configPath,{}, {...host,onUnRecoverableConfigFileDiagnostic:d=>{throw Error(ts.flattenDiagnosticMessageText(d.messageText,' '));}});
assert(config);assert.equal(config.errors.length,0);
assert(!config.fileNames.includes(s+'/packages/kernel/test/optional-diagnostic.ts'));
assert(!config.fileNames.some(f=>f.endsWith('.spec.ts')));
const helperRefs=config.fileNames.filter(f=>fs.readFileSync(f,'utf8').includes('optional-diagnostic'));
assert.deepEqual(helperRefs,[]);
console.log('PASS: 15 TypeScript files parse; all 14 spec ASTs match after normalizing only helper import paths and removing comments.');
console.log('PASS: 14 exact relative helper imports resolve inside packages/kernel; moved helper is byte-identical.');
console.log('PASS: overlay-aware production tsconfig enumeration excludes helper and all specs; no included production source mentions optional-diagnostic.');
console.log('NOTE: Nx production cache input still includes test/optional-diagnostic.ts through projectRoot/**/*; this is not compilation or package inclusion.');
console.log('No tests, lint, typecheck, build, or Nx graph generation executed.');
