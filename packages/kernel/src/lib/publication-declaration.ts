import type { PendingTransaction } from '../enhancers/transactions/transactions.types';
import type { SignalTreeRollbackError } from './types';

type DeclarationOwner = PendingTransaction | NonNullable<SignalTreeRollbackError['recovery']>['transaction'];

/** Complete contributor declaration for one synchronous Link operation.
 * Handles identify dependencies; they do not transfer write ownership.
 * Runtime authenticates handles. Types cannot prove hidden-input completeness.
 */
export type PublicationDeclaration =
  | Readonly<{ kind: 'independent' }>
  | Readonly<{ kind: 'dependent'; owners: readonly DeclarationOwner[] }>
  | Readonly<{ kind: 'unknown' }>;

/** Admission status, not transport acknowledgment or a publication capability. */
export type PublicationState =
  | Readonly<{ state: 'validating' }>
  | Readonly<{ state: 'no-write' }>
  | Readonly<{ state: 'held'; reason: 'pending-dependency' }>
  | Readonly<{ state: 'eligible'; basis: 'declared' }>
  | Readonly<{ state: 'conservative'; reason: 'invalid-declaration' | 'unknown' | 'rejected-dependency' }>
  | Readonly<{ state: 'started'; basis: 'declared' | 'surviving' }>
  | Readonly<{ state: 'superseded' }>
  | Readonly<{ state: 'disposed' }>;

/** Frozen handle; read returns the current detached immutable status snapshot.
 * This is not a signal, subscription, cancellation handle or delivery promise.
 */
export interface PublicationReceipt {
  readonly read: () => PublicationState;
}
