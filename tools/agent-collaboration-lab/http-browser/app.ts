import { Component, signal, type OnDestroy } from '@angular/core';
import {
  entityMap,
  external,
  link,
  signalTree,
  transactions,
  type PendingTransaction,
} from '@signal-tree/angular';
import { transactionLifecycleReader } from '@signal-tree/kernel/internals';
import {
  immutable,
  OperationCoordinator,
  type Actor,
  type OperationState,
  type Review,
} from '../coordinator.mjs';
import { dispatchToolStream } from './ag-ui.mjs';
import {
  makeProposal,
  request,
  type Initial,
  type Observation,
  type Proposal,
  type WireCommand,
  type Fault,
} from './model.js';

type Phase =
  | 'loading'
  | 'idle'
  | 'draft'
  | 'reviewed'
  | 'approval-pending'
  | 'approved'
  | 'delivering'
  | 'uncertain'
  | 'local-pending'
  | 'succeeded'
  | 'failed'
  | 'rejected'
  | 'disposed';
type Row = { id: string; instance: string; route: string };
type HeldRow = {
  readonly instance: () => string;
  readonly route: () => string;
};
type Current = {
  id: string;
  local: PendingTransaction;
  nativeId: number;
  held: HeldRow;
  binding?: Review<Proposal>;
  command?: WireCommand;
  reviewRequestId?: string;
  outcome?: OperationState<Proposal>;
  withdrawn?: boolean;
};
type Producer = {
  observation: Observation;
  runId: string;
  stream: ReturnType<typeof dispatchToolStream<Proposal>>;
};

