// Preserve this local investigation's evidence. Does not run or bless gates.
import {mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const dir=fileURLToPath(new URL('.',import.meta.url)),out=join(dir,'evidence');mkdirSync(out,{recursive:true});
const names=[
 'signaltree-current-behavior-first','signaltree-current-options-final',
 'prepared-first','prepared-safety','prepared-long-pending','prepared-churn-first','prepared-extension-first',
 'draft-first','draft-current','draft-main-final','draft-supplemental','draft-human-agent-scenario','draft-churn-first','draft-extension-first',
 'frontier-first','frontier-final','frontier-before-revision-extensions','frontier-attacks','frontier-extension-second',
 'frontier-main-final','frontier-main-extensions','frontier-main-attacks','frontier-v2-frozen-draft','frontier-v2-entity-churn','frontier-v2-long-pending',
 'replay-first','replay-extension-second','replay-review-scenario',
 'replay-mutations-first','replay-mutations-corrected','frontier-mutations-first','prepared-mutations-first',
];
const index=[];
for(const name of names){const path=`/tmp/${name}.json`;if(!existsSync(path))throw Error(`Missing evidence ${path}`);const r=JSON.parse(readFileSync(path,'utf8'));
 // Preserve counts, exact failing assertions and traces; omit base64 source URLs.
 const text=JSON.stringify(r,null,2).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<frozen-source-bundle>')+'\n';
 writeFileSync(join(out,name+'.json'),text);index.push({file:name+'.json',sha256:createHash('sha256').update(text).digest('hex')});
}
for(const name of ['frontier-first-source','frontier-before-bounded-revision','frontier-v2-final-source','draft-first-source']){
 const from=`/tmp/${name}.mjs`;if(existsSync(from))copyFileSync(from,join(out,name+'.mjs.txt'));
}
const sources=readdirSync(dir).filter(n=>/\.(mjs|ts|md)$/.test(n)).map(file=>({file,sha256:createHash('sha256').update(readFileSync(join(dir,file))).digest('hex')}));
writeFileSync(join(out,'manifest.json'),JSON.stringify({baseline:'7ade0e3ecb25ff0d06da4355b5f7d67844e147b7',created:new Date().toISOString(),runtime:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},warning:'No full conformance/mutation/release pass. replay-mutations-first contains withdrawn collateral kills. Source hashes describe final files; first source snapshots and earlier outputs are separately preserved.',sources,reports:index},null,2)+'\n');
console.log(`Preserved ${index.length} reports and ${sources.length} source fingerprints`);
