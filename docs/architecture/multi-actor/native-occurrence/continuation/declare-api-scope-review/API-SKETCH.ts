/** REVIEW-ONLY declarations. Not an implementation or a package export patch. */
import type { Link, PendingTransaction, SignalTreeRollbackError } from '@signal-tree/kernel';
import type { TruthfulLinkSource, NaturalValue, LinkEndpoint } from '/private/tmp/st-native-combined-c22/candidate/packages/kernel/src/lib/link';

type AuthenticOwner = PendingTransaction | NonNullable<SignalTreeRollbackError['recovery']>['transaction'];
/** Proposed new root type export; structural typing cannot authenticate owners. */
export type PublicationDeclaration =
  | Readonly<{ kind: 'independent' }>
  | Readonly<{ kind: 'dependent'; owners: readonly AuthenticOwner[] }>
  | Readonly<{ kind: 'unknown' }>;
/** Proposed new root type export. Only combinations emitted by current C22. */
export type PublicationState =
  | Readonly<{ state: 'validating' }>
  | Readonly<{ state: 'no-write' }>
  | Readonly<{ state: 'held'; reason: 'pending-dependency' }>
  | Readonly<{ state: 'eligible'; basis: 'declared' }>
  | Readonly<{ state: 'conservative'; reason: 'invalid-declaration' | 'unknown' | 'rejected-dependency' }>
  | Readonly<{ state: 'started'; basis: 'declared' | 'surviving' }>
  | Readonly<{ state: 'superseded' }>
  | Readonly<{ state: 'disposed' }>;
/** Proposed new root type export; snapshots and handle are frozen at runtime. */
export interface PublicationReceipt {
  readonly read: () => PublicationState;
}
/** Illustrates an additive member on existing Link; this helper name is NOT an export proposal. */
export interface ProposedLink extends Link {
  declare<R>(
    declaration: PublicationDeclaration,
    work: (() => R) & (Extract<R, PromiseLike<unknown>> extends never ? unknown : never)
  ): PublicationReceipt;
}
/** Keep these existing inference helpers internal to declaration emit. */
export declare function proposedLink<S>(source: TruthfulLinkSource<S>, endpoint: LinkEndpoint<NaturalValue<S>>): ProposedLink;
/** Proposed single new value export, matching the previously proposed name/code. */
export declare class SignalTreePublicationError extends Error {
  readonly code: 'SIGNALTREE_PUBLICATION_DECLARATION_INVALID';
  readonly stage: 'before-callback' | 'after-callback';
  readonly reason: 'malformed' | 'unavailable-owner' | 'contradiction' | 'async-callback' | 'validation-threw' | 'disposed' | 'unsupported-source';
  readonly cause?: unknown;
  constructor(stage: SignalTreePublicationError['stage'], reason: SignalTreePublicationError['reason'], options?: { cause?: unknown });
}
