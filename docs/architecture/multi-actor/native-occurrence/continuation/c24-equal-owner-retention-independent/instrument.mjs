import fs from 'node:fs';const r='/private/tmp/st-c24-equal-owner-retention-independent',d=r+'/source/packages/kernel/src/lib/experimental-publication';
for(const n of ['private','lifecycle'])fs.copyFileSync(d+'/'+n+'.ts',r+'/'+n+'.uninstrumented.ts');
let l=fs.readFileSync(d+'/lifecycle.ts','utf8');l=l.replace('export function nativeRequirementReady(requirement:NativeRequirement):boolean {','export function nativeRequirementReady(requirement:NativeRequirement):boolean {\n __reviewReadyVisits++;').replace('export function nativeProof(requirement: NativeRequirement): Proof {','export function nativeProof(requirement: NativeRequirement): Proof {\n __reviewProofVisits++;');l+='\nlet __reviewReadyVisits=0,__reviewProofVisits=0;\nexport function __reviewResetVisits():void{__reviewReadyVisits=0;__reviewProofVisits=0;}\nexport function __reviewVisits(){return {ready:__reviewReadyVisits,proof:__reviewProofVisits};}\n';fs.writeFileSync(d+'/lifecycle.ts',l);
let p=fs.readFileSync(d+'/private.ts','utf8');p+=`\nexport function __reviewSelectedRequirement(node:object){
 const requirement=nativeValues.get(node)?.requirement as lifecycle.NativeRequirement|undefined;
 if(!requirement)throw Error('Missing selected ordinary source');
 const seen=new Set<lifecycle.NativeRequirement>();const queue:Array<[lifecycle.NativeRequirement,number]>=[[requirement,0]];let depth=0,edges=0;
 while(queue.length){const [part,d]=queue.pop()!;depth=Math.max(depth,d);if(seen.has(part))continue;seen.add(part);for(const child of part.components??[]){edges++;queue.push([child,d+1]);}}
 lifecycle.__reviewResetVisits();const ready=lifecycle.nativeRequirementReady(requirement);const proof=lifecycle.nativeProof(requirement);const visits=lifecycle.__reviewVisits();
 return {nodes:seen.size,depth,edges,ready,visits,owners:proof.owners.length,destination:proof.destination?.length??0,input:proof.input?.length??0,validation:proof.validation?.length??0,possible:proof.possible?.length??0};
}\n`;fs.writeFileSync(d+'/private.ts',p);
