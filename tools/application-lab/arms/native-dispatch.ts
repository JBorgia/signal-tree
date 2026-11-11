import {
  computed,
  DestroyRef,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import {
  initialCapacity,
  unresolved,
  validateAssignment,
  type AssignmentField,
  type Command,
  type Decision,
  type Dispatch,
  type DispatchEditor,
  type DispatchJob,
  type DispatchTransport,
  type Operation,
  type Preview,
  type Publication,
  type PublicationPayload,
} from '../dispatch-model';

interface RecordState {
  value: WritableSignal<DispatchJob>;
  proposals: WritableSignal<readonly Operation[]>;
  view: Signal<DispatchJob>;
}

export function createDispatch(
  rows: readonly DispatchJob[],
  transport: DispatchTransport
): Dispatch {
  const records = new Map<string, RecordState>();
  const requiredRecord = (id: string): RecordState => {
    const record = records.get(id);
    if (!record) throw new Error(`Missing live job ${id}`);
    return record;
  };
  const ids = signal<readonly string[]>([]);
  const capacityValue = signal(initialCapacity());
  const capacityProposals = signal<readonly Operation[]>([]);
  const operationsById = new Map<string, Operation>();
  const operationVersion = signal(0);
  const publicationState = signal<readonly Publication[]>([]);
  const progressInstances = new Map<string, string>();
  // ID reservations survive dismissed history; only strings remain. Their
  // action-count growth is measured, not described as indefinitely bounded.
  const seenCommands = new Set<string>();
  const seenIntents = new Set<string>();
  const previewOpen = signal(false);
  let channel: DispatchTransport | undefined = transport;
  let live = true;
  let nextOrder = 0;
  let publishing = false;

  function install(row: DispatchJob): void {
    const value = signal({ ...row });
    const proposals = signal<readonly Operation[]>([]);
    const view = computed(() => {
      const accepted = value();
      let projected = accepted;
      for (const operation of proposals()) {
        if (!unresolved(operation)) continue;
        const revision =
          operation.field === 'owner'
            ? accepted.ownerRevision
            : accepted.statusRevision;
        if (operation.expectedRevision < revision) continue;
        if (
          operation.field === 'owner' &&
          typeof operation.value === 'string'
        ) {
          projected = { ...projected, owner: operation.value };
        } else if (operation.field === 'status') {
          const status = operation.value;
          if (status === 'queued' || status === 'active' || status === 'done') {
            projected = { ...projected, status };
          }
        }
      }
      return projected;
    });
    records.set(row.id, { value, proposals, view });
  }
  for (const row of rows) install(row);
  ids.set(Array.from(records.keys()));

  const operations = computed(() => {
    operationVersion();
    return Array.from(operationsById.values());
  });
  const capacity = computed(() => {
    const accepted = capacityValue();
    let projected = accepted;
    for (const operation of capacityProposals()) {
      if (
        unresolved(operation) &&
        operation.expectedRevision >= accepted.revision &&
        typeof operation.value === 'number'
      ) {
        projected = { ...accepted, value: operation.value };
      }
    }
    return projected;
  });
  const preview = computed<Preview | null>(() => {
    if (!previewOpen()) return null;
    return {
      rows: ids().map((id) => requiredRecord(id).view()),
      capacity: capacity(),
      pending: operations().filter(unresolved).length,
    };
  });

  function current(operation: Operation): boolean {
    return operation.field === 'capacity'
      ? capacityValue().instance === operation.instance
      : records.get(operation.subject)?.value().instance === operation.instance;
  }

  function replaceOperation(operation: Operation): void {
    operationsById.set(operation.id, operation);
    operationVersion.update((value) => value + 1);
    const proposals =
      operation.field === 'capacity'
        ? capacityProposals
        : records.get(operation.subject)?.proposals;
    if (!proposals) return;
    proposals.update((values) => {
      if (!unresolved(operation))
        return values.filter((value) => value.id !== operation.id);
      const existing = values.findIndex((value) => value.id === operation.id);
      if (existing < 0) return [...values, operation];
      return values.map((value, index) =>
        index === existing ? operation : value
      );
    });
  }

  function unknown(commandId: string): void {
    if (!live) return;
    const operation = operationsById.get(commandId);
    if (!operation || !current(operation) || operation.outcome !== 'pending')
      return;
    replaceOperation({ ...operation, outcome: 'unknown' });
  }

  function receive(decision: Decision): void {
    if (!live) return;
    const operation = operationsById.get(decision.commandId);
    if (!operation || !current(operation) || !unresolved(operation)) return;
    if (
      decision.instance !== operation.instance ||
      decision.field !== operation.field
    ) {
      throw new Error('Decision does not match its command');
    }
    if (!Number.isSafeInteger(decision.revision) || decision.revision < 0) {
      throw new Error('Invalid authoritative revision');
    }
    if (operation.field === 'capacity') {
      if (
        typeof decision.value !== 'number' ||
        !Number.isFinite(decision.value) ||
        decision.value < 0
      )
        throw new Error('Invalid authoritative capacity');
      const accepted = capacityValue();
      if (decision.revision >= accepted.revision) {
        capacityValue.set({
          ...accepted,
          value: decision.value,
          revision: decision.revision,
        });
      }
    } else {
      const record = requiredRecord(operation.subject);
      const accepted = record.value();
      if (typeof decision.value !== 'string')
        throw new Error('Invalid authoritative assignment');
      const value = validateAssignment(operation.field, decision.value);
      if (
        operation.field === 'owner' &&
        decision.revision >= accepted.ownerRevision
      ) {
        record.value.set({
          ...accepted,
          owner: value,
          ownerRevision: decision.revision,
        });
      } else if (
        operation.field === 'status' &&
        decision.revision >= accepted.statusRevision
      ) {
        if (value !== 'queued' && value !== 'active' && value !== 'done') {
          throw new Error('Invalid authoritative status');
        }
        record.value.set({
          ...accepted,
          status: value,
          statusRevision: decision.revision,
        });
      }
    }
    // Even a stale success resolves its command. It cannot lower canonical
    // revision or overwrite a newer accepted field value above.
    replaceOperation({ ...operation, outcome: decision.outcome });
    drain();
  }

  function send(operation: Operation): void {
    if (!live || !channel || !current(operation)) return;
    const command: Command = {
      id: operation.id,
      subject: operation.subject,
      instance: operation.instance,
      field: operation.field,
      value: operation.value,
      expectedRevision: operation.expectedRevision,
    };
    try {
      void channel.send(command).then(
        (decision) => {
          if (!live) return;
          if (decision.commandId !== operation.id)
            throw new Error('Wrong command response');
          receive(decision);
        },
        () => unknown(operation.id)
      );
    } catch (error) {
      unknown(operation.id);
      throw error;
    }
  }

  function register(command: Command): void {
    if (!command.id.trim()) throw new Error('Command ID is required');
    if (seenCommands.has(command.id))
      throw new Error('Command ID already used; use retry');
    seenCommands.add(command.id);
    const operation: Operation = {
      ...command,
      order: nextOrder++,
      outcome: 'pending',
    };
    replaceOperation(operation);
    send(operation);
  }

  function assign(
    id: string,
    field: AssignmentField,
    value: string,
    commandId: string
  ): void {
    if (!live) return;
    if (field !== 'owner' && field !== 'status')
      throw new Error('Invalid assignment field');
    const normalized = validateAssignment(field, value);
    const accepted = records.get(id)?.value();
    if (!accepted) return;
    register({
      id: commandId,
      subject: id,
      instance: accepted.instance,
      field,
      value: normalized,
      expectedRevision:
        field === 'owner' ? accepted.ownerRevision : accepted.statusRevision,
    });
  }

  function updatePublication(id: string, patch: Partial<Publication>): void {
    publicationState.update((values) =>
      values.map((value) => (value.id === id ? { ...value, ...patch } : value))
    );
  }

  function payloadFor(
    publication: Publication
  ): PublicationPayload | undefined {
    if (publication.kind === 'plan') {
      return {
        kind: 'plan',
        rows: ids().map((id) => ({ ...requiredRecord(id).value() })),
        capacity: { ...capacityValue() },
      };
    }
    const row = records.get(publication.subject ?? '')?.value();
    if (!row || row.instance !== progressInstances.get(publication.id))
      return undefined;
    return {
      kind: 'progress',
      subject: row.id,
      instance: row.instance,
      status: row.status,
      statusRevision: row.statusRevision,
    };
  }

  // One transport call at a time; a waiting plan does not occupy this slot.
  // Reentry can enqueue another intent while publish() is on the stack.
  function drain(): void {
    if (!live || publishing || !channel) return;
    const publication = publicationState().find(
      (value) =>
        value.state === 'waiting' &&
        value.inputs.every((id) => {
          const operation = operationsById.get(id);
          return !operation || !unresolved(operation);
        })
    );
    if (!publication) return;
    const payload = payloadFor(publication);
    if (!payload) {
      publicationState.update((values) =>
        values.filter((value) => value.id !== publication.id)
      );
      progressInstances.delete(publication.id);
      drain();
      return;
    }
    publishing = true;
    updatePublication(publication.id, { state: 'started', payload });
    const finished = (acknowledged: boolean) => {
      if (!live) return;
      if (acknowledged)
        updatePublication(publication.id, { state: 'acknowledged' });
      publishing = false;
      drain();
    };
    try {
      void channel.publish(publication.id, payload).then(
        () => finished(true),
        () => finished(false)
      );
    } catch {
      // A thrown/rejected transport is not an acknowledgement. It does not
      // prevent unrelated later intents from using the transport.
      publishing = false;
      queueMicrotask(drain);
    }
  }

  function destroy(): void {
    if (!live) return;
    live = false;
    channel = undefined;
    previewOpen.set(false);
    for (const record of records.values()) record.proposals.set([]);
    records.clear();
    ids.set([]);
    operationsById.clear();
    operationVersion.update((value) => value + 1);
    capacityProposals.set([]);
    capacityValue.set(initialCapacity());
    publicationState.set([]);
    progressInstances.clear();
    seenCommands.clear();
    seenIntents.clear();
    operations();
    capacity();
    preview();
  }
  inject(DestroyRef).onDestroy(destroy);

  return {
    kind: 'native',
    row(id) {
      ids();
      return records.get(id)?.view();
    },
    canonical(id) {
      ids();
      return records.get(id)?.value();
    },
    capacity,
    operations,
    publications: publicationState,
    preview,
    openPreview() {
      if (live) previewOpen.set(true);
    },
    assign,
    draftCapacity(value, commandId) {
      if (!live) return;
      if (!Number.isFinite(value) || value < 0)
        throw new Error('Invalid capacity');
      const accepted = capacityValue();
      register({
        id: commandId,
        subject: 'capacity',
        instance: accepted.instance,
        field: 'capacity',
        value,
        expectedRevision: accepted.revision,
      });
    },
    timeout: unknown,
    retry(commandId) {
      if (!live) return;
      const operation = operationsById.get(commandId);
      if (!operation) throw new Error('Unknown command');
      if (unresolved(operation)) send(operation);
    },
    publish(intentId, kind, subject) {
      if (!live) return;
      if (kind !== 'plan' && kind !== 'progress')
        throw new Error('Invalid publication kind');
      if (!intentId.trim()) throw new Error('Intent ID is required');
      if (seenIntents.has(intentId)) throw new Error('Intent ID already used');
      const row =
        kind === 'progress' ? records.get(subject ?? '')?.value() : undefined;
      if (kind === 'progress' && !row)
        throw new Error('Unknown publication subject');
      const inputs = Array.from(operationsById.values())
        .filter(
          (operation) =>
            unresolved(operation) &&
            current(operation) &&
            (kind === 'plan' ||
              (operation.subject === subject && operation.field === 'status'))
        )
        .map((operation) => operation.id);
      seenIntents.add(intentId);
      if (row) progressInstances.set(intentId, row.instance);
      publicationState.update((values) => [
        ...values,
        {
          id: intentId,
          kind,
          ...(subject === undefined ? {} : { subject }),
          state: 'waiting',
          inputs,
        },
      ]);
      drain();
    },
    replace(id, row) {
      if (!live) return;
      if (id !== row.id) throw new Error('Replacement ID must match');
      const retired = records.get(id);
      retired?.proposals.set([]);
      retired?.view();
      records.delete(id);
      install(row);
      ids.update((values) => [...values.filter((value) => value !== id), id]);
      for (const [commandId, operation] of operationsById) {
        if (operation.field !== 'capacity' && operation.subject === id) {
          operationsById.delete(commandId);
        }
      }
      operationVersion.update((value) => value + 1);
      drain();
    },
    openEditor(id): DispatchEditor {
      const record = records.get(id);
      return {
        assign(field, value, commandId) {
          if (live && record && records.get(id) === record)
            assign(id, field, value, commandId);
        },
      };
    },
    dismissSettled() {
      if (!live) return;
      const protectedIds = new Set(
        publicationState()
          .filter((value) => value.state === 'waiting')
          .flatMap((value) => [...value.inputs])
      );
      for (const [id, operation] of operationsById) {
        if (!unresolved(operation) && !protectedIds.has(id))
          operationsById.delete(id);
      }
      operationVersion.update((value) => value + 1);
      for (const publication of publicationState()) {
        if (publication.state === 'acknowledged')
          progressInstances.delete(publication.id);
      }
      publicationState.update((values) =>
        values.filter((value) => value.state !== 'acknowledged')
      );
    },
    destroy,
  };
}
