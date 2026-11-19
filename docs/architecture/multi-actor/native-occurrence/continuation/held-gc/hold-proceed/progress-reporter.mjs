import { appendFileSync, writeFileSync } from 'node:fs';
const output = process.env.ST_VERIFY_PROGRESS;
export default class VerificationProgress {
  record(kind, item, history = true) {
    if (!output) throw new Error('ST_VERIFY_PROGRESS is required for the diagnostic reporter');
    const row = { kind, at: new Date().toISOString(), file: item.moduleId ?? item.module?.moduleId, name: item.fullName };
    writeFileSync(`${output}.current.json`, JSON.stringify(row));
    if (history) appendFileSync(`${output}.jsonl`, JSON.stringify(row) + '\n');
  }
  onTestModuleStart(module) { this.record('module-start', module); }
  onTestModuleEnd(module) { this.record('module-end', module); }
  onTestCaseReady(test) { this.record('case-start', test, false); }
}