@Component({
  selector: 'http-reference',
  standalone: true,
  template: `
    <h1>Reviewed dispatch through HTTP</h1>
    <p>
      Production Angular AOT · installed public SignalTree packages · real
      loopback HTTP.
    </p>
    <p>
      In-memory fixture with fixed fake credentials. Declared actors are not
      authenticated. One reviewed remote operation at a time; independent work
      and a second native owner are supported here.
    </p>
    <p>
      Disposal is an explicit in-session action. Navigation, durable restart and
      production security are outside this reference.
    </p>
    <p>
      Phase: <strong data-testid="phase">{{ phase() }}</strong>
    </p>
    <p data-testid="message">{{ message() }}</p>
    <p>
      Transport or cleanup in flight:
      <span data-testid="busy">{{ busy() }}</span>
    </p>
    <p>
      Server receipt:
      <span data-testid="server-outcome">{{ serverOutcome() }}</span
      >; native outcome:
      <span data-testid="local-outcome">{{ localOutcome() }}</span>
    </p>
    <p data-testid="local-resolution">{{ localResolution() }}</p>
    <p>
      Native pending IDs:
      <span data-testid="pending">{{ pending().join(',') }}</span>
    </p>
    <p>
      Native terminal events:
      <span data-testid="terminals">{{ terminalText() }}</span>
    </p>
    <p>
      Actor: <span data-testid="actor">{{ actor() }}</span>
    </p>
    @if (phase() !== 'disposed') {
    <p>
      Route: <strong data-testid="route">{{ route() }}</strong
      >; instance: <span data-testid="instance">{{ instance() }}</span>
    </p>
    <p>
      Capacity: <span data-testid="capacity">{{ tree.$.capacity() }}</span>
    </p>
    <label
      >Independent note
      <input #note [value]="tree.$.note()" (input)="editNote(note.value)"
    /></label>
    <p data-testid="note">{{ tree.$.note() }}</p>
    <p>
      Independent progress:
      <span data-testid="progress">{{ tree.$.progress() }}</span
      >; published:
      <span data-testid="published">{{ published().join(',') }}</span
      >; declaration: <span data-testid="declaration">{{ declaration() }}</span>
    </p>
    }
    <button (click)="proposeUnknown()" [disabled]="!canPropose()">
      Propose unknown actor
    </button>
    <button (click)="startProducer()" [disabled]="!canPropose()">
      Start deterministic producer
    </button>
    <button
      (click)="completeProducer()"
      [disabled]="!producerPending() || busy()"
    >
      Complete producer
    </button>
    <button
      (click)="cancelProducer()"
      [disabled]="!producerPending() || busy()"
    >
      Cancel producer
    </button>
    <p data-testid="producer">{{ producerStatus() }}</p>
    <p data-testid="observation">{{ observedText() }}</p>
    <button (click)="review()" [disabled]="phase() !== 'draft'">
      Review proposal
    </button>
    <button (click)="approve()" [disabled]="phase() !== 'reviewed' || busy()">
      Request host approval
    </button>
    <button
      (click)="checkApproval()"
      [disabled]="phase() !== 'approval-pending' || busy()"
    >
      Check host approval
    </button>
    <button (click)="deliver()" [disabled]="phase() !== 'approved' || busy()">
      Deliver approved
    </button>
    <button (click)="reject()" [disabled]="!canReject() || busy()">
      Reject unsent proposal
    </button>
    <button (click)="deliver()" [disabled]="phase() !== 'uncertain' || busy()">
      Retry same command
    </button>
    <button
      (click)="retryLocal()"
      [disabled]="phase() !== 'local-pending' || busy()"
    >
      Retry local settlement
    </button>
    <button (click)="retainReplacement()" [disabled]="!canRetainReplacement()">
      Keep authoritative replacement
    </button>
    <p data-testid="review">{{ reviewText() }}</p>
    <p>
      HTTP client deliveries:
      <span data-testid="deliveries">{{ deliveries() }}</span
      >; client grants awaiting cleanup:
      <span data-testid="grants">{{ grantCount() }}</span>
    </p>
    <p>
      Grant cleanup jobs:
      <span data-testid="cleanup-pending">{{ cleanupPending() }}</span
      >; <span data-testid="cleanup-message">{{ cleanupMessage() }}</span>
    </p>
    <button
      (click)="retryCleanup()"
      [disabled]="cleanupPending() === 0 || busy()"
    >
      Retry grant cleanup
    </button>
    <button (click)="refresh()" [disabled]="busy() || phase() === 'disposed'">
      Refresh authority observation
    </button>
    <button
      (click)="publishProgress()"
      [disabled]="busy() || phase() === 'disposed'"
    >
      Publish independent progress
    </button>
    <button
      (click)="addBlocker()"
      [disabled]="phase() !== 'approved' || hasBlocker()"
    >
      Create newer overlapping owner
    </button>
    <button (click)="resolveBlocker()" [disabled]="!hasBlocker() || busy()">
      Resolve newer owner
    </button>
    <button (click)="tamper()" [disabled]="phase() !== 'approved' || busy()">
      Probe changed approved command
    </button>
    <p data-testid="control">{{ control() }}</p>
    <p>
      Held old row: <span data-testid="old-row">{{ oldRow() }}</span
      >; replacement identity:
      <span data-testid="replacement-distinct">{{
        replacementDistinct()
      }}</span>
    </p>
    <button (click)="dispose()" [disabled]="phase() === 'disposed'">
      Dispose session
    </button>
    <p>
      Tree cleanup callbacks:
      <span data-testid="destroyed">{{ destroyed() }}</span>
    </p>
  `,
})
export class HttpReference implements OnDestroy {
  readonly tree = signalTree(
    { rows: entityMap<Row, string>(), capacity: 10, note: '', progress: 0 },
    { enhancers: [transactions()] }
  );
  readonly phase = signal<Phase>('loading');
  readonly message = signal('Loading authority snapshot');
  readonly serverOutcome = signal('none');
  readonly localOutcome = signal('none');
  readonly localResolution = signal('none');
  readonly pending = signal<number[]>([]);
  readonly terminalText = signal('[]');
  readonly actor = signal('unknown');
  readonly reviewText = signal('none');
  readonly deliveries = signal(0);
  readonly grantCount = signal(0);
  readonly cleanupPending = signal(0);
  readonly cleanupMessage = signal('none');
  readonly published = signal<number[]>([]);
  readonly declaration = signal('none');
  readonly producerPending = signal(false);
  readonly producerStatus = signal('idle');
  readonly observedText = signal('none');
  readonly hasBlocker = signal(false);
  readonly busy = signal(false);
  readonly destroyed = signal(0);
  readonly control = signal('none');
  readonly oldRow = signal('none');
  readonly replacementDistinct = signal('none');
  private observation?: Observation;
  private producer?: Producer;
  private current?: Current;
  private blocker?: PendingTransaction;
  private fault: Fault = 'none';
  private readonly grants = new Map<string, string>();
  private readonly cleanup = new Map<
    string,
    { commandId: string; requestId: string; token?: string }
  >();
  private readonly terminals = new Map<number, 'confirmed' | 'rolled-back'>();
  private readonly reader: NonNullable<
    ReturnType<typeof transactionLifecycleReader>
  >;
  private readonly off: () => void;
  private readonly connection = link(this.tree.$.progress, {
    set: (value) => {
      this.published.update((values) => [...values, value]);
    },
  });
  private readonly operations = new OperationCoordinator<Proposal>({
    apply: async (command) => {
      this.deliveries.update((n) => n + 1);
      const token = this.grants.get(command.commandId);
      if (!token) throw new Error('No grant for this exact command');
      return request('/commands', { command, token });
    },
  });
  constructor() {
    const reader = transactionLifecycleReader(this.tree);
    if (!reader) throw new Error('Native transaction lifecycle unavailable');
    this.reader = reader;
    this.off = reader.subscribe((event) => {
      this.pending.set(
        event.snapshot.pending.map((owner) => owner.transactionId)
      );
      if (event.kind === 'confirmed' || event.kind === 'rolled-back')
        this.terminals.set(event.transactionId, event.kind);
      this.terminalText.set(JSON.stringify([...this.terminals]));
    });
    this.tree.registerCleanup(() => this.destroyed.update((n) => n + 1));
    void this.initialize();
  }
  private async initialize(): Promise<void> {
    try {
      const initial = await request<Initial>('/snapshot');
      this.fault = initial.fault;
      this.installObservation(initial.observation);
      this.phase.set('idle');
      this.message.set('No proposal or approval');
    } catch (error) {
      this.message.set(String(error));
    }
  }
  route(): string {
    return this.tree.$.rows.byId('delivery-1')?.route() ?? 'absent';
  }
  instance(): string {
    return this.tree.$.rows.byId('delivery-1')?.instance() ?? 'absent';
  }
  canPropose(): boolean {
    return (
      !this.current &&
      !this.producer &&
      !this.blocker &&
      !this.busy() &&
      this.cleanup.size === 0 &&
      !['loading', 'disposed'].includes(this.phase())
    );
  }
  canReject(): boolean {
    return ['draft', 'reviewed', 'approval-pending', 'approved'].includes(
      this.phase()
    );
  }
  private installObservation(observation: Observation): void {
    const previous = this.tree.$.rows.byId('delivery-1');
    external(() => {
      if (!previous || previous.instance() !== observation.instance) {
        if (previous) this.tree.$.rows.removeOne('delivery-1');
        this.tree.$.rows.addOne({
          id: 'delivery-1',
          instance: observation.instance,
          route: observation.values.route,
        });
      }
      this.tree.$.capacity.set(observation.values.capacity);
    });
    if (previous && this.observation?.instance !== observation.instance) {
      this.replacementDistinct.set(
        String(previous !== this.tree.$.rows.byIdOrFail('delivery-1'))
      );
      this.describeOld(previous);
    }
    this.observation = observation;
  }
  private describeOld(row: HeldRow): void {
    try {
      this.oldRow.set(
        JSON.stringify({ instance: row.instance(), route: row.route() })
      );
    } catch (error) {
      this.oldRow.set(`old lifetime read: ${String(error)}`);
    }
  }
  async refresh(): Promise<void> {
    if (this.busy() || this.phase() === 'disposed') return;
    this.busy.set(true);
    try {
      this.installObservation(
        (await request<Initial>('/snapshot')).observation
      );
      this.message.set(
        'Fresh authority observation; existing proposal evidence is unchanged'
      );
    } catch (error) {
      this.message.set(String(error));
    } finally {
      this.busy.set(false);
    }
  }
  private capture(actor: Actor): Producer {
    const observation = this.observation;
    if (!observation) throw new Error('No observation');
    const runId = crypto.randomUUID();
    const stream = dispatchToolStream<Proposal>({
      coordinator: this.operations,
      actor,
      makeProposal: (patch, reads) => makeProposal(observation, patch, reads),
    });
    stream.consume({ type: 'RUN_STARTED', threadId: 'http-browser', runId });
    stream.consume({
      type: 'TOOL_CALL_START',
      toolCallId: 'dispatch',
      toolCallName: 'propose_dispatch',
    });
    return { observation, runId, stream };
  }
  private complete(producer: Producer): void {
    const route = producer.observation.values.capacity >= 10 ? 'west' : 'south';
    const args = JSON.stringify({ patch: { route }, reads: ['capacity'] });
    try {
      const cut = Math.floor(args.length / 2);
      producer.stream.consume({
        type: 'TOOL_CALL_ARGS',
        toolCallId: 'dispatch',
        delta: args.slice(0, cut),
      });
      producer.stream.consume({
        type: 'TOOL_CALL_ARGS',
        toolCallId: 'dispatch',
        delta: args.slice(cut),
      });
      const operation = producer.stream.consume({
        type: 'TOOL_CALL_END',
        toolCallId: 'dispatch',
      });
      if (!operation) throw new Error('Producer did not propose');
      const held = this.tree.$.rows.byIdOrFail('delivery-1');
      const before = new Set(
        this.reader.snapshot().pending.map((owner) => owner.transactionId)
      );
      const local = this.tree.transact(() =>
        held.route.set(operation.proposal.patch.route)
      );
      const owners = this.reader
        .snapshot()
        .pending.filter((owner) => !before.has(owner.transactionId));
      if (owners.length !== 1)
        throw new Error('Expected exactly one new native owner');
      this.current = {
        id: operation.id,
        local,
        nativeId: owners[0].transactionId,
        held,
      };
      this.describeOld(held);
      this.phase.set('draft');
      this.serverOutcome.set('none');
      this.localOutcome.set('pending');
      this.localResolution.set('none');
      this.reviewText.set('none');
      this.actor.set(
        operation.actor.kind === 'unknown'
          ? 'unknown'
          : `declared: ${operation.actor.label} (not authenticated)`
      );
      producer.stream.consume({
        type: 'RUN_FINISHED',
        threadId: 'http-browser',
        runId: producer.runId,
      });
    } finally {
      producer.stream.dispose();
    }
  }
  proposeUnknown(): void {
    if (this.canPropose()) this.complete(this.capture({ kind: 'unknown' }));
  }
  startProducer(): void {
    if (!this.canPropose()) return;
    this.producer = this.capture({
      kind: 'declared',
      label: 'deterministic-dispatch',
    });
    this.producerPending.set(true);
    this.producerStatus.set('awaiting completion');
    this.observedText.set(JSON.stringify(this.producer.observation));
  }
  completeProducer(): void {
    if (!this.producer || this.busy()) return;
    const producer = this.producer;
    this.producer = undefined;
    this.producerPending.set(false);
    this.complete(producer);
    this.producerStatus.set('completed');
  }
  cancelProducer(): void {
    this.producer?.stream.dispose();
    this.producer = undefined;
    this.producerPending.set(false);
    this.producerStatus.set('cancelled before proposal');
  }
  review(): void {
    if (!this.current || this.phase() !== 'draft') return;
    this.current.binding = this.operations.review(this.current.id);
    this.current.command = immutable({
      ...this.current.binding,
      commandId: JSON.stringify([
        this.current.id,
        this.current.binding.revision,
      ]),
    });
    this.reviewText.set(JSON.stringify(this.current.command));
    this.phase.set('reviewed');
  }
  async approve(): Promise<void> {
    const current = this.current;
    if (!current?.binding || !current.command || this.phase() !== 'reviewed')
      return;
    this.busy.set(true);
    try {
      current.reviewRequestId ??= crypto.randomUUID();
      const result = await request<{
        requestId: string;
        commandId: string;
        status: 'pending';
      }>('/review', {
        command: current.command,
        requestId: current.reviewRequestId,
      });
      if (
        result.requestId !== current.reviewRequestId ||
        result.commandId !== current.command.commandId ||
        result.status !== 'pending'
      )
        throw new Error('Uncorrelated review request');
      this.phase.set('approval-pending');
      this.message.set(
        'Transport requested review; separate trusted host approval is still required'
      );
    } catch (error) {
      this.message.set(String(error));
    } finally {
      this.busy.set(false);
    }
  }
  async checkApproval(): Promise<void> {
    const current = this.current;
    if (
      !current?.binding ||
      !current.command ||
      !current.reviewRequestId ||
      this.phase() !== 'approval-pending' ||
      this.busy()
    )
      return;
    this.busy.set(true);
    try {
      const result = await request<{
        requestId: string;
        commandId: string;
        status: 'pending' | 'approved';
        token?: string;
      }>(`/review/${encodeURIComponent(current.reviewRequestId)}`);
      if (
        result.requestId !== current.reviewRequestId ||
        result.commandId !== current.command.commandId
      )
        throw new Error('Uncorrelated host approval');
      if (result.status !== 'approved') {
        this.message.set('Host approval is still pending');
        return;
      }
      if (!result.token) throw new Error('Approved response lacks a grant');
      this.grants.set(current.command.commandId, result.token);
      this.grantCount.set(this.grants.size);
      this.operations.approve(current.binding);
      this.phase.set('approved');
    } catch (error) {
      this.message.set(String(error));
    } finally {
      this.busy.set(false);
    }
  }
  private queueCleanup(current: Current): void {
    if (!current.command || !current.reviewRequestId) return;
    const commandId = current.command.commandId;
    const token = this.grants.get(commandId);
    this.cleanup.set(commandId, {
      commandId,
      requestId: current.reviewRequestId,
      ...(token === undefined ? {} : { token }),
    });
    this.cleanupPending.set(this.cleanup.size);
  }
  private async drainCleanup(): Promise<void> {
    for (const [commandId, job] of this.cleanup) {
      try {
        await request('/revoke', job);
        this.cleanup.delete(commandId);
        this.grants.delete(commandId);
        this.cleanupMessage.set('Grant cleanup acknowledged');
      } catch (error) {
        this.cleanupMessage.set(
          `Cleanup acknowledgment uncertain; retry cleanup only. ${String(
            error
          )}`
        );
      }
    }
    this.cleanupPending.set(this.cleanup.size);
    this.grantCount.set(this.grants.size);
  }
  async retryCleanup(): Promise<void> {
    if (this.busy() || !this.cleanup.size) return;
    this.busy.set(true);
    try {
      await this.drainCleanup();
    } finally {
      this.busy.set(false);
    }
  }
  async deliver(): Promise<void> {
    const current = this.current;
    if (
      !current ||
      !['approved', 'uncertain'].includes(this.phase()) ||
      this.busy()
    )
      return;
    this.phase.set('delivering');
    this.busy.set(true);
    try {
      const outcome = await this.operations.deliver(current.id);
      if (outcome.status === 'uncertain') {
        this.serverOutcome.set('uncertain');
        this.phase.set('uncertain');
        this.message.set(
          'Unknown remote outcome: retain native authority and retry the same command'
        );
        return;
      }
      if (!['succeeded', 'failed'].includes(outcome.status))
        throw new Error('Nonterminal response');
      current.outcome = outcome;
      this.serverOutcome.set(
        outcome.status === 'succeeded'
          ? 'applied'
          : `rejected:${String(outcome.receipt?.reason)}`
      );
      this.queueCleanup(current);
      this.settleLocal(current);
      await this.drainCleanup();
    } catch (error) {
      this.message.set(String(error));
    } finally {
      this.busy.set(false);
    }
  }
  private settleLocal(
    current: Current,
    resolution: 'normal' | 'retain-authoritative-replacement' = 'normal'
  ): void {
    const accepted = current.outcome?.status === 'succeeded';
    const retainReplacement = resolution === 'retain-authoritative-replacement';
    if (!current.withdrawn && !current.outcome)
      throw new Error('No settlement decision');
    if (accepted && this.fault === 'skip-native-settlement') {
      this.localOutcome.set('confirmed');
      this.phase.set('succeeded');
      return;
    }
    const expected =
      accepted || retainReplacement ? 'confirmed' : 'rolled-back';
    let failure = '';
    if (!this.terminals.has(current.nativeId)) {
      try {
        if (accepted || retainReplacement) current.local.confirm();
        else current.local.rollback();
      } catch (error) {
        failure = String(error);
      }
    }
    const nativePending = this.reader
      .snapshot()
      .pending.some((owner) => owner.transactionId === current.nativeId);
    const terminal = this.terminals.get(current.nativeId);
    this.localOutcome.set(
      terminal ?? (nativePending ? 'pending' : 'unverified')
    );
    if (nativePending || terminal !== expected || this.blocker) {
      this.phase.set('local-pending');
      this.message.set(
        `Resolve remaining native ownership; terminal server receipt is retained. ${failure}`
      );
      return;
    }
    this.describeOld(current.held);
    this.operations.forget(current.id);
    this.current = undefined;
    this.phase.set(
      current.withdrawn ? 'rejected' : accepted ? 'succeeded' : 'failed'
    );
    this.message.set(
      `Remote ${this.serverOutcome()}; native ${terminal}. ${failure}`
    );
  }
  canRetainReplacement(): boolean {
    const current = this.current,
      observation = this.observation;
    if (
      !current ||
      !observation ||
      this.busy() ||
      this.blocker ||
      this.phase() !== 'local-pending' ||
      current.outcome?.status !== 'failed' ||
      current.outcome.receipt?.reason !== 'instance' ||
      !current.command ||
      current.command.proposal.expectedInstance === observation.instance
    )
      return false;
    const replacement = this.tree.$.rows.byId('delivery-1');
    const pending = this.reader.snapshot().pending;
    const patchKeys = Object.keys(current.command.proposal.patch);
    return (
      !!replacement &&
      replacement !== current.held &&
      current.command.proposal.entityId === 'delivery-1' &&
      patchKeys.length === 1 &&
      patchKeys[0] === 'route' &&
      replacement.instance() === observation.instance &&
      replacement.route() === observation.values.route &&
      pending.length === 1 &&
      pending[0].transactionId === current.nativeId
    );
  }
  retainReplacement(): void {
    if (!this.canRetainReplacement() || !this.current) return;
    // This reference's native proposal writes only the retired row's route.
    // Confirmation closes that local ownership; it does not undo the replacement
    // or change the terminal rejected server receipt. Broader transactions need
    // their own recovery policy, especially when confirmation releases effects.
    this.settleLocal(this.current, 'retain-authoritative-replacement');
    if (!this.current)
      this.localResolution.set(
        'Confirmed obsolete local ownership after authoritative supersession; server command remains rejected'
      );
  }
  retryLocal(): void {
    if (this.current && this.phase() === 'local-pending' && !this.busy())
      this.settleLocal(this.current);
  }
  async reject(): Promise<void> {
    const current = this.current;
    if (!current || !this.canReject() || this.busy()) return;
    this.busy.set(true);
    try {
      this.operations.reject(current.id);
      current.withdrawn = true;
      this.queueCleanup(current);
      this.settleLocal(current);
      await this.drainCleanup();
    } finally {
      this.busy.set(false);
    }
  }
  addBlocker(): void {
    if (this.phase() !== 'approved' || this.blocker) return;
    this.blocker = this.tree.transact(() =>
      this.tree.$.rows.byIdOrFail('delivery-1').route.set('east')
    );
    this.hasBlocker.set(true);
  }
  resolveBlocker(): void {
    if (!this.blocker || this.busy()) return;
    try {
      this.blocker.rollback();
      this.blocker = undefined;
      this.hasBlocker.set(false);
    } catch (error) {
      this.message.set(String(error));
    }
  }
  editNote(value: string): void {
    if (this.phase() !== 'disposed') this.tree.$.note.set(value);
  }
  async publishProgress(): Promise<void> {
    const next = this.tree.$.progress() + 1;
    const receipt = this.connection.declare({ kind: 'independent' }, () =>
      this.tree.$.progress.set(next)
    );
    await this.connection.settled();
    this.declaration.set(receipt.read().state);
  }
  async tamper(): Promise<void> {
    const command = this.current?.command;
    if (!command || this.phase() !== 'approved') return;
    this.busy.set(true);
    try {
      await request('/commands', {
        command: {
          ...command,
          proposal: { ...command.proposal, patch: { route: 'forged' } },
        },
        token: this.grants.get(command.commandId),
      });
      this.control.set('UNEXPECTED tamper accepted');
    } catch {
      this.control.set('approval-mismatch-rejected');
    } finally {
      this.busy.set(false);
    }
  }
  async dispose(): Promise<void> {
    if (this.phase() === 'disposed') return;
    if (
      this.busy() ||
      this.blocker ||
      ['uncertain', 'local-pending'].includes(this.phase())
    ) {
      this.message.set(
        'Disposal blocked: unresolved responsibility retained; no navigation or restart safety is claimed'
      );
      return;
    }
    if (this.current) {
      await this.reject();
      if (this.current) return;
    }
    if (this.cleanup.size) {
      this.message.set(
        'Disposal blocked: grant cleanup acknowledgment is unresolved; retry cleanup without resending the command'
      );
      return;
    }
    if (this.producer) this.cancelProducer();
    if (this.reader.snapshot().pending.length) {
      this.message.set('Disposal blocked: native owners remain');
      return;
    }
    this.operations.dispose();
    this.connection.dispose();
    this.off();
    this.tree.destroy();
    this.phase.set('disposed');
  }
  ngOnDestroy(): void {
    void this.dispose();
  }
}
