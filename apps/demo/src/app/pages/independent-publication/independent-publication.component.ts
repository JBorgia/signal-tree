import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  type OnDestroy,
} from '@angular/core';
import {
  link,
  external,
  SignalTreePublicationError,
  SignalTreeRollbackError,
  signalTree,
  transactions,
  type PendingTransaction,
  type PublicationState,
  type TransactionInspection,
} from '@signal-tree/angular';

@Component({
  selector: 'app-independent-publication',
  standalone: true,
  templateUrl: './independent-publication.component.html',
  styleUrl: './independent-publication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndependentPublicationComponent implements OnDestroy {
  readonly tree = signalTree(
    { route: 'north', note: '', shipment: 'Ready' },
    { enhancers: [transactions()] }
  );
  readonly deliveredNotes = signal<readonly string[]>([]);
  readonly noteConnection = link(this.tree.$.note, {
    set: (value) => this.deliveredNotes.update((notes) => [...notes, value]),
  });
  readonly deliveredRoutes = signal<readonly string[]>([]);
  readonly routeConnection = link(this.tree.$.route, {
    set: (value) => this.deliveredRoutes.update((routes) => [...routes, value]),
  });
  private readonly proposal = signal<PendingTransaction | undefined>(undefined);
  private readonly newerProposal = signal<PendingTransaction | undefined>(
    undefined
  );
  private destroyed = false;
  readonly hasPending = computed(() => this.proposal() !== undefined);
  readonly hasNewerPending = computed(() => this.newerProposal() !== undefined);
  readonly review = signal<TransactionInspection['changes']>([]);
  readonly recovery = signal('No recovery needed');
  readonly decision = signal('Not proposed');
  readonly publishing = signal(false);
  readonly admission = signal<PublicationState | undefined>(undefined);
  readonly error = signal<string | undefined>(undefined);

  proposeWest(): void {
    if (
      this.destroyed ||
      this.hasPending() ||
      this.publishing() ||
      this.tree.$.route() !== 'north'
    )
      return;
    this.proposal.set(this.tree.transact(() => this.tree.$.route.set('west')));
    this.decision.set('Pending local review');
    this.refreshReview();
  }

  async resetScenario(): Promise<void> {
    // Reset is a local teaching action, never a way to discard unresolved owners.
    if (
      this.destroyed ||
      this.hasPending() ||
      this.hasNewerPending() ||
      this.publishing()
    )
      return;
    this.publishing.set(true);
    try {
      await Promise.all([
        this.routeConnection.settled(),
        this.noteConnection.settled(),
      ]);
      if (this.destroyed) return;
      external(() => {
        this.tree.$.route.set('north');
        this.tree.$.note.set('');
        this.tree.$.shipment.set('Ready');
      });
      this.deliveredRoutes.set([]);
      this.deliveredNotes.set([]);
      this.admission.set(undefined);
      this.error.set(undefined);
      this.decision.set('Not proposed');
      this.recovery.set('No recovery needed');
      this.refreshReview();
    } finally {
      if (!this.destroyed) this.publishing.set(false);
    }
  }

  confirm(): void {
    if (
      this.destroyed ||
      this.publishing() ||
      !this.hasPending() ||
      this.hasNewerPending()
    )
      return;
    this.proposal()?.confirm();
    this.proposal.set(undefined);
    this.decision.set('Confirmed locally');
    this.refreshReview();
  }

  reject(): void {
    if (this.destroyed || this.publishing() || !this.hasPending()) return;
    try {
      this.proposal()?.rollback();
      this.proposal.set(undefined);
      this.decision.set('Rejected locally');
      this.recovery.set('Review complete; unrelated work remains');
    } catch (error) {
      if (!(error instanceof SignalTreeRollbackError)) throw error;
      // A real refusal leaves the original handle owned and available. Do not
      // clear it or tell the user the proposal was rejected successfully.
      this.decision.set('Still pending · rejection refused');
      this.recovery.set(
        'Resolve the newer route proposal, then retry rejection'
      );
    }
    this.refreshReview();
  }

  receiveShipment(): void {
    if (this.destroyed || this.publishing()) return;
    external(() => this.tree.$.shipment.set('Shipped'));
    this.refreshReview();
  }

  proposeEast(): void {
    if (
      this.destroyed ||
      this.publishing() ||
      !this.hasPending() ||
      this.hasNewerPending()
    )
      return;
    this.newerProposal.set(
      this.tree.transact(() => this.tree.$.route.set('east'))
    );
    this.recovery.set(
      'Two route proposals are pending; resolve the newer one first'
    );
    this.refreshReview();
  }

  rejectNewer(): void {
    if (this.destroyed || this.publishing() || !this.hasNewerPending()) return;
    this.newerProposal()?.rollback();
    this.newerProposal.set(undefined);
    this.recovery.set('Newer proposal rejected; retry the original rejection');
    this.refreshReview();
  }

  private refreshReview(): void {
    // inspect() is a current snapshot. Explicitly resample after each action;
    // the UI does not treat it as a signal, authorization or a value snapshot.
    this.review.set(this.proposal()?.inspect().changes ?? []);
  }

  async publishIndependentNote(): Promise<void> {
    if (this.destroyed || this.publishing() || !this.hasPending()) return;
    this.publishing.set(true);
    this.error.set(undefined);
    try {
      const receipt = this.noteConnection.declare(
        { kind: 'independent' },
        () => {
          // This literal consumes no route proposal, saved input or cached result.
          this.tree.$.note.set('dispatch-ready');
        }
      );
      // A receipt is readable status, not a signal. Explicitly sample it for UI.
      this.admission.set(receipt.read());
      await this.noteConnection.settled();
      if (!this.destroyed) this.admission.set(receipt.read());
    } catch (error) {
      if (!this.destroyed) {
        this.error.set(
          error instanceof SignalTreePublicationError
            ? `${error.message} (${error.stage}: ${error.reason})`
            : error instanceof Error
            ? error.message
            : String(error)
        );
      }
    } finally {
      if (!this.destroyed) this.publishing.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.noteConnection.dispose();
    this.routeConnection.dispose();
    this.tree.destroy();
  }

  readonly example = `// v16 release candidate (evaluation prerelease). Angular facade only.
import { link, signalTree, transactions } from '@signal-tree/angular';

export async function independentNote() {
  const tree = signalTree(
    { route: 'north', note: '' },
    { enhancers: [transactions()] }
  );
  const delivered: string[] = [];
  const notes = link(tree.$.note, {
    set: value => { delivered.push(value); }, // In-memory endpoint only.
  });
  try {
    const proposal = tree.transact(() => tree.$.route.set('west'));
    const receipt = notes.declare({ kind: 'independent' }, () => {
      tree.$.note.set('dispatch-ready'); // Authored literal: no proposal input.
    });
    await notes.settled(); // Resolves while proposal is still pending.
    const admission = receipt.read(); // Status, not a delivery acknowledgment.
    proposal.rollback(); // Or proposal.confirm() to retain west locally.
    return { route: tree.$.route(), note: tree.$.note(), admission, delivered };
  } finally {
    notes.dispose();
    tree.destroy(); // A component does this in ngOnDestroy instead.
  }
}`;
}
