const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {createRequire}=require('node:module');
const base='/private/tmp/st-v16-demo-guidance',source='/private/tmp/st-v16-integration-candidate';
const requireSource=createRequire(source+'/package.json');
const ts=requireSource('typescript');
const files=JSON.parse(fs.readFileSync(base+'/HASHES.json','utf8')).files;
const page='apps/demo/src/app/pages/independent-publication/independent-publication.component.ts';
let parsedPage;
for(const {file} of files.filter(x=>x.file.endsWith('.ts'))){
 const sf=ts.createSourceFile(file,fs.readFileSync(base+'/overlay/'+file,'utf8'),ts.ScriptTarget.Latest,true);
 assert.equal(sf.parseDiagnostics.length,0,file);
 if(file===page)parsedPage=sf;
}
let snippet;
function visit(node){if(ts.isPropertyDeclaration(node)&&node.name.getText(parsedPage)==='example'){assert(ts.isNoSubstitutionTemplateLiteral(node.initializer));snippet=node.initializer.text;}ts.forEachChild(node,visit);}
visit(parsedPage);assert(snippet);
assert.equal(ts.createSourceFile('adopter-example.ts',snippet,ts.ScriptTarget.Latest,true).parseDiagnostics.length,0);
for(const node of parsedPage.statements.filter(ts.isImportDeclaration))assert(['@angular/core','@signal-tree/angular'].includes(node.moduleSpecifier.text));
const routeText=fs.readFileSync(base+'/overlay/apps/demo/src/app/app.routes.ts','utf8');
assert.equal((routeText.match(/path: 'independent-publication'/g)||[]).length,1);
assert.equal((routeText.match(/import\('\.\/pages\/independent-publication\//g)||[]).length,1);
const routeFile=ts.createSourceFile('routes.ts',routeText,ts.ScriptTarget.Latest,true);
assert.deepEqual(routeFile.statements.filter(ts.isImportDeclaration).map(n=>n.moduleSpecifier.text),['@angular/router']);
(async()=>{
 const compiler=await import(pathToFileURL(requireSource.resolve('@angular/compiler')).href);
 const htmlPath=base+'/overlay/'+page.replace('.ts','.html');
 const result=compiler.parseTemplate(fs.readFileSync(htmlPath,'utf8'),htmlPath);
 assert(!result.errors?.length,JSON.stringify(result.errors));
 console.log('PASS: 5 TypeScript files and embedded adopter example parse; Angular template parses.');
 console.log('PASS: page imports only Angular core and public Angular facade; route remains dynamic with no static page/SDK import.');
 console.log('No component execution, tests, typecheck, lint, AOT, style compilation, production build or browser rendering performed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
