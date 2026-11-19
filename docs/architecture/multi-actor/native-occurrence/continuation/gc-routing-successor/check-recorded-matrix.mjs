import {readFileSync} from 'node:fs';
import {validateRetentionMatrix} from './candidate/tools/lib/forwarding-retention-matrix.mjs';
const {rows}=JSON.parse(readFileSync(process.argv[2]));
const errors=validateRetentionMatrix(rows,row=>JSON.parse(readFileSync(row.artifact)),process.version);
console.log(JSON.stringify(errors));process.exitCode=errors.length?1:0;
