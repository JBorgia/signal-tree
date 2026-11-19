const fs=require('fs'),assert=require('assert/strict'),ts=require('/Users/jonathanborgia/code/signaltree/node_modules/typescript');
const base='/private/tmp/st-native-combined-c14/candidate/packages/kernel/src/lib/',cand='/private/tmp/st-c14-lint-cleanup/candidate/packages/kernel/src/lib/';
const read=(root,f)=>fs.readFileSync(root+f,'utf8');
const emit=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;
for(const f of ['scalar-native-support.spec.ts','parent-proof-safety-falsifier.spec.ts']) {assert.equal(emit(read(base,f)),emit(read(cand,f)));console.log('Identical fixture JS:',f);}
for(const f of ['experimental-publication/lifecycle.ts','experimental-publication/private.ts']) {
 const exports=s=>{const ast=ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true);return ast.statements.filter(n=>n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)||ts.isExportDeclaration(n)).map(n=>ts.isFunctionDeclaration(n)?[n.name.text,n.parameters.map(p=>[p.name.getText(ast),p.type?.getText(ast)]),n.type?.getText(ast)]:n.getText(ast));};
 assert.deepEqual(exports(read(base,f)),exports(read(cand,f)));console.log('Export names/signatures unchanged:',f);
}
const old=read(base,'experimental-publication/lifecycle.ts'),next=read(cand,'experimental-publication/lifecycle.ts');
const block=s=>{const start=s.indexOf(' }catch(error){\n  exitingError=true;'),end=s.indexOf('function makeReceipt',start);assert(start>=0&&end>start);return s.slice(start,end);};assert.equal(block(old),block(next));console.log('Catch/finally byte identical');
const shape=ts.transpileModule(read(cand,'internals/node-shape.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const m={exports:{}};new Function('module','exports',shape)(m,m.exports);const guard=m.exports.isTraversableNode;
let traps=0;const proxy=new Proxy({}, {get(){traps++;throw Error('trap');}});const rev=Proxy.revocable({},{});rev.revoke();
const values=[undefined,null,false,true,0,1,NaN,'', 'x',0n,Symbol(),{},[],()=>{},Object.create(null),proxy,rev.proxy];
for(const x of values){assert.equal(!x||typeof x!=='object',!guard(x)||typeof x==='function');assert.equal(x!==null&&(typeof x==='object'||typeof x==='function'),guard(x));assert.equal((typeof x!=='object'||x===null)&&typeof x!=='function',!guard(x));}assert.equal(traps,0);console.log('Three guard predicates equivalent across 17 values including proxies; no traps invoked');
