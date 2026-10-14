// Call only for transactions.ts in the proof runner's onLoad transform.
// Older experimental lanes already contain hooks: do not insert twice.
export function restoreProofHooks(contents) {
  const insertBefore = (scope, seam, text) => {
    const start = contents.indexOf(scope);
    const at = contents.indexOf(seam, start);
    if (start < 0 || at < 0) throw new Error(`Missing proof seam: ${scope}`);
    contents = contents.slice(0, at) + text + contents.slice(at);
  };
  if (!contents.includes('__entityPrepareProbe')) {
    insertBefore('sourceCaptureRuntime.prepareEntityResponsibility = (capture) => {',
      '      const bucket = getTransactionBucket(id);',
      '      (globalThis as any).__entityPrepareProbe?.(capture);\n');
  }
  if (!contents.includes('__prepareProbe')) {
    insertBefore('{ terminalRecord: (path,next,prev,meta,ownerPath,subjectIds,positionIds) => {',
      '          const bucket=getTransactionBucket(id);',
      '          (globalThis as any).__prepareProbe?.(path,next,prev);\n');
  }
  if (!contents.includes('__captureProbe')) {
    insertBefore('}, beforePublication: (path, next, prev, meta, ownerPath, subjectIds, positionIds) => {',
      '          const effectiveMeta = meta ?? getActiveWriteContext();',
      '          (globalThis as any).__captureProbe?.(path,next,prev);\n');
  }
  return contents;
}
