const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=__dirname,c=path.join(root,'candidate');
const invoke=(args)=>{console.log('COMMAND',JSON.stringify(args));const p=spawnSync(process.execPath,args,{cwd:c,env:process.env,stdio:'inherit'});if(p.status!==0)process.exit(p.status??1);};
invoke([path.join(c,'node_modules/nx',JSON.parse(fs.readFileSync(path.join(c,'node_modules/nx/package.json'))).bin.nx),'graph','--file='+path.join(process.env.TMPDIR,'project-graph.json')]);
const graph=path.join(process.env.NX_WORKSPACE_DATA_DIRECTORY,'project-graph.json');
if(!fs.existsSync(graph))throw Error('Nx project graph cache missing: '+graph);
console.log('GRAPH',graph);
invoke([path.join(c,'node_modules/eslint/bin/eslint.js'),...JSON.parse(fs.readFileSync(path.join(root,'LINT-PATHS.json')))]);
invoke([path.join(c,'node_modules/eslint/bin/eslint.js'),'packages/kernel/tests/entity-registration/receipt-cases.ts']);
