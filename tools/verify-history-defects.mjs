#!/usr/bin/env node
/**
 * Archived provenance entry point for the historical TODO 6a–6d audit.
 * Its last executable probes covered only the unexported createAuditTracker,
 * now removed. Original measurements and implementation remain in git history.
 * Current restoration behavior is tested by the kernel Nx suite, including
 * enhancers/restoration/documented-defects.spec.ts; this is not a live gate.
 */
console.error(
  'Archived: the audit-tracker subject was removed. No current verification ran.\n' +
    'Run pnpm nx test kernel for the surviving restoration contracts.'
);
process.exitCode = 1;
