import type { Command, JsonValue, Receipt } from '../coordinator.mjs';
/** Narrow declaration for the copied experiment fixture, not a package override. */
export interface ReviewAuthority<P extends JsonValue> {
  approve(command: Command<P>, reviewerContext: unknown): string;
  apply(command: Command<P>, token?: string): Receipt;
  revoke(token: string): void;
  dispose(): void;
}
export function reviewAuthority<P extends JsonValue>(
  backend: { apply(command: Command<P>): Receipt },
  authenticateReviewer: (context: unknown) => boolean,
  options?: { maxApprovals?: number }
): ReviewAuthority<P>;
