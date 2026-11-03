import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  type OnDestroy,
} from '@angular/core';
import {
  link,
  SignalTreePublicationError,
  signalTree,
  transactions,
  type PendingTransaction,
  type PublicationState,
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
    { route: 'north', note: '' },
    { enhancers: [transactions()] }
  );
  readonly deliveredNotes = signal<readonly string[]>([]);
  readonly noteConnection = link(this.tree.$.note, {
    set: (value) => this.deliveredNotes.update((notes) => [...notes, value]),
  });
  private readonly proposal = signal<PendingTransaction | undefined>(undefined);
  private destroyed = false;
  readonly hasPending = computed(() => this.proposal() !== undefined);
  readonly decision = signal('Not proposed');
  readonly publishing = signal(false);
  readonly admission = signal<PublicationState | undefined>(undefined);
  readonly error = signal<string | undefined>(undefined);

  proposeWest(): void {
    if (this.destroyed || this.hasPending() || this.publishing()) return;
    this.proposal.set(this.tree.transact(() => this.tree.$.route.set('west')));
    this.decision.set('Pending local review');
  }

  confirm(): void {
    if (this.destroyed || this.publishing() || !this.hasPending()) return;
    this.proposal()?.confirm();
    this.proposal.set(undefined);
    this.decision.set('Confirmed locally');
  }

  reject(): void {
    if (this.destroyed || this.publishing() || !this.hasPending()) return;
    this.proposal()?.rollback();
    this.proposal.set(undefined);
    this.decision.set('Rejected locally');
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
            : error instanceof Error ? error.message : String(error)
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
    this.tree.destroy();
  }

  readonly example = `// v16 development preview (unreleased). Angular facade only.
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
