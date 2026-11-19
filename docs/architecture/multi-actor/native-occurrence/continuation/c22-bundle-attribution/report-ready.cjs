const fs = require('node:fs');
const output = process.env.ST_BUILD_DIAGNOSTIC;
if (output) fs.appendFileSync(output + '/node-ready.jsonl', JSON.stringify({pid:process.pid,ppid:process.ppid,cwd:process.cwd(),argv:process.argv,node:process.version,report:{onSignal:process.report.reportOnSignal,signal:process.report.signal,excludeEnv:process.report.excludeEnv,excludeNetwork:process.report.excludeNetwork,directory:process.report.directory}})+'\n');
