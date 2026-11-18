import { Component, signal, type OnDestroy, type OnInit } from '@angular/core';
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
  request,
  RequestFailure,
  type AuditEvent,
  type AuditPage,
  type Command,
  type Observation,
  type Receipt,
  type Review,
  type Session,
  type Values,
} from './model.js';

type Row = Values & { id: string; instance: string };
type Operation = {
  review: Review;
  native?: PendingTransaction;
  nativeId?: number;
  local: string;
  phase: string;
  receipt?: Receipt;
  busy: boolean;
  recovered: boolean;
  deliveryStarted?: string;
  receiptChecked?: string;
};

@Component({
  selector: 'oversight-application',
  standalone: true,
  template: `
    <header>
      <p class="eyebrow">Dispatch workspace</p>
      <h1>People and agents, with review</h1>
      <p>
        Prepare changes, review the exact request, then track what the server
        actually applied.
      </p>
    </header>
    <p role="status" data-testid="status">{{ status() }}</p>
    @if (session(); as context) {
    <section aria-label="Signed-in authority">
      <h2>Signed in</h2>
      <p>
        <strong data-testid="principal">{{ context.principal }}</strong> ·
        <span data-testid="role">{{ context.role }}</span>
      </p>
      <p>
        Tenant <span data-testid="tenant">{{ context.tenant }}</span> ·
        destination <span data-testid="destination">{{ destination() }}</span>
      </p>
      <p class="muted">
        Session <span data-testid="session-id">{{ context.sessionId }}</span> ·
        epoch {{ context.epoch }}
      </p>
      <button
        (click)="refresh()"
        [disabled]="closed() || preparing() || refreshing()"
      >
        Refresh reviews and outcomes
      </button>
      <button (click)="stop()" [disabled]="closed() || context.stopped">
        Stop new work in this session
      </button>
      <button (click)="closeWorkspace()" [disabled]="closed()">
        Close workspace
      </button>
      <p data-testid="workspace-state">
        {{
          closed()
            ? 'Closed — remote outcomes require reconciliation'
            : context.stopped
            ? 'Stopped — existing outcomes remain available'
            : 'Open'
        }}
      </p>
    </section>
    @if (!closed()) {
    <section aria-label="Shipment">
      <h2>Shipment view</h2>
      <p>
        Local preview includes pending proposals. A changed field does not prove
        that the server applied it.
      </p>
      <dl>
        <dt>Route</dt>
        <dd data-testid="route">{{ row()?.route() }}</dd>
        <dt>Window</dt>
        <dd data-testid="window">{{ row()?.window() }}</dd>
        <dt>Capacity</dt>
        <dd data-testid="capacity">{{ row()?.capacity() }}</dd>
      </dl>
      @if (authorityView(); as observed) {
      <p data-testid="server-snapshot">
        Last fetched server snapshot (browser time {{ snapshotFetchedAt() }},
        may become stale): route {{ observed.values.route }}, window
        {{ observed.values.window }}, capacity {{ observed.values.capacity }}.
      </p>
      }
      <p class="muted">
        Entity lifetime
        <span data-testid="instance">{{ row()?.instance() }}</span>
      </p>
      @if (context.role === 'proposer') {
      <label
        >Independent working note<input
          #note
          [value]="tree.$.humanNote()"
          (input)="editNote(note.value)"
      /></label>
      <p data-testid="human-note">{{ tree.$.humanNote() }}</p>
      <div class="actions">
        <button
          (click)="propose('route')"
          [disabled]="context.stopped || preparing() || refreshing()"
        >
          Prepare route proposal</button
        ><button
          (click)="propose('window')"
          [disabled]="context.stopped || preparing() || refreshing()"
        >
          Prepare window proposal
        </button>
      </div>
      <button (click)="publishProgress()">Publish independent progress</button>
      <p>
        Published progress:
        <span data-testid="progress">{{
          published().join(',') || 'none published'
        }}</span>
      </p>
      }
      <p>
        Unresolved local operations:
        <span data-testid="pending">{{ pending().length }}</span>
        <small class="muted">
          · diagnostic owner IDs:
          <span data-testid="pending-ids">{{
            pending().join(',')
          }}</span></small
        >
      </p>
    </section>
    <section aria-label="Reviewed changes">
      <h2>
        {{
          context.role === 'reviewer'
            ? 'Review exact requests'
            : 'Your operations'
        }}
      </h2>
      <p data-testid="review-coverage">{{ reviewCoverage() }}</p>
      @if (operations().length === 0) {
      <p data-testid="empty-operations">No operations in this session.</p>
      } @for (operation of operations(); track operation.review.requestId) {
      <article
        class="operation"
        [attr.data-operation]="operation.review.command.operationId"
        [attr.data-request]="operation.review.requestId"
      >
        <h3>{{ describe(operation.review.command) }}</h3>
        <p>
          Authenticated proposer account:
          <strong class="proposer">{{ operation.review.principal }}</strong>
        </p>
        <p>
          Agent attribution:
          <span class="declared-actor">{{
            operation.review.command.actor.kind === 'unknown'
              ? 'unknown'
              : 'declared by the application; not an authenticated identity'
          }}</span>
        </p>
        <p>
          Scope: {{ context.tenant }} / {{ destination() }} · entity
          {{ operation.review.command.proposal.entityId }}
        </p>
        <p class="muted">
          Observed lifetime:
          <span class="observed-instance">{{
            operation.review.command.proposal.expectedInstance
          }}</span>
        </p>
        <p>
          Expected field revisions:
          <span class="expected">{{ expected(operation.review.command) }}</span>
        </p>
        <p>
          Review:
          <strong class="review-status">{{ operation.review.status }}</strong> ·
          authenticated reviewer account:
          <span class="reviewer">{{
            operation.review.reviewer ?? 'none'
          }}</span>
        </p>
        <p>
          Delivery: <strong class="delivery">{{ operation.phase }}</strong> ·
          local state: <span class="native">{{ operation.local }}</span>
        </p>
        <p>
          Authoritative receipt:
          <span class="receipt">{{
            operation.receipt
              ? operation.receipt.status +
                (operation.receipt.reason ? ':' + operation.receipt.reason : '')
              : 'not observed'
          }}</span>
        </p>
        <p class="muted">
          Command
          <span class="command-id">{{
            operation.review.command.commandId
          }}</span>
          · native owner
          <span class="native-id">{{
            operation.nativeId ?? 'none in this page'
          }}</span>
        </p>
        @if (operation.deliveryStarted) {
        <p class="muted">
          Delivery started (browser clock): {{ operation.deliveryStarted }}.
          Manual receipt lookup:
          {{ operation.receiptChecked ?? 'not requested' }}.
        </p>
        } @if (operation.receipt; as receipt) {
        <p class="muted">
          Receipt recorded by authority at {{ receipt.timestamp }}.
        </p>
        } @if (operation.receipt?.reason === 'instance') {
        <p>
          Rejected: the entity lifetime changed. Compare the proposal's observed
          lifetime above with the current shipment lifetime.
        </p>
        } @if (operation.local === 'recovery required') {
        <p>
          Retry local settlement repeats local cleanup only. Keep authoritative
          replacement resolves obsolete local work without resending the
          command; the server rejection remains.
        </p>
        } @if (context.role === 'reviewer') {
        <button
          (click)="decide(operation, 'approve')"
          [disabled]="operation.busy || operation.review.status !== 'pending'"
        >
          Approve exact request
        </button>
        <button
          (click)="decide(operation, 'reject')"
          [disabled]="operation.busy || operation.review.status !== 'pending'"
        >
          Reject request
        </button>
        <button
          (click)="decide(operation, 'revoke')"
          [disabled]="operation.busy || operation.review.status !== 'approved'"
        >
          Revoke approval
        </button>
        } @else {
        <button (click)="lookup(operation)">Check authoritative receipt</button>
        <button
          (click)="deliver(operation)"
          [disabled]="
            operation.busy ||
            !!operation.receipt ||
            (operation.review.status !== 'approved' &&
              operation.phase !== 'uncertain') ||
            context.stopped
          "
        >
          {{
            operation.phase === 'uncertain'
              ? 'Retry same approved command'
              : 'Deliver approved request'
          }}
        </button>
        @if (operation.phase === 'uncertain' || operation.busy) {
        <p>
          Check the receipt first. Delivery can still be in flight. Retrying
          resends this exact command ID; this authority returns the original
          durable receipt for a duplicate.
        </p>
        }
        <button
          (click)="settle(operation)"
          [disabled]="operation.busy || operation.local !== 'recovery required'"
        >
          Retry local settlement
        </button>
        <button
          (click)="keepReplacement(operation)"
          [disabled]="!canKeepReplacement(operation)"
        >
          Keep authoritative replacement
        </button>
        }
      </article>
      }
    </section>
    <section aria-label="Investigation">
      <h2>Evidence and gaps</h2>
      <p>
        Metadata only. Proposed values, notes, access tokens and agent text are
        excluded from this evidence panel and its export. Authorized proposal
        details remain visible above.
      </p>
      <button (click)="loadEvidence()">Load recent evidence</button
      ><button (click)="resetEvidence()">
        Load earliest available evidence
      </button>
      <p class="coverage" data-testid="evidence-coverage">{{ coverage() }}</p>
      <p>{{ evidenceRange() }}</p>
      <label
        >Filter retained events by command<input
          #filter
          [value]="evidenceFilter()"
          (input)="evidenceFilter.set(filter.value)"
      /></label>
      <p class="muted">
        Exports include all {{ evidence().length }} events held in this browser,
        regardless of filter, and their coverage warning. Other events retained
        by the authority are not included.
      </p>
      <p data-testid="evidence-cursor">
        Last observed sequence: {{ cursor() }}
      </p>
      <ol data-testid="evidence">
        @for (event of filteredEvidence(); track event.sequence) {
        <li>
          {{ event.sequence }} · {{ event.kind }} ·
          {{ event.principal ?? 'Actor not recorded' }} ·
          {{ event.commandId ?? 'No command association recorded' }} ·
          {{ event.status ?? '' }}
          {{ event.reason ?? '' }}
        </li>
        }
      </ol>
      <button (click)="exportEvidence()">Export redacted evidence</button>
      <pre data-testid="evidence-export">{{ exported() }}</pre>
    </section>
    } }
    <footer>
      Local application proof: host-provisioned identities and a durable SQLite
      authority. Production identity-provider integration and human
      comprehension are evaluated separately.
    </footer>
  `,
  styles: [
    `
      .coverage {
        background: #fff4cd;
        border-left: 4px solid #a36b00;
        padding: 12px;
      }
      ol {
        max-height: 22rem;
        overflow: auto;
      }
      :host {
        display: block;
        max-width: 1080px;
        margin: auto;
        padding: 28px;
        color: #172a36;
        font: 16px/1.5 system-ui;
      }
      header {
        border-bottom: 3px solid #176b5b;
        padding-bottom: 20px;
      }
      .eyebrow {
        color: #176b5b;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-size: 12px;
        font-weight: 700;
      }
      h1 {
        font-size: 32px;
        line-height: 1.2;
      }
      h2 {
        font-size: 22px;
      }
      h3 {
        font-size: 18px;
      }
      section {
        padding: 20px 0;
        border-bottom: 1px solid #ccd7dc;
      }
      .muted,
      footer {
        color: #56666f;
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      button {
        font: inherit;
        background: #edf5f2;
        border: 1px solid #749b8d;
        border-radius: 5px;
        padding: 8px 12px;
        margin: 4px 8px 4px 0;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      input {
        display: block;
        font: inherit;
        padding: 10px;
        width: min(90%, 600px);
        border: 1px solid #80939c;
        border-radius: 4px;
      }
      .operation {
        border: 1px solid #ccd7dc;
        border-left: 4px solid #176b5b;
        border-radius: 6px;
        padding: 16px;
        margin: 16px 0;
        overflow-wrap: anywhere;
      }
      dl {
        display: grid;
        grid-template-columns: 100px 1fr;
        gap: 8px;
      }
      dd {
        margin: 0;
        font-weight: 700;
      }
      pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        max-height: 300px;
        overflow: auto;
      }
      footer {
        padding-top: 24px;
      }
    `,
  ],
})
export class OversightApplication implements OnInit, OnDestroy {
  readonly tree = signalTree(
    {
      deliveries: entityMap<Row, string>({ selectId: (value) => value.id }),
      humanNote: '',
      progress: 0,
    },
    { enhancers: [transactions()] }
  );
  readonly session = signal<Session | undefined>(undefined);
  readonly destination = signal('dispatch');
  readonly status = signal('Opening workspace…');
  readonly closed = signal(false);
  readonly preparing = signal(false);
  readonly refreshing = signal(false);
  readonly operations = signal<Operation[]>([]);
  readonly reviewCoverage = signal('Review history has not been loaded.');
  readonly authorityView = signal<Observation | undefined>(undefined);
  readonly snapshotFetchedAt = signal('not yet fetched');
  readonly pending = signal<number[]>([]);
  readonly published = signal<number[]>([]);
  readonly evidence = signal<AuditEvent[]>([]);
  readonly cursor = signal(0);
  readonly coverage = signal('No evidence loaded — completeness unknown');
  readonly exported = signal('');
  readonly evidenceRange = signal('Retained range unknown.');
  readonly evidenceFilter = signal('');
  private evidenceLoading = false;
  private generation = 0;
  private snapshotEpoch = 0;
  private observed: Observation | undefined;
  private readonly reader = (() => {
    const reader = transactionLifecycleReader(this.tree);
    if (!reader) throw new Error('Transaction observation is unavailable');
    return reader;
  })();
  private readonly off = this.reader.subscribe(() =>
    this.pending.set(
      this.reader.snapshot().pending.map((value) => value.transactionId)
    )
  );
  private readonly progress = link(this.tree.$.progress, {
    set: (value) => {
      this.published.update((values) => [...values, value]);
    },
  });
  row() {
    return this.tree.$.deliveries.byId('delivery-1');
  }
  private prefix() {
    const session = this.session();
    if (!session) throw new Error('Session unavailable');
    return `/api/${encodeURIComponent(session.tenant)}/${encodeURIComponent(
      this.destination()
    )}/`;
  }
  private live(generation: number) {
    return !this.closed() && generation === this.generation;
  }
  private update() {
    this.operations.update((values) => [...values]);
  }
  private error(error: unknown) {
    return error instanceof RequestFailure
      ? error.message
      : 'Transport outcome unknown; check the authoritative receipt.';
  }
  async ngOnInit() {
    const generation = this.generation;
    try {
      const context = await request<Session>('/api/session');
      if (!this.live(generation)) return;
      this.session.set(context);
      this.destination.set(context.destinations[0]);
      await this.refresh();
    } catch (error) {
      this.status.set(this.error(error));
    }
  }
  private installSnapshot(observation: Observation) {
    external(() => {
      const current = this.row();
      if (current && current.instance() !== observation.instance)
        this.tree.$.deliveries.removeOne('delivery-1');
      this.tree.$.deliveries.upsertOne({
        id: 'delivery-1',
        instance: observation.instance,
        ...observation.values,
      });
    });
    this.observed = observation;
    this.authorityView.set(observation);
    this.snapshotFetchedAt.set(new Date().toISOString());
  }
  async refresh() {
    if (this.refreshing() || this.preparing() || this.closed()) return;
    this.refreshing.set(true);
    const snapshotEpoch = ++this.snapshotEpoch;
    const generation = this.generation;
    try {
      const [observation, response] = await Promise.all([
        request<Observation>(this.prefix() + 'snapshot'),
        request<{
          reviews: Review[];
          retention: { terminalLimit: number; terminalTruncated: boolean };
        }>(this.prefix() + 'reviews'),
      ]);
      if (!this.live(generation)) return;
      // Do not overwrite live optimistic owners during an ordinary refresh.
      if (snapshotEpoch === this.snapshotEpoch) {
        this.authorityView.set(observation);
        this.snapshotFetchedAt.set(new Date().toISOString());
        if (
          !this.observed ||
          this.observed.instance !== observation.instance ||
          this.pending().length === 0
        )
          this.installSnapshot(observation);
      }
      const known = new Map(
        this.operations().map((op) => [op.review.requestId, op])
      );
      const next = response.reviews.map((review) => {
        const prior = known.get(review.requestId);
        if (prior) {
          prior.review = review;
          return prior;
        }
        const operation: Operation = {
          review,
          local: 'not staged in this page',
          phase: 'not delivered from this page',
          busy: false,
          recovered: true,
        };
        return operation;
      });
      // A bounded server history page is not authority to abandon local owners
      // or an in-flight command. Retain these and reconcile by their exact ID.
      const listed = new Set(
        response.reviews.map((review) => review.requestId)
      );
      for (const prior of known.values()) {
        if (
          listed.has(prior.review.requestId) ||
          (!prior.native && !prior.busy && prior.phase !== 'uncertain')
        )
          continue;
        next.push(prior);
        try {
          const review = await request<Review>(
            this.prefix() +
              `reviews/${encodeURIComponent(prior.review.requestId)}`
          );
          if (!this.live(generation)) return;
          prior.review = review;
        } catch {
          if (!this.live(generation)) return;
          this.status.set(
            'An unresolved operation is outside the recent list; its owner and command identity are retained.'
          );
        }
      }
      this.reviewCoverage.set(
        response.retention.terminalTruncated
          ? `Recent history only: older terminal reviews are omitted after ${response.retention.terminalLimit}. Unresolved local operations are retained separately.`
          : 'Current-session or authorized-scope reviews loaded; this is not a complete event history.'
      );
      this.operations.set(next);
      if (this.session()?.role === 'proposer') {
        for (const op of next) {
          if (op.busy) continue;
          if (
            ['applied', 'rejected', 'revoked'].includes(op.review.status) ||
            op.phase === 'uncertain'
          )
            await this.lookup(op, false);
          else if (
            !op.native &&
            !op.receipt &&
            snapshotEpoch === this.snapshotEpoch &&
            this.canRestage(op.review.command, observation)
          )
            this.stage(op);
        }
        await this.reconcileSnapshot();
      }
      if (this.live(generation))
        this.status.set(
          'Reviews refreshed. Server outcomes and local ownership are shown separately.'
        );
    } catch (error) {
      if (this.live(generation)) this.status.set(this.error(error));
    } finally {
      this.refreshing.set(false);
    }
  }
  private canRestage(command: Command, observation: Observation) {
    return (
      command.sessionId === this.session()?.sessionId &&
      command.proposal.expectedInstance === observation.instance &&
      Object.entries(command.proposal.expected).every(
        ([key, revision]) =>
          observation.versions[key as keyof Values] === revision
      )
    );
  }
  private stage(operation: Operation) {
    const row = this.row();
    if (!row) throw new Error('Shipment unavailable');
    const before = new Set(
      this.reader.snapshot().pending.map((value) => value.transactionId)
    );
    operation.native = this.tree.transact(() => {
      for (const [key, value] of Object.entries(
        operation.review.command.proposal.patch
      )) {
        if (key === 'route' && typeof value === 'string') row.route.set(value);
        else if (key === 'window' && typeof value === 'string')
          row.window.set(value);
      }
    });
    operation.nativeId = this.reader
      .snapshot()
      .pending.find((value) => !before.has(value.transactionId))?.transactionId;
    if (operation.nativeId === undefined)
      throw new Error('Native ownership not observed');
    operation.local = operation.recovered
      ? 'pending — reconstructed in this page'
      : 'pending';
    this.update();
  }
  async propose(field: 'route' | 'window') {
    const session = this.session(),
      observed = this.observed,
      generation = this.generation;
    if (
      !session ||
      !observed ||
      session.stopped ||
      this.closed() ||
      this.preparing() ||
      this.refreshing()
    )
      return;
    if (
      this.operations().some(
        (op) => op.native && field in op.review.command.proposal.patch
      )
    ) {
      this.status.set(
        'Resolve the existing proposal for this field before preparing another.'
      );
      return;
    }
    // Registering newly prepared owners and rebuilding the displayed review
    // list are serialized. Deliveries remain independently concurrent.
    this.preparing.set(true);
    const operationId = crypto.randomUUID();
    const command: Command = {
      commandId: crypto.randomUUID(),
      operationId,
      sessionId: session.sessionId,
      sessionEpoch: session.epoch,
      actor: { kind: 'declared', label: 'dispatch-agent' },
      proposal: {
        entityId: 'delivery-1',
        expectedInstance: observed.instance,
        patch: field === 'route' ? { route: 'west' } : { window: '10:00' },
        expected:
          field === 'route'
            ? {
                route: observed.versions.route,
                capacity: observed.versions.capacity,
              }
            : { window: observed.versions.window },
      },
    };
    try {
      const review = await request<Review>(this.prefix() + 'reviews', {
        requestId: crypto.randomUUID(),
        command,
      });
      if (!this.live(generation)) return;
      const operation: Operation = {
        review,
        local: 'not staged',
        phase: 'awaiting review',
        busy: false,
        recovered: false,
      };
      this.operations.update((values) => [...values, operation]);
      if (!this.session()?.stopped) this.stage(operation);
      this.status.set(
        'Proposal awaits an independently authenticated reviewer. No command has been delivered.'
      );
    } catch (error) {
      if (this.live(generation)) this.status.set(this.error(error));
    } finally {
      this.preparing.set(false);
    }
  }
  describe(command: Command) {
    return Object.entries(command.proposal.patch)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }
  expected(command: Command) {
    return Object.entries(command.proposal.expected)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
  }
  editNote(value: string) {
    if (!this.closed()) this.tree.$.humanNote.set(value);
  }
  publishProgress() {
    this.progress.declare({ kind: 'independent' }, () =>
      this.tree.$.progress.update((value) => value + 1)
    );
  }
  async decide(
    operation: Operation,
    decision: 'approve' | 'reject' | 'revoke'
  ) {
    const generation = this.generation;
    operation.busy = true;
    this.update();
    try {
      const review = await request<Review>(
        this.prefix() +
          `reviews/${encodeURIComponent(operation.review.requestId)}/decision`,
        { decision, expectedDigest: operation.review.digest }
      );
      if (this.live(generation)) {
        operation.review = review;
        this.status.set(
          `Review ${review.status}. The command has not been executed by this decision.`
        );
      }
    } catch (error) {
      if (this.live(generation)) this.status.set(this.error(error));
    } finally {
      if (this.live(generation)) {
        operation.busy = false;
        this.update();
      }
    }
  }
  async deliver(operation: Operation) {
    const generation = this.generation;
    if (operation.busy || operation.receipt || this.closed()) return;
    operation.busy = true;
    operation.phase = 'delivering — outcome not yet known';
    operation.deliveryStarted = new Date().toISOString();
    this.update();
    try {
      const receipt = await request<Receipt>(this.prefix() + 'commands', {
        requestId: operation.review.requestId,
        command: operation.review.command,
      });
      if (this.live(generation)) this.acceptReceipt(operation, receipt);
    } catch (error) {
      if (this.live(generation)) {
        operation.phase = 'uncertain';
        this.status.set(this.error(error));
      }
    } finally {
      if (this.live(generation)) {
        operation.busy = false;
        this.update();
      }
    }
  }
  private acceptReceipt(
    operation: Operation,
    receipt: Receipt,
    reconcile = true
  ) {
    const command = operation.review.command,
      session = this.session();
    if (
      receipt.commandId !== command.commandId ||
      receipt.operationId !== command.operationId ||
      receipt.sessionId !== command.sessionId ||
      receipt.sessionEpoch !== command.sessionEpoch ||
      receipt.requestId !== operation.review.requestId ||
      receipt.commandDigest !== operation.review.digest ||
      receipt.principal !== session?.principal ||
      receipt.tenant !== session.tenant ||
      receipt.destination !== this.destination()
    )
      throw new Error('Unrelated receipt');
    operation.receipt = receipt;
    operation.phase = receipt.status;
    this.settle(operation);
    if (reconcile) void this.reconcileSnapshot();
  }
  private async reconcileSnapshot() {
    const generation = this.generation;
    if (this.pending().length) return;
    const snapshotEpoch = ++this.snapshotEpoch;
    try {
      const observation = await request<Observation>(
        this.prefix() + 'snapshot'
      );
      if (
        this.live(generation) &&
        snapshotEpoch === this.snapshotEpoch &&
        !this.pending().length
      )
        this.installSnapshot(observation);
    } catch {
      if (this.live(generation))
        this.status.set(
          'Receipt retained; current shipment refresh failed. Reconnect before preparing new work.'
        );
    }
  }
  settle(operation: Operation) {
    const receipt = operation.receipt;
    if (!receipt || this.closed()) return;
    if (!operation.native) {
      if (
        operation.local === 'confirmed' ||
        operation.local === 'rolled back' ||
        operation.local.startsWith('obsolete local ownership resolved')
      )
        return;
      operation.local =
        'no owner in this page — authoritative receipt observed';
      this.update();
      return;
    }
    try {
      if (receipt.status === 'applied') operation.native.confirm();
      else operation.native.rollback();
      operation.local =
        receipt.status === 'applied' ? 'confirmed' : 'rolled back';
      operation.native = undefined;
    } catch {
      operation.local = 'recovery required';
      this.status.set(
        'Server outcome retained. Local rollback was refused; review the current shipment before recovery.'
      );
    }
    this.update();
  }
  async lookup(operation: Operation, reconcile = true) {
    const generation = this.generation;
    operation.receiptChecked = new Date().toISOString();
    try {
      const receipt = await request<Receipt>(
        this.prefix() +
          `receipts/${encodeURIComponent(operation.review.command.commandId)}`
      );
      if (this.live(generation))
        this.acceptReceipt(operation, receipt, reconcile);
    } catch (error) {
      if (!this.live(generation)) return;
      if (error instanceof RequestFailure && error.status === 404) {
        if (
          ['rejected', 'revoked'].includes(operation.review.status) &&
          operation.phase !== 'uncertain' &&
          !operation.busy
        ) {
          try {
            operation.native?.rollback();
            operation.native = undefined;
            operation.local = 'rolled back — review not approved';
            operation.phase = 'review ' + operation.review.status;
          } catch {
            operation.local = 'recovery required';
          }
        } else
          this.status.set(
            'No terminal receipt observed. This does not certify that an in-flight command had no effect.'
          );
      } else this.status.set(this.error(error));
      this.update();
    }
  }
  canKeepReplacement(operation: Operation) {
    const row = this.row(),
      observed = this.observed;
    const unchangedReplacement =
      !!row &&
      !!observed &&
      row.instance() === observed.instance &&
      row.route() === observed.values.route &&
      row.window() === observed.values.window &&
      row.capacity() === observed.values.capacity &&
      row.note() === observed.values.note;
    return (
      !this.closed() &&
      unchangedReplacement &&
      operation.local === 'recovery required' &&
      operation.receipt?.status === 'rejected' &&
      operation.receipt.reason === 'instance' &&
      !!operation.native &&
      this.pending().length === 1 &&
      this.pending()[0] === operation.nativeId &&
      observed?.instance !== operation.review.command.proposal.expectedInstance
    );
  }
  keepReplacement(operation: Operation) {
    const native = operation.native;
    if (!native || !this.canKeepReplacement(operation)) return;
    native.confirm();
    operation.native = undefined;
    operation.local =
      'obsolete local ownership resolved; server rejection preserved';
    this.update();
  }
  async stop() {
    const generation = this.generation;
    try {
      const session = await request<Session>('/api/session/stop', {});
      if (this.live(generation)) {
        this.session.set(session);
        await this.refresh();
        this.status.set(
          'New work stopped. In-flight and previously applied effects still require their authoritative outcomes.'
        );
      }
    } catch (error) {
      if (this.live(generation)) this.status.set(this.error(error));
    }
  }
  async loadEvidence() {
    if (this.evidenceLoading || this.closed()) return;
    this.evidenceLoading = true;
    const generation = this.generation;
    try {
      const page = await request<AuditPage>(
        this.prefix() + `events?after=${this.cursor()}&limit=32`
      );
      if (!this.live(generation)) return;
      const expected = this.cursor() + 1;
      const discontinuity = page.events.some(
        (event, index) => event.sequence !== expected + index
      );
      const previousGap = this.coverage().includes('Incomplete');
      const combined = [...this.evidence(), ...page.events];
      const trimmed = combined.length > 64;
      this.evidence.set(combined.slice(-64));
      this.cursor.set(page.nextCursor);
      this.evidenceRange.set(
        `Authority retains sequences ${page.retention.firstAvailableSequence}–${
          page.retention.latestSequence
        }; this view retains ${combined.slice(-64)[0]?.sequence ?? 'none'}–${
          combined.at(-1)?.sequence ?? 'none'
        } (limit 64).`
      );
      this.exported.set('');
      this.evidenceRange.update(
        (value) =>
          value +
          (page.retention.firstAvailableSequence > 1
            ? ` Earlier sequences before ${page.retention.firstAvailableSequence} are unavailable from this feed.`
            : '') +
          (page.hasMore
            ? ' More authority-retained events are available; Load recent evidence continues after the last observed sequence.'
            : ' The latest response reached the end of the authority-retained window.')
      );
      this.coverage.set(
        previousGap || page.retention.truncated || discontinuity || trimmed
          ? 'Incomplete evidence — a gap or retention limit prevents a complete history'
          : page.hasMore
          ? 'More evidence remains; this is a partial page'
          : 'Observed interval is contiguous; only this scope feed and retained window are represented'
      );
    } catch (error) {
      if (this.live(generation)) {
        this.coverage.set('Incomplete evidence — feed unavailable');
        this.status.set(this.error(error));
      }
    } finally {
      this.evidenceLoading = false;
    }
  }
  resetEvidence() {
    if (this.evidenceLoading || this.closed()) return;
    this.evidence.set([]);
    this.cursor.set(0);
    this.exported.set('');
    this.evidenceRange.set('Retained range unknown until the next response.');
    this.coverage.set('Reconnect requested — completeness unknown');
    void this.loadEvidence();
  }
  filteredEvidence() {
    const filter = this.evidenceFilter().trim();
    return filter
      ? this.evidence().filter((event) => event.commandId?.includes(filter))
      : this.evidence();
  }
  exportEvidence() {
    this.exported.set(
      JSON.stringify(
        {
          coverage: this.coverage(),
          exportedAt: new Date().toISOString(),
          retainedRange: this.evidenceRange(),
          cursor: this.cursor(),
          scope: {
            tenant: this.session()?.tenant,
            destination: this.destination(),
          },
          events: this.evidence(),
        },
        null,
        2
      )
    );
  }
  closeWorkspace() {
    if (this.closed()) return;
    this.closed.set(true);
    this.generation++;
    this.off();
    this.progress.dispose();
    this.tree.destroy();
    this.status.set(
      'Workspace closed. This does not cancel or settle external effects.'
    );
  }
  ngOnDestroy() {
    this.closeWorkspace();
  }
}
