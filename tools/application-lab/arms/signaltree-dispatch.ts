import { DestroyRef, computed, inject, signal } from '@angular/core';
import {
  entityMap,
  external,
  leaf,
  signalTree,
  transactions,
  type PendingTransaction,
} from '@signal-tree/angular';

import {
  initialCapacity,
  unresolved,
  validateAssignment,
  type AssignmentField,
  type Capacity,
  type Command,
  type Decision,
  type Dispatch,
  type DispatchJob,
  type DispatchTransport,
  type Operation,
  type Preview,
  type Publication,
  type PublicationPayload,
} from '../dispatch-model';
import { open } from '../st-open';

type Proposal = Readonly<Command & { order: number }>;

/**
 * Pending transactions own separate immutable proposal entities. They never own
 * the accepted job fields or the operation's later transport/outcome metadata.
 * Admission requires the exact-artifact proposal-membership falsifier.
 */
export function createDispatch(
  rows: readonly DispatchJob[],
  transport: DispatchTransport
): Dispatch {
  const accepted = signalTree({
    jobs: entityMap<DispatchJob, string>({ selectId: (row) => row.id }),
    capacity: leaf<Capacity>(initialCapacity()),
  });
  accepted.$.jobs.setAll(rows.map((row) => ({ ...row })));
  const proposals = signalTree(
    {
      commands: entityMap<Proposal, string>({
        selectId: (command) => command.id,
      }),
    },
    { enhancers: [transactions()] }
  );

  const active = signal(true);
  const previewOpen = signal(false);
  const operationVersion = signal(0);
  const publicationVersion = signal(0);
  const operationRecords = new Map<string, Operation>();
  const pendingHandles = new Map<string, PendingTransaction>();
  const outbox = new Map<string, Publication>();
  const reservedCommands = new Set<string>();
  const reservedIntents = new Set<string>();
  let nextOrder = 0;
  let inFlight: string | undefined;
  let startingPublication = false;
  let destroyed = false;

  const bySubject = computed(() => {
    const grouped = new Map<string, Proposal[]>();
    if (!active()) return grouped;
    for (const proposal of proposals.$.commands.all()) {
      const list = grouped.get(proposal.subject);
      if (list) list.push(proposal);
      else grouped.set(proposal.subject, [proposal]);
    }
    return grouped;
  });
  const operationView = computed<readonly Operation[]>(() => {
    operationVersion();
    return active() ? Array.from(operationRecords.values()) : [];
  });
  const publicationView = computed<readonly Publication[]>(() => {
    publicationVersion();
    return active() ? Array.from(outbox.values()) : [];
  });

  function recordOperation(operation: Operation): void {
    operationRecords.set(operation.id, operation);
    operationVersion.update((version) => version + 1);
  }
  function recordPublication(publication: Publication): void {
    outbox.set(publication.id, publication);
    publicationVersion.update((version) => version + 1);
  }

  function currentProposal(
    subject: string,
    instance: string,
    field: Command['field'],
    revision: number
  ): Proposal | undefined {
    operationVersion();
    let selected: Proposal | undefined;
    for (const proposal of bySubject().get(subject) ?? []) {
      const operation = operationRecords.get(proposal.id);
      if (
        proposal.instance !== instance ||
        proposal.field !== field ||
        proposal.expectedRevision < revision ||
        !operation ||
        !unresolved(operation)
      )
        continue;
      if (!selected || proposal.order > selected.order) selected = proposal;
    }
    return selected;
  }

  function projectJob(job: DispatchJob): DispatchJob {
    const owner = currentProposal(
      job.id,
      job.instance,
      'owner',
      job.ownerRevision
    );
    const status = currentProposal(
      job.id,
      job.instance,
      'status',
      job.statusRevision
    );
    if (!owner && !status) return job;
    return {
      ...job,
      ...(owner ? { owner: owner.value as string } : {}),
      ...(status ? { status: status.value as DispatchJob['status'] } : {}),
    };
  }
  function projectCapacity(): Capacity {
    if (!active()) return initialCapacity();
    const capacity = accepted.$.capacity();
    const draft = currentProposal(
      'capacity',
      capacity.instance,
      'capacity',
      capacity.revision
    );
    return draft ? { ...capacity, value: draft.value as number } : capacity;
  }
  const preview = computed<Preview | null>(() => {
    if (!active() || !previewOpen()) return null;
    return {
      rows: accepted.$.jobs.all().map(projectJob),
      capacity: projectCapacity(),
      pending: operationView().filter(unresolved).length,
    };
  });

  function envelope(operation: Command): Command {
    return {
      id: operation.id,
      subject: operation.subject,
      instance: operation.instance,
      field: operation.field,
      value: operation.value,
      expectedRevision: operation.expectedRevision,
    };
  }

  function releaseProposal(
    id: string,
    disposition: 'confirm' | 'rollback'
  ): void {
    const handle = pendingHandles.get(id);
    // Replacement can have already retired the native proposal while its remote
    // command still awaits a decision. The app outcome remains independent.
    if (!handle) return;
    if (disposition === 'confirm') {
      handle.confirm();
      pendingHandles.delete(id);
      if (!proposals.$.commands.byId(id))
        throw new Error('Confirmed proposal disappeared before removal');
      proposals.$.commands.removeOne(id);
    } else {
      // A refusal must leave the handle available, never be relabeled success.
      handle.rollback();
      pendingHandles.delete(id);
      if (proposals.$.commands.byId(id))
        throw new Error('Rolled-back proposal remains present');
    }
  }

  function acceptServerField(command: Operation, decision: Decision): void {
    if (decision.instance !== command.instance) return;
    if (command.field === 'capacity') {
      const current = accepted.$.capacity();
      if (
        current.instance !== command.instance ||
        decision.revision < current.revision
      )
        return;
      if (
        typeof decision.value !== 'number' ||
        !Number.isFinite(decision.value)
      )
        throw new Error('Invalid capacity decision');
      const next = {
        instance: current.instance,
        value: decision.value,
        revision: decision.revision,
      };
      external(() => accepted.$.capacity.set(next));
      return;
    }
    const row = accepted.$.jobs.byId(command.subject)?.();
    if (!row || row.instance !== command.instance) return;
    const revision =
      command.field === 'owner' ? row.ownerRevision : row.statusRevision;
    if (decision.revision < revision) return;
    if (typeof decision.value !== 'string')
      throw new Error('Invalid assignment decision');
    const value = validateAssignment(command.field, decision.value);
    const patch =
      command.field === 'owner'
        ? { owner: value, ownerRevision: decision.revision }
        : {
            status: value as DispatchJob['status'],
            statusRevision: decision.revision,
          };
    external(() => accepted.$.jobs.updateOne(command.subject, patch));
  }

  function unknown(id: string): void {
    if (!active()) return;
    const operation = operationRecords.get(id);
    if (operation && unresolved(operation) && operation.outcome !== 'unknown') {
      recordOperation({ ...operation, outcome: 'unknown' });
    }
  }

  function receive(id: string, decision: Decision): void {
    if (!active()) return;
    const operation = operationRecords.get(id);
    if (!operation || !unresolved(operation)) return;
    if (decision.commandId !== id || decision.field !== operation.field) {
      unknown(id);
      return;
    }
    // The server outcome is known even if native retirement refuses. Native
    // failure still propagates, keeps its handle, and blocks outbox admission.
    recordOperation({ ...operation, outcome: decision.outcome });
    releaseProposal(
      id,
      decision.outcome === 'applied' ? 'confirm' : 'rollback'
    );
    acceptServerField(operation, decision);
    startNextPublication();
  }

  function request(operation: Operation): void {
    let response: Promise<Decision>;
    try {
      response = transport.send(envelope(operation));
    } catch {
      unknown(operation.id);
      return;
    }
    void response.then(
      (decision) => receive(operation.id, decision),
      () => unknown(operation.id)
    );
  }

  function begin(command: Command): void {
    if (!command.id.trim()) throw new Error('Command ID is required');
    if (reservedCommands.has(command.id))
      throw new Error('Command ID already used; retry the original command');
    reservedCommands.add(command.id);
    const order = nextOrder++;
    const proposal: Proposal = { ...command, order };
    const handle = open(proposals, () => proposals.$.commands.addOne(proposal));
    pendingHandles.set(command.id, handle);
    const operation: Operation = { ...command, order, outcome: 'pending' };
    recordOperation(operation);
    request(operation);
  }

  function assign(
    id: string,
    field: AssignmentField,
    value: string,
    commandId: string
  ): void {
    if (!active()) return;
    const row = accepted.$.jobs.byId(id)?.();
    if (!row) return;
    begin({
      id: commandId,
      subject: id,
      instance: row.instance,
      field,
      value: validateAssignment(field, value),
      expectedRevision:
        field === 'owner' ? row.ownerRevision : row.statusRevision,
    });
  }

  function contributes(
    operation: Operation,
    kind: PublicationPayload['kind'],
    subject?: string
  ): boolean {
    if (!unresolved(operation)) return false;
    if (operation.field === 'capacity') {
      return (
        kind === 'plan' && operation.instance === accepted.$.capacity().instance
      );
    }
    const row = accepted.$.jobs.byId(operation.subject)?.();
    if (!row || row.instance !== operation.instance) return false;
    return (
      kind === 'plan' ||
      (subject === operation.subject && operation.field === 'status')
    );
  }

  function snapshot(publication: Publication): PublicationPayload {
    if (publication.kind === 'progress') {
      const row =
        publication.subject === undefined
          ? undefined
          : accepted.$.jobs.byId(publication.subject)?.();
      if (!row) throw new Error('Missing progress subject');
      return Object.freeze({
        kind: 'progress',
        subject: row.id,
        instance: row.instance,
        status: row.status,
        statusRevision: row.statusRevision,
      });
    }
    return Object.freeze({
      kind: 'plan',
      rows: Object.freeze(
        accepted.$.jobs.all().map((row) => Object.freeze({ ...row }))
      ),
      capacity: Object.freeze({ ...accepted.$.capacity() }),
    });
  }

  function isReady(publication: Publication): boolean {
    for (const id of publication.inputs) {
      const operation = operationRecords.get(id);
      if (!operation)
        throw new Error('Publication input was dismissed before settlement');
      if (unresolved(operation) || pendingHandles.has(id)) return false;
    }
    return true;
  }

  function startNextPublication(): void {
    if (!active() || inFlight !== undefined || startingPublication) return;
    // A waiting dependent plan does not block an independently ready progress
    // intent. Once started, destination calls are serialized until real ack.
    const next = Array.from(outbox.values()).find(
      (entry) => entry.state === 'waiting' && isReady(entry)
    );
    if (!next) return;
    const payload = snapshot(next);
    startingPublication = true;
    inFlight = next.id;
    recordPublication({ ...next, state: 'started', payload });
    try {
      const acknowledgement = transport.publish(next.id, payload);
      void acknowledgement.then(() => {
        if (!active()) return;
        const current = outbox.get(next.id);
        if (!current || current.state !== 'started' || inFlight !== next.id)
          return;
        recordPublication({ ...current, state: 'acknowledged' });
        inFlight = undefined;
        startNextPublication();
      });
    } finally {
      startingPublication = false;
    }
  }

  function publish(
    id: string,
    kind: PublicationPayload['kind'],
    subject?: string
  ): void {
    if (!active()) return;
    if (reservedIntents.has(id))
      throw new Error('Publication intent ID already used');
    if (
      kind === 'progress' &&
      (subject === undefined || !accepted.$.jobs.byId(subject))
    ) {
      throw new Error('Missing progress subject');
    }
    reservedIntents.add(id);
    const inputs = Array.from(operationRecords.values())
      .filter((operation) => contributes(operation, kind, subject))
      .map((operation) => operation.id);
    recordPublication({
      id,
      kind,
      state: 'waiting',
      inputs,
      ...(kind === 'progress' ? { subject } : {}),
    });
    startNextPublication();
  }

  function rollbackHandles(ids: readonly string[]): void {
    const ordered = [...ids].sort(
      (left, right) =>
        (operationRecords.get(right)?.order ?? -1) -
        (operationRecords.get(left)?.order ?? -1)
    );
    for (const id of ordered) releaseProposal(id, 'rollback');
  }

  function destroy(): void {
    if (destroyed) return;
    active.set(false);
    // Do not clear this registry in a finally block: a refused rollback leaves
    // an actual live native obligation, and another destroy may retry it.
    rollbackHandles(Array.from(pendingHandles.keys()));
    if (pendingHandles.size !== 0)
      throw new Error('Native pending handles remain at teardown');
    proposals.destroy();
    accepted.destroy();
    operationRecords.clear();
    outbox.clear();
    reservedCommands.clear();
    reservedIntents.clear();
    inFlight = undefined;
    destroyed = true;
  }
  inject(DestroyRef).onDestroy(destroy);

  return {
    kind: 'signaltree',
    row(id) {
      if (!active()) return undefined;
      const row = accepted.$.jobs.byId(id)?.();
      return row && projectJob(row);
    },
    canonical: (id) => (active() ? accepted.$.jobs.byId(id)?.() : undefined),
    capacity: projectCapacity,
    operations: operationView,
    publications: publicationView,
    preview,
    openPreview() {
      if (active()) previewOpen.set(true);
    },
    assign,
    draftCapacity(value, commandId) {
      if (!active()) return;
      if (!Number.isFinite(value) || value < 0)
        throw new Error('Invalid capacity');
      const current = accepted.$.capacity();
      begin({
        id: commandId,
        subject: 'capacity',
        instance: current.instance,
        field: 'capacity',
        value,
        expectedRevision: current.revision,
      });
    },
    timeout: unknown,
    retry(id) {
      if (!active()) return;
      const operation = operationRecords.get(id);
      if (operation && unresolved(operation)) request(operation);
    },
    publish,
    replace(id, replacement) {
      if (!active()) return;
      if (replacement.id !== id) throw new Error('Replacement ID mismatch');
      const previous = accepted.$.jobs.byId(id)?.();
      if (previous) {
        const retiring = Array.from(pendingHandles.keys()).filter(
          (commandId) => {
            const operation = operationRecords.get(commandId);
            return (
              operation?.subject === id &&
              operation.instance === previous.instance &&
              operation.field !== 'capacity'
            );
          }
        );
        rollbackHandles(retiring);
      }
      external(() => {
        if (accepted.$.jobs.byId(id)) accepted.$.jobs.removeOne(id);
        accepted.$.jobs.addOne({ ...replacement });
      });
    },
    openEditor(id) {
      const held = active() ? accepted.$.jobs.byId(id) : undefined;
      const instance = held?.()?.instance;
      return {
        assign(field, value, commandId) {
          if (
            !active() ||
            !held ||
            instance === undefined ||
            held()?.instance !== instance
          )
            return;
          assign(id, field, value, commandId);
        },
      };
    },
    dismissSettled() {
      if (!active()) return;
      const required = new Set<string>();
      for (const publication of outbox.values()) {
        if (publication.state === 'waiting')
          for (const id of publication.inputs) required.add(id);
      }
      let changedOperations = false;
      for (const [id, operation] of operationRecords) {
        if (
          !unresolved(operation) &&
          !required.has(id) &&
          !pendingHandles.has(id)
        ) {
          operationRecords.delete(id);
          changedOperations = true;
        }
      }
      if (changedOperations) operationVersion.update((version) => version + 1);
      let changedPublications = false;
      for (const [id, publication] of outbox) {
        if (publication.state === 'acknowledged') {
          outbox.delete(id);
          changedPublications = true;
        }
      }
      if (changedPublications)
        publicationVersion.update((version) => version + 1);
    },
    destroy,
  };
}
