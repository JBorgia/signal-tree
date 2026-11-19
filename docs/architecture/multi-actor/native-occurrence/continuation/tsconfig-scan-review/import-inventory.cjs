const fs=require('node:fs'),path=require('node:path'),ts=require('/Users/jonathanborgia/code/signaltree/node_modules/typescript');
const root='/private/tmp/st-c20-tsconfig-scan-successor/candidate',rows=[];
for(const area of ['packages/react/src','apps/react-reference/src','packages/kernel/src']){
 function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())visit(file);else if(/\.[cm]?[jt]sx?$/.test(file)&&!(area==='packages/kernel/src'&&(/\.spec\.|\/typing\//.test(file)))){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);function walk(n){let literal;if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))literal=n.moduleSpecifier;else if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(n.expression)&&n.expression.text==='require')))literal=n.arguments[0];if(literal&&ts.isStringLiteralLike(literal)&&!literal.text.startsWith('.'))rows.push({file:path.relative(root,file),specifier:literal.text});ts.forEachChild(n,walk);}walk(source);
 }}}visit(path.join(root,area));
}
fs.writeFileSync('/private/tmp/st-c20-tsconfig-independent-review/IMPORTS.json',JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify([...new Set(rows.map(r=>r.specifier))].sort()));
