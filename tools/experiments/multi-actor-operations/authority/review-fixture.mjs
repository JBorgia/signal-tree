import { immutable } from '../coordinator.mjs';

// In-memory server-side fixture. authenticateReviewer belongs to a trusted host;
// actor labels, model events and client `approved: true` are never consulted.
export function reviewAuthority(backend, authenticateReviewer, { maxApprovals = 128 } = {}) {
  if (!Number.isSafeInteger(maxApprovals) || maxApprovals < 1) throw new Error('Invalid approval capacity');
  const approvals = new Map();
  let disposed = false;
  const live = () => { if (disposed) throw new Error('Review authority disposed'); };
  return {
    approve(command, reviewerContext) {
      live();
      const captured = immutable(command);
      const bytes = JSON.stringify(captured);
      if (typeof captured?.commandId !== 'string' || !captured.commandId) throw new Error('Invalid command');
      if (authenticateReviewer(reviewerContext) !== true) throw new Error('Reviewer unauthorized');
      // Host authorization is synchronous; reentry may have disposed the owner.
      live();
      if (approvals.size >= maxApprovals) throw new Error('Approval capacity reached');
      const token = crypto.randomUUID();
      approvals.set(token, bytes);
      return token;
    },
    apply(command, token) {
      live();
      const captured = immutable(command);
      if (!approvals.has(token) || approvals.get(token) !== JSON.stringify(captured)) throw new Error('Missing or mismatched server approval');
      return backend.apply(captured);
    },
    revoke(token) { live(); approvals.delete(token); },
    dispose() { approvals.clear(); disposed = true; },
  };
}
