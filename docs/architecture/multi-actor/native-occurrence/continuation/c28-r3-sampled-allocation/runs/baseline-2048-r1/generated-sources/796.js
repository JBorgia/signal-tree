'use strict';async (__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__,__filename,__dirname,module,exports,require)=>{{Object.defineProperty(__vite_ssr_exports__, "entityPublicationOrdinary", { enumerable: true, configurable: true, get(){ try { return entityPublicationOrdinary } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "registerEntityPublicationFactory", { enumerable: true, configurable: true, get(){ try { return registerEntityPublicationFactory } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "EntityPublicationSource", { enumerable: true, configurable: true, get(){ try { return EntityPublicationSource } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "getEntityPublicationAnchor", { enumerable: true, configurable: true, get(){ try { return getEntityPublicationAnchor } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "defineEntityPublicationBinding", { enumerable: true, configurable: true, get(){ try { return defineEntityPublicationBinding } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "getEntityPublicationBinding", { enumerable: true, configurable: true, get(){ try { return getEntityPublicationBinding } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "withEntityPublicationInput", { enumerable: true, configurable: true, get(){ try { return withEntityPublicationInput } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "currentEntityPublicationInputs", { enumerable: true, configurable: true, get(){ try { return currentEntityPublicationInputs } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "withEntityPublicationUnit", { enumerable: true, configurable: true, get(){ try { return withEntityPublicationUnit } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "entityPublicationUnit", { enumerable: true, configurable: true, get(){ try { return entityPublicationUnit } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "withEntityBoundPublicationInput", { enumerable: true, configurable: true, get(){ try { return withEntityBoundPublicationInput } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "markEntityPublicationFacts", { enumerable: true, configurable: true, get(){ try { return markEntityPublicationFacts } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "entityPublicationFactsUnit", { enumerable: true, configurable: true, get(){ try { return entityPublicationFactsUnit } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "withEntityPointPublicationPreparation", { enumerable: true, configurable: true, get(){ try { return withEntityPointPublicationPreparation } catch {} }});
const __vite_ssr_import_0__ = await __vite_ssr_import__("/src/lib/internals/intrinsic-mutation.ts", {"importedNames":["combineTerminalRecords","installTerminalRecord"]});
function entityPublicationOrdinary(packet) {
  if (!packet.steps) return packet.ordinary;
  return packet.steps.flatMap((step) => {
    const removal = step.authoredRemoval;
    return removal && !step.ordinary.some((edit) => edit.subject === removal.subject && edit.structural?.kind === "remove") ? [...step.ordinary, removal] : step.ordinary;
  });
};
class AdmissionMetadata {
  edits = /* @__PURE__ */ new WeakSet();
  arrays = /* @__PURE__ */ new WeakSet();
  packets = /* @__PURE__ */ new WeakSet();
  edit(edit) {
    if (this.edits.has(edit)) return;
    if (!Object.isFrozen(edit)) {
      if (edit.fields && !Object.isFrozen(edit.fields)) Object.defineProperty(edit, "fields", { value: Object.freeze([...edit.fields]), enumerable: true });
      if (edit.structural) Object.defineProperty(edit, "structural", { value: Object.freeze({ ...edit.structural }), enumerable: true });
    } else {
      if (edit.fields && !Object.isFrozen(edit.fields) || edit.structural && !Object.isFrozen(edit.structural))
        throw new Error("Frozen entity publication edit contains mutable admission metadata");
    };
    Object.freeze(edit);
    this.edits.add(edit);
  }
  array(edits) {
    if (this.arrays.has(edits)) return edits;
    for (const edit of edits) this.edit(edit);
    const result = Object.freeze(edits);
    this.arrays.add(result);
    return result;
  }
  prepare(packet) {
    if (this.packets.has(packet)) return packet;
    const steps = packet.steps?.map((step) => {
      if (step.authoredRemoval) this.edit(step.authoredRemoval);
      const footprint = step.authoredFootprint;
      return Object.freeze({
        ...step,
        authoredFootprint: footprint ? Object.freeze(footprint.kind === "fields" ? { ...footprint, fields: Object.freeze([...footprint.fields]) } : { ...footprint }) : void 0,
        ordinary: this.array(step.ordinary),
        physical: step.physical ? this.array(step.physical) : void 0
      });
    });
    const result = Object.freeze({
      ...packet,
      ordinary: this.array(packet.ordinary),
      physical: this.array(packet.physical),
      steps: steps ? Object.freeze(steps) : void 0,
      ordinaryOrder: packet.ordinaryOrder ? Object.freeze([...packet.ordinaryOrder]) : void 0,
      physicalOrder: packet.physicalOrder ? Object.freeze([...packet.physicalOrder]) : void 0
    });
    this.packets.add(result);
    return result;
  }
}
let factory;
function registerEntityPublicationFactory(value) {
  if (factory) throw new Error("Entity publication authority already registered");
  factory = value;
};
class EntityPublicationSource {
  admission = new AdmissionMetadata();
  native;
  recipients = /* @__PURE__ */ new Set();
  recipientRevision = 0;
  revisionToken = {};
  // Distinct from ordinary staged installs: physical and ordinary plans may
  // intentionally install in sequence. Retirement invalidates every old reader.
  retirementRevision = {};
  retirements = /* @__PURE__ */ new Map();
  disposed = false;
  /** Called only for a successfully installed kernel forget-lifetime mutation. */
  requestRetirement(subject, eligible) {
    if (this.disposed) return;
    this.cancelRetirement(subject);
    const request = { eligible, queued: false };
    this.retirements.set(subject, request);
    this.scheduleRetirement(subject, request);
  }
  cancelRetirement(subject) {
    const request = this.retirements.get(subject);
    this.retirements.delete(subject);
    request?.release?.();
  }
  scheduleRetirement(subject, request) {
    if (request.queued || this.disposed || this.retirements.get(subject) !== request) return;
    request.queued = true;
    queueMicrotask(() => {
      request.queued = false;
      if (this.disposed || this.retirements.get(subject) !== request) return;
      request.release?.();
      request.release = void 0;
      if (!request.eligible()) {
        this.cancelRetirement(subject);
        return;
      };
      const revision = this.revisionToken;
      const plan = this.native?.prepareRetirement?.(subject);
      if (!plan) {
        this.cancelRetirement(subject);
        return;
      };
      if (!plan.ready) {
        request.release = plan.onReady(() => this.scheduleRetirement(subject, request));
        return;
      };
      if (!plan.canRetire) {
        if (plan.onSettlement) request.release = plan.onSettlement(() => this.scheduleRetirement(subject, request));
        else this.cancelRetirement(subject);
        return;
      };
      if (!request.eligible() || revision !== this.revisionToken || !plan.current()) {
        this.cancelRetirement(subject);
        return;
      };
      this.cancelRetirement(subject);
      this.retire(subject);
    });
  }
  dispose() {
    this.disposed = true;
    for (const subject of this.retirements.keys()) this.cancelRetirement(subject);
    this.revisionToken = {};
    this.retirementRevision = {};
  }
  revision() {
    return this.revisionToken;
  }
  nativeParticipant() {
    return this.native ??= factory?.(this);
  }
  subscribe(participant) {
    this.nativeParticipant();
    this.recipients.add(participant);
    this.recipientRevision++;
    this.revisionToken = {};
    return () => {
      if (this.recipients.delete(participant)) {
        this.recipientRevision++;
        this.revisionToken = {};
      }
    };
  }
  captureInput(subject, field) {
    return this.nativeParticipant()?.captureInput?.(subject, field);
  }
  preparePoint(packet) {
    if (!pointPreparation) return this.prepare(packet);
    packet = this.admission.prepare(packet);
    let group = pointPreparation.get(this);
    if (!group) {
      const source = this;
      const state = { packets: [], source, unit: void 0, installed: false, finalized: false, completed: false };
      const completion = {};
      pointCompletions.set(completion, () => {
        if (!state.completed) {
          state.completed = true;
          if (state.unit) source.complete(state.unit.completion);
        }
      });
      const gate = { set(_key, _value) {
        if (!state.installed) {
          state.installed = true;
          if (state.unit) (0,__vite_ssr_import_0__.installTerminalRecord)(state.unit.record);
        }
      } };
      group = { state, publication: { record: { writes: [{ map: gate, key: void 0, value: void 0 }], adds: [] }, completion, validate: () => state.unit?.validate?.(), finalize: () => {
        if (!state.finalized) {
          state.finalized = true;
          state.unit?.finalize?.();
        }
      } } };
      pointPreparation.set(this, group);
    };
    group.state.packets.push(packet);
    return group.publication;
  }
  prepare(packet) {
    const recipientRevision = this.recipientRevision, sourceRevision = this.revisionToken;
    const retirementRevision = this.retirementRevision;
    const parts = [];
    packet = this.admission.prepare(packet);
    const native = this.nativeParticipant();
    const nativeUnit = native?.prepare(packet);
    const fallbackRecord = native ? void 0 : packet.prepareResponsibility?.();
    if (native && nativeUnit) parts.push({ participant: native, unit: nativeUnit });
    for (const participant of [...this.recipients]) {
      const unit = participant.prepare(packet, nativeUnit?.completion);
      if (unit) parts.push({ participant, unit });
    };
    if (sourceRevision !== this.revisionToken && recipientRevision === this.recipientRevision) throw new Error("Entity publication source changed during preparation");
    if (recipientRevision !== this.recipientRevision) throw new Error("Entity publication recipients changed during preparation");
    if (!parts.length && !fallbackRecord) return void 0;
    const validate = () => {
      if (this.disposed || retirementRevision !== this.retirementRevision || recipientRevision !== this.recipientRevision || sourceRevision !== this.revisionToken)
        throw new Error("Entity publication source changed before installation");
    };
    return {
      validate,
      record: (0,__vite_ssr_import_0__.combineTerminalRecords)(fallbackRecord, ...parts.map((part) => part.unit.record), { writes: [{ map: { set: (_key, value) => {
        this.revisionToken = value;
      } }, key: void 0, value: {} }], adds: [] }),
      completion: { parts },
      finalize: () => {
        validate();
        const beforeFinalize = this.revisionToken;
        for (const part of parts) part.unit.finalize?.();
        validate();
        if (beforeFinalize !== this.revisionToken)
          throw new Error("Entity publication source changed during finalization");
      }
    };
  }
  requestsSeed() {
    return [...this.recipients].some((participant) => participant.seedRequested?.());
  }
  evidence() {
    return this.nativeParticipant()?.evidence?.();
  }
  captureViews(subject, field) {
    return this.nativeParticipant()?.captureViews?.(subject, field) ?? [];
  }
  inspect() {
    return { ...this.native?.inspect?.() ?? {}, recipients: this.recipients.size, native: this.native ? 1 : 0, retirementRequests: this.retirements.size };
  }
  retire(subject) {
    this.cancelRetirement(subject);
    this.native?.retire?.(subject);
    this.revisionToken = {};
    this.retirementRevision = {};
  }
  complete(completion) {
    const point = pointCompletions.get(completion);
    if (point) {
      point();
      return;
    };
    const { parts } = completion;
    let failed = false;
    let first;
    for (const part of parts) {
      try {
        part.participant.complete(part.unit.completion);
      } catch (error) {
        if (!failed) {
          failed = true;
          first = error;
        }
      }
    };
    if (failed) throw first;
  }
};
const ENTITY_PUBLICATION = Symbol("signaltree.entityPublication");
const anchors = /* @__PURE__ */ new WeakMap();
function getEntityPublicationAnchor(source) {
  return anchors.get(source);
};
function defineEntityPublicationBinding(node, binding) {
  Object.defineProperty(node, ENTITY_PUBLICATION, { value: binding });
  if (binding.subject === void 0 && binding.field === void 0) anchors.set(binding.source, node);
};
function getEntityPublicationBinding(node) {
  return node !== null && (typeof node === "object" || typeof node === "function") ? node[ENTITY_PUBLICATION] : void 0;
};
const inputScopes = [];
function withEntityPublicationInput(source, subject, field, body) {
  const input = source.captureInput(subject, field);
  if (input) inputScopes.push(input);
  try {
    return body();
  } finally {
    if (input) inputScopes.pop();
  }
};
function currentEntityPublicationInputs() {
  return inputScopes;
};
const INSTALLED_UNIT = Symbol("entity-installed-publication");
function withEntityPublicationUnit(meta, id) {
  const result = { ...meta, [INSTALLED_UNIT]: id };
  return result;
};
function entityPublicationUnit(meta) {
  return meta?.[INSTALLED_UNIT];
};
function withEntityBoundPublicationInput(node, body) {
  const binding = getEntityPublicationBinding(node);
  return binding ? withEntityPublicationInput(binding.source, binding.subject, binding.field, body) : body();
};
const preparedChanges = /* @__PURE__ */ new WeakMap();
function markEntityPublicationFacts(facts, unit) {
  preparedChanges.set(facts, unit);
};
function entityPublicationFactsUnit(facts) {
  return preparedChanges.get(facts);
};
let pointPreparation;
const pointCompletions = /* @__PURE__ */ new WeakMap();
function withEntityPointPublicationPreparation(body) {
  const previous = pointPreparation, groups = /* @__PURE__ */ new Map();
  pointPreparation = groups;
  let result;
  try {
    result = body();
  } finally {
    pointPreparation = previous;
  };
  for (const { state } of groups.values()) {
    const first = state.packets[0];
    state.unit = state.source.prepare({ ...first, physical: state.packets.flatMap((packet) => packet.physical), ordinary: state.packets.flatMap((packet) => packet.ordinary), steps: state.packets.flatMap((packet) => packet.steps ?? packet.ordinary.map((edit, ordinal) => ({ ordinal, ordinary: [edit] }))) });
    state.packets = [];
  };
  return result;
}
//# sourceMappingSource=vite-generated
//# sourceMappingURL=data:application/json;base64,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Q0FBQztBQUMzQixVQUFNLE9BQUssTUFBTSxPQUFPLFFBQVEsRUFBQyxHQUFHLE9BQU0sVUFBUyxNQUFNLFFBQVEsUUFBUSxZQUFRLE9BQU8sUUFBUSxHQUFFLFVBQVMsTUFBTSxRQUFRLFFBQVEsWUFBUSxPQUFPLFFBQVEsR0FBRSxPQUFNLE1BQU0sUUFBUSxRQUFRLFlBQVEsT0FBTyxTQUFPLE9BQU8sU0FBUyxJQUFJLENBQUMsTUFBSyxhQUFXLEVBQUMsU0FBUSxVQUFTLENBQUMsSUFBSSxFQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUM7QUFDOVEsVUFBTSxVQUFRLENBQUM7QUFBQSxFQUNqQjtBQUNBLFNBQU87QUFDVCIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiZW50aXR5LXB1YmxpY2F0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgRW50aXR5UHJvamVjdGlvblNlZWRFbnRyeSB9IGZyb20gJy4vZW50aXR5LXByb2plY3Rpb24tc2VlZCc7XG5pbXBvcnQgdHlwZSB7IFdyaXRlTWV0YWRhdGEgfSBmcm9tICcuLi9tdXRhdGlvbi10eXBlcyc7XG5pbXBvcnQgeyBjb21iaW5lVGVybWluYWxSZWNvcmRzLCBpbnN0YWxsVGVybWluYWxSZWNvcmQsIHR5cGUgUHJlcGFyZWRQdWJsaWNhdGlvblVuaXQgfSBmcm9tICcuL2ludHJpbnNpYy1tdXRhdGlvbic7XG5pbXBvcnQgdHlwZSB7IFN0cnVjdHVyYWxFZmZlY3QgfSBmcm9tICcuL3NvdXJjZS1tdXRhdGlvbic7XG5cbi8qKiBTb3VyY2UgZmFjdHMgcHJlcGFyZWQgd2l0aCBpbnN0YWxsYXRpb24sIG5ldmVyIHJlY29uc3RydWN0ZWQgZnJvbSBkZWxpdmVyeS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRW50aXR5UHVibGljYXRpb25FZGl0IHtcbiAgcmVhZG9ubHkgcmVzdG9yZWRGaWVsZHM/OiBSZWFkb25seU1hcDxzdHJpbmcsaW1wb3J0KCcuL25hdGl2ZS1maWVsZC1zZWxlY3Rpb24nKS5OYXRpdmVGaWVsZEVuZHBvaW50PjtcbiAgcmVhZG9ubHkgc3ViamVjdDogbnVtYmVyO1xuICByZWFkb25seSBiZWZvcmU6IHVua25vd247XG4gIHJlYWRvbmx5IGFmdGVyOiB1bmtub3duO1xuICByZWFkb25seSBmaWVsZHM6IHJlYWRvbmx5IHN0cmluZ1tdIHwgbnVsbDtcbiAgcmVhZG9ubHkgc3RydWN0dXJhbD86IFN0cnVjdHVyYWxFZmZlY3Q7XG59XG4vKiogU291cmNlIGRlY2xhcmF0aW9uIG9ubHk6IG5ldmVyIGEgY2VydGlmaWNhdGUgb2YgbmF0aXZlIGVmZmVjdCBvd25lcnNoaXAuICovXG5leHBvcnQgdHlwZSBFbnRpdHlBdXRob3JlZEZvb3RwcmludCA9XG4gIHwge3JlYWRvbmx5IGtpbmQ6J3dob2xlJyB8ICdkZXJpdmUnIHwgJ3JlYWxpemF0aW9uJ31cbiAgfCB7cmVhZG9ubHkga2luZDonZmllbGRzJztyZWFkb25seSBmaWVsZHM6cmVhZG9ubHkgc3RyaW5nW119O1xuZXhwb3J0IGludGVyZmFjZSBFbnRpdHlQdWJsaWNhdGlvblN0ZXAge1xuICByZWFkb25seSBhdXRob3JlZEZvb3RwcmludD86IEVudGl0eUF1dGhvcmVkRm9vdHByaW50O1xuICByZWFkb25seSBvcmRpbmFsOiBudW1iZXI7XG4gIHJlYWRvbmx5IGF1dGhvcmVkUmVtb3ZhbD86IEVudGl0eVB1YmxpY2F0aW9uRWRpdDtcbiAgcmVhZG9ubHkgb3JkaW5hcnk6IHJlYWRvbmx5IEVudGl0eVB1YmxpY2F0aW9uRWRpdFtdO1xuICByZWFkb25seSBwaHlzaWNhbD86IHJlYWRvbmx5IEVudGl0eVB1YmxpY2F0aW9uRWRpdFtdO1xufVxuLyoqIFByZXNlcnZlIGF1dGhvcmVkIHRvbWJzdG9uZXMgZXZlbiB3aGVuIHNvdXJjZSBvcmRpbmFyeSBtZW1iZXJzaGlwIHdhcyBhYnNlbnQuICovXG5leHBvcnQgZnVuY3Rpb24gZW50aXR5UHVibGljYXRpb25PcmRpbmFyeShwYWNrZXQ6IEVudGl0eVB1YmxpY2F0aW9uUGFja2V0KTogcmVhZG9ubHkgRW50aXR5UHVibGljYXRpb25FZGl0W10ge1xuICBpZiAoIXBhY2tldC5zdGVwcykgcmV0dXJuIHBhY2tldC5vcmRpbmFyeTtcbiAgcmV0dXJuIHBhY2tldC5zdGVwcy5mbGF0TWFwKHN0ZXAgPT4ge1xuICAgIGNvbnN0IHJlbW92YWwgPSBzdGVwLmF1dGhvcmVkUmVtb3ZhbDtcbiAgICByZXR1cm4gcmVtb3ZhbCAmJiAhc3RlcC5vcmRpbmFyeS5zb21lKGVkaXQgPT4gZWRpdC5zdWJqZWN0ID09PSByZW1vdmFsLnN1YmplY3QgJiYgZWRpdC5zdHJ1Y3R1cmFsPy5raW5kID09PSAncmVtb3ZlJylcbiAgICAgID8gWy4uLnN0ZXAub3JkaW5hcnksIHJlbW92YWxdIDogc3RlcC5vcmRpbmFyeTtcbiAgfSk7XG59XG5leHBvcnQgaW50ZXJmYWNlIEVudGl0eVB1YmxpY2F0aW9uUGFja2V0IHtcbiAgLyoqIEZpbmFsIHNvdXJjZS1vd25lZCBvcmRpbmFyeSBhZGphY2VuY3k7IGRvZXMgbm90IGVkaXQgdmFsdWVzIG9yIG1lbWJlcnNoaXAuICovXG4gIHJlYWRvbmx5IG9yZGluYXJ5UGxhY2VtZW50cz86IHJlYWRvbmx5IGltcG9ydCgnLi4vcGh5c2ljYWwvb3JkaW5hcnktcmVzdG9yYXRpb24tcGxhY2VtZW50JykuT3JkaW5hcnlSZXN0b3JhdGlvblBsYWNlbWVudFtdO1xuICByZWFkb25seSBwcmVwYXJlUmVzcG9uc2liaWxpdHk/OiAoZmllbGRzPzppbXBvcnQoJy4vbmF0aXZlLWZpZWxkLXNlbGVjdGlvbicpLk5hdGl2ZUZpZWxkU2VsZWN0aW9ucyk9PmltcG9ydCgnLi9pbnRyaW5zaWMtbXV0YXRpb24nKS5UZXJtaW5hbFJlY29yZFBsYW58dW5kZWZpbmVkO1xuICByZWFkb25seSBvd25lcjogbnVtYmVyO1xuICByZWFkb25seSBpZDogb2JqZWN0O1xuICByZWFkb25seSBpbnB1dHM/OiByZWFkb25seSBvYmplY3RbXTtcbiAgcmVhZG9ubHkgc2VlZD86cmVhZG9ubHkgRW50aXR5UHJvamVjdGlvblNlZWRFbnRyeTxzdHJpbmd8bnVtYmVyLHVua25vd24+W107XG4gIHJlYWRvbmx5IG1ldGE6IFdyaXRlTWV0YWRhdGEgfCB1bmRlZmluZWQ7XG4gIHJlYWRvbmx5IHBoeXNpY2FsOiByZWFkb25seSBFbnRpdHlQdWJsaWNhdGlvbkVkaXRbXTtcbiAgcmVhZG9ubHkgb3JkaW5hcnk6IHJlYWRvbmx5IEVudGl0eVB1YmxpY2F0aW9uRWRpdFtdO1xuICByZWFkb25seSBzdGVwcz86IHJlYWRvbmx5IEVudGl0eVB1YmxpY2F0aW9uU3RlcFtdO1xuICByZWFkb25seSBwaHlzaWNhbE9yZGVyPzogcmVhZG9ubHkgbnVtYmVyW107XG4gIHJlYWRvbmx5IG9yZGluYXJ5T3JkZXI/OiByZWFkb25seSBudW1iZXJbXTtcbn1cbi8qKiBQcml2YXRlIG93bmVyc2hpcCBib3VuZGFyeTogbWV0YWRhdGEgaXMgc291cmNlLW93bmVkLCByb3cgcGF5bG9hZHMgYW5kIHByb29mXG4gKiBvYmplY3RzIGFyZSBub3QuIFdlYWsgbWFya3MgYXZvaWQgcmVwcm9jZXNzaW5nIHF1ZXVlZCBwb2ludCBmcmFnbWVudHM7IHRoZXlcbiAqIGNvbnRhaW4gbm8gdmFsdWVzLCBjZXJ0aWZpY2F0ZXMgb3IgcmV2aXNpb24gYXV0aG9yaXR5IGFuZCBkbyBub3QgcmV0YWluIGtleXMuXG4gKi9cbmNsYXNzIEFkbWlzc2lvbk1ldGFkYXRhIHtcbiAgcHJpdmF0ZSByZWFkb25seSBlZGl0cyA9IG5ldyBXZWFrU2V0PEVudGl0eVB1YmxpY2F0aW9uRWRpdD4oKTtcbiAgcHJpdmF0ZSByZWFkb25seSBhcnJheXMgPSBuZXcgV2Vha1NldDxyZWFkb25seSBFbnRpdHlQdWJsaWNhdGlvbkVkaXRbXT4oKTtcbiAgcHJpdmF0ZSByZWFkb25seSBwYWNrZXRzID0gbmV3IFdlYWtTZXQ8RW50aXR5UHVibGljYXRpb25QYWNrZXQ+KCk7XG4gIHByaXZhdGUgZWRpdChlZGl0OiBFbnRpdHlQdWJsaWNhdGlvbkVkaXQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5lZGl0cy5oYXMoZWRpdCkpIHJldHVybjtcbiAgICAvLyBOYXRpdmUgcHJvZHVjZXJzIHN1cHBseSBtdXRhYmxlIHNoZWxscy4gQ29weSBzaGFyZWQgbWV0YWRhdGEgYmVmb3JlIGxvY2tpbmdcbiAgICAvLyB0aGF0IHNhbWUgZWRpdCBpZGVudGl0eS4gQSBmcm96ZW4gc2hlbGwgY2Fubm90IHRyYW5zZmVyIG93bmVyc2hpcCBvZlxuICAgIC8vIGJvcnJvd2VkIG11dGFibGUgbWV0YWRhdGE6IHJlcXVpcmUgc3RhYmlsaXR5IHdpdGhvdXQgbXV0YXRpbmcgdGhvc2UgYWxpYXNlcy5cbiAgICBpZiAoIU9iamVjdC5pc0Zyb3plbihlZGl0KSkge1xuICAgICAgaWYgKGVkaXQuZmllbGRzICYmICFPYmplY3QuaXNGcm96ZW4oZWRpdC5maWVsZHMpKSBPYmplY3QuZGVmaW5lUHJvcGVydHkoZWRpdCwnZmllbGRzJyx7dmFsdWU6T2JqZWN0LmZyZWV6ZShbLi4uZWRpdC5maWVsZHNdKSxlbnVtZXJhYmxlOnRydWV9KTtcbiAgICAgIGlmIChlZGl0LnN0cnVjdHVyYWwpIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlZGl0LCdzdHJ1Y3R1cmFsJyx7dmFsdWU6T2JqZWN0LmZyZWV6ZSh7Li4uZWRpdC5zdHJ1Y3R1cmFsfSksZW51bWVyYWJsZTp0cnVlfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChlZGl0LmZpZWxkcyAmJiAhT2JqZWN0LmlzRnJvemVuKGVkaXQuZmllbGRzKSB8fFxuICAgICAgICAgIGVkaXQuc3RydWN0dXJhbCAmJiAhT2JqZWN0LmlzRnJvemVuKGVkaXQuc3RydWN0dXJhbCkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRnJvemVuIGVudGl0eSBwdWJsaWNhdGlvbiBlZGl0IGNvbnRhaW5zIG11dGFibGUgYWRtaXNzaW9uIG1ldGFkYXRhJyk7XG4gICAgfVxuICAgIE9iamVjdC5mcmVlemUoZWRpdCk7XG4gICAgdGhpcy5lZGl0cy5hZGQoZWRpdCk7XG4gIH1cbiAgcHJpdmF0ZSBhcnJheShlZGl0czogcmVhZG9ubHkgRW50aXR5UHVibGljYXRpb25FZGl0W10pOiByZWFkb25seSBFbnRpdHlQdWJsaWNhdGlvbkVkaXRbXSB7XG4gICAgaWYgKHRoaXMuYXJyYXlzLmhhcyhlZGl0cykpIHJldHVybiBlZGl0cztcbiAgICBmb3IgKGNvbnN0IGVkaXQgb2YgZWRpdHMpIHRoaXMuZWRpdChlZGl0KTtcbiAgICAvLyBUaGVzZSBhcnJheXMgYXJlIHByaXZhdGUgc291cmNlLWlzc3VlZCBtZW1iZXJzaGlwLCBuZXZlciB1c2VyIHJvdyBwYXlsb2Fkcy5cbiAgICAvLyBUcmFuc2ZlciB0aGVpciBvd25lcnNoaXAgb25jZSBpbnN0ZWFkIG9mIGR1cGxpY2F0aW5nIGV2ZXJ5IGFkbWl0dGVkIGxpc3QuXG4gICAgY29uc3QgcmVzdWx0PU9iamVjdC5mcmVlemUoZWRpdHMpO1xuICAgIHRoaXMuYXJyYXlzLmFkZChyZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgcHJlcGFyZShwYWNrZXQ6RW50aXR5UHVibGljYXRpb25QYWNrZXQpOkVudGl0eVB1YmxpY2F0aW9uUGFja2V0IHtcbiAgICBpZih0aGlzLnBhY2tldHMuaGFzKHBhY2tldCkpcmV0dXJuIHBhY2tldDtcbiAgICBjb25zdCBzdGVwcz1wYWNrZXQuc3RlcHM/Lm1hcChzdGVwPT57XG4gICAgICBpZihzdGVwLmF1dGhvcmVkUmVtb3ZhbCl0aGlzLmVkaXQoc3RlcC5hdXRob3JlZFJlbW92YWwpO1xuICAgICAgY29uc3QgZm9vdHByaW50PXN0ZXAuYXV0aG9yZWRGb290cHJpbnQ7XG4gICAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZSh7Li4uc3RlcCxcbiAgICAgICAgYXV0aG9yZWRGb290cHJpbnQ6Zm9vdHByaW50P09iamVjdC5mcmVlemUoZm9vdHByaW50LmtpbmQ9PT0nZmllbGRzJz97Li4uZm9vdHByaW50LGZpZWxkczpPYmplY3QuZnJlZXplKFsuLi5mb290cHJpbnQuZmllbGRzXSl9OnsuLi5mb290cHJpbnR9KTp1bmRlZmluZWQsXG4gICAgICAgIG9yZGluYXJ5OnRoaXMuYXJyYXkoc3RlcC5vcmRpbmFyeSkscGh5c2ljYWw6c3RlcC5waHlzaWNhbD90aGlzLmFycmF5KHN0ZXAucGh5c2ljYWwpOnVuZGVmaW5lZH0pO1xuICAgIH0pO1xuICAgIGNvbnN0IHJlc3VsdD1PYmplY3QuZnJlZXplKHsuLi5wYWNrZXQsb3JkaW5hcnk6dGhpcy5hcnJheShwYWNrZXQub3JkaW5hcnkpLHBoeXNpY2FsOnRoaXMuYXJyYXkocGFja2V0LnBoeXNpY2FsKSxcbiAgICAgIHN0ZXBzOnN0ZXBzP09iamVjdC5mcmVlemUoc3RlcHMpOnVuZGVmaW5lZCxcbiAgICAgIG9yZGluYXJ5T3JkZXI6cGFja2V0Lm9yZGluYXJ5T3JkZXI/T2JqZWN0LmZyZWV6ZShbLi4ucGFja2V0Lm9yZGluYXJ5T3JkZXJdKTp1bmRlZmluZWQsXG4gICAgICBwaHlzaWNhbE9yZGVyOnBhY2tldC5waHlzaWNhbE9yZGVyP09iamVjdC5mcmVlemUoWy4uLnBhY2tldC5waHlzaWNhbE9yZGVyXSk6dW5kZWZpbmVkfSk7XG4gICAgdGhpcy5wYWNrZXRzLmFkZChyZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cbi8qKiBPcGFxdWUgc291cmNlLWlzc3VlZCBzdXBwb3J0OyB0aGUgcmVkdWNlciB0cmFuc3BvcnRzLCBuZXZlciBpbnRlcnByZXRzLCBpdC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRW50aXR5UHVibGljYXRpb25FdmlkZW5jZSB7XG4gIGV4Y2x1c2lvbnM/KCk6cmVhZG9ubHkgKHJlYWRvbmx5IFtudW1iZXIsb2JqZWN0XSlbXTtcbiAgbWVtYmVyKHN1YmplY3Q6bnVtYmVyLCB2aWV3OidwaHlzaWNhbCd8J29yZGluYXJ5Jyk6IG9iamVjdDtcbiAgZmllbGQoc3ViamVjdDpudW1iZXIsIGtleTpzdHJpbmcsIHZpZXc6J3BoeXNpY2FsJ3wnb3JkaW5hcnknKTogb2JqZWN0O1xuICBwbGFjZW1lbnQoc3ViamVjdDpudW1iZXIsIHZpZXc6J3BoeXNpY2FsJ3wnb3JkaW5hcnknKTogb2JqZWN0O1xuICBrZXlNYXBwaW5nKHN1YmplY3Q6bnVtYmVyLCB2aWV3OidwaHlzaWNhbCd8J29yZGluYXJ5Jyk6IG9iamVjdDtcbiAgZm9yRWRpdD8oZWRpdDpFbnRpdHlQdWJsaWNhdGlvbkVkaXQpOkVudGl0eVB1YmxpY2F0aW9uRXZpZGVuY2U7XG59XG5leHBvcnQgaW50ZXJmYWNlIEVudGl0eVJldGlyZW1lbnRQbGFuIHtcbiAgcmVhZG9ubHkgcmVhZHk6IGJvb2xlYW47XG4gIC8qKiBTb3VyY2UgZmFjdHMgbWF5IGJlIG5ldXRyYWwgb3IgaGF2ZSBvbmx5IGEgZGlzY2hhcmdlZCBvd24gd2luZG93LiAqL1xuICByZWFkb25seSBjYW5SZXRpcmU6IGJvb2xlYW47XG4gIGN1cnJlbnQoKTogYm9vbGVhbjtcbiAgb25SZWFkeShjYWxsYmFjazogKCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XG4gIC8qKiBPbmx5IGV4YWN0IGxpdmUgY2VsbHMgd2hvc2Ugc2V0dGxlbWVudCBjb3VsZCBtYWtlIHRoaXMgc25hcHNob3QgcmVsZWFzYWJsZS4gKi9cbiAgb25TZXR0bGVtZW50PyhjYWxsYmFjazogKCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XG59XG50eXBlIFJldGlyZW1lbnRSZXF1ZXN0ID0geyBlbGlnaWJsZTogKCkgPT4gYm9vbGVhbjsgcmVsZWFzZT86ICgpID0+IHZvaWQ7IHF1ZXVlZDogYm9vbGVhbiB9O1xuZXhwb3J0IGludGVyZmFjZSBFbnRpdHlQdWJsaWNhdGlvblBhcnRpY2lwYW50IHtcbiAgc2VlZFJlcXVlc3RlZD8oKTpib29sZWFuO1xuICBwcmVwYXJlKHBhY2tldDogRW50aXR5UHVibGljYXRpb25QYWNrZXQsIG5hdGl2ZT86IG9iamVjdCk6IFByZXBhcmVkUHVibGljYXRpb25Vbml0IHwgdW5kZWZpbmVkO1xuICBjb21wbGV0ZShjb21wbGV0aW9uOiBvYmplY3QpOiB2b2lkO1xuICBjYXB0dXJlSW5wdXQ/KHN1YmplY3Q/OiBudW1iZXIsIGZpZWxkPzogc3RyaW5nKTogb2JqZWN0IHwgdW5kZWZpbmVkO1xuICByZXRpcmU/KHN1YmplY3Q6IG51bWJlcik6IHZvaWQ7XG4gIHByZXBhcmVSZXRpcmVtZW50PyhzdWJqZWN0OiBudW1iZXIpOiBFbnRpdHlSZXRpcmVtZW50UGxhbjtcbiAgY2FwdHVyZVZpZXdzPyhzdWJqZWN0PzogbnVtYmVyLGZpZWxkPzogc3RyaW5nKTogcmVhZG9ubHkgb2JqZWN0W107XG4gIGV2aWRlbmNlPygpOkVudGl0eVB1YmxpY2F0aW9uRXZpZGVuY2U7XG4gIGluc3BlY3Q/KCk6IFJlYWRvbmx5PFJlY29yZDxzdHJpbmcsbnVtYmVyPj47XG59XG5sZXQgZmFjdG9yeTogKChzb3VyY2U6IEVudGl0eVB1YmxpY2F0aW9uU291cmNlKSA9PiBFbnRpdHlQdWJsaWNhdGlvblBhcnRpY2lwYW50KSB8IHVuZGVmaW5lZDtcbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckVudGl0eVB1YmxpY2F0aW9uRmFjdG9yeSh2YWx1ZTogTm9uTnVsbGFibGU8dHlwZW9mIGZhY3Rvcnk+KTogdm9pZCB7XG4gIGlmIChmYWN0b3J5KSB0aHJvdyBuZXcgRXJyb3IoJ0VudGl0eSBwdWJsaWNhdGlvbiBhdXRob3JpdHkgYWxyZWFkeSByZWdpc3RlcmVkJyk7XG4gIGZhY3RvcnkgPSB2YWx1ZTtcbn1cbi8qKiBOYXRpdmUgb3duZXJzaGlwIGxpdmVzIHdpdGggdGhlIGNvbGxlY3Rpb24gZXZlbiB3aGVuIHRoZXJlIGFyZSBubyByZWNpcGllbnRzLiAqL1xuZXhwb3J0IGNsYXNzIEVudGl0eVB1YmxpY2F0aW9uU291cmNlIHtcbiAgcHJpdmF0ZSByZWFkb25seSBhZG1pc3Npb24gPSBuZXcgQWRtaXNzaW9uTWV0YWRhdGEoKTtcbiAgcHJpdmF0ZSBuYXRpdmU6IEVudGl0eVB1YmxpY2F0aW9uUGFydGljaXBhbnQgfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgcmVhZG9ubHkgcmVjaXBpZW50cyA9IG5ldyBTZXQ8RW50aXR5UHVibGljYXRpb25QYXJ0aWNpcGFudD4oKTtcbiAgcHJpdmF0ZSByZWNpcGllbnRSZXZpc2lvbiA9IDA7XG4gIHByaXZhdGUgcmV2aXNpb25Ub2tlbjpvYmplY3Q9e307XG4gIC8vIERpc3RpbmN0IGZyb20gb3JkaW5hcnkgc3RhZ2VkIGluc3RhbGxzOiBwaHlzaWNhbCBhbmQgb3JkaW5hcnkgcGxhbnMgbWF5XG4gIC8vIGludGVudGlvbmFsbHkgaW5zdGFsbCBpbiBzZXF1ZW5jZS4gUmV0aXJlbWVudCBpbnZhbGlkYXRlcyBldmVyeSBvbGQgcmVhZGVyLlxuICBwcml2YXRlIHJldGlyZW1lbnRSZXZpc2lvbjogb2JqZWN0ID0ge307XG4gIHByaXZhdGUgcmVhZG9ubHkgcmV0aXJlbWVudHMgPSBuZXcgTWFwPG51bWJlciwgUmV0aXJlbWVudFJlcXVlc3Q+KCk7XG4gIHByaXZhdGUgZGlzcG9zZWQgPSBmYWxzZTtcbiAgLyoqIENhbGxlZCBvbmx5IGZvciBhIHN1Y2Nlc3NmdWxseSBpbnN0YWxsZWQga2VybmVsIGZvcmdldC1saWZldGltZSBtdXRhdGlvbi4gKi9cbiAgcmVxdWVzdFJldGlyZW1lbnQoc3ViamVjdDogbnVtYmVyLCBlbGlnaWJsZTogKCkgPT4gYm9vbGVhbik6IHZvaWQge1xuICAgIGlmICh0aGlzLmRpc3Bvc2VkKSByZXR1cm47XG4gICAgdGhpcy5jYW5jZWxSZXRpcmVtZW50KHN1YmplY3QpO1xuICAgIGNvbnN0IHJlcXVlc3Q6IFJldGlyZW1lbnRSZXF1ZXN0ID0geyBlbGlnaWJsZSwgcXVldWVkOiBmYWxzZSB9O1xuICAgIHRoaXMucmV0aXJlbWVudHMuc2V0KHN1YmplY3QsIHJlcXVlc3QpO1xuICAgIHRoaXMuc2NoZWR1bGVSZXRpcmVtZW50KHN1YmplY3QsIHJlcXVlc3QpO1xuICB9XG4gIHByaXZhdGUgY2FuY2VsUmV0aXJlbWVudChzdWJqZWN0OiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCByZXF1ZXN0ID0gdGhpcy5yZXRpcmVtZW50cy5nZXQoc3ViamVjdCk7XG4gICAgdGhpcy5yZXRpcmVtZW50cy5kZWxldGUoc3ViamVjdCk7XG4gICAgcmVxdWVzdD8ucmVsZWFzZT8uKCk7XG4gIH1cbiAgcHJpdmF0ZSBzY2hlZHVsZVJldGlyZW1lbnQoc3ViamVjdDogbnVtYmVyLCByZXF1ZXN0OiBSZXRpcmVtZW50UmVxdWVzdCk6IHZvaWQge1xuICAgIGlmIChyZXF1ZXN0LnF1ZXVlZCB8fCB0aGlzLmRpc3Bvc2VkIHx8IHRoaXMucmV0aXJlbWVudHMuZ2V0KHN1YmplY3QpICE9PSByZXF1ZXN0KSByZXR1cm47XG4gICAgcmVxdWVzdC5xdWV1ZWQgPSB0cnVlO1xuICAgIC8vIFJlYWRpbmVzcyBjYW4gbm90aWZ5IGR1cmluZyBmaW5hbGl6ZSwgYmVmb3JlIGluc3RhbGxhdGlvbi4gT25seSByZWNoZWNrXG4gICAgLy8gYWZ0ZXIgdGhlIHN5bmNocm9ub3VzIGluc3RhbGxlZCBjb21wbGV0aW9uL3JlZW50cnkgZnJvbnRpZXIgaGFzIGNsb3NlZC5cbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gICAgICByZXF1ZXN0LnF1ZXVlZCA9IGZhbHNlO1xuICAgICAgaWYgKHRoaXMuZGlzcG9zZWQgfHwgdGhpcy5yZXRpcmVtZW50cy5nZXQoc3ViamVjdCkgIT09IHJlcXVlc3QpIHJldHVybjtcbiAgICAgIHJlcXVlc3QucmVsZWFzZT8uKCk7IHJlcXVlc3QucmVsZWFzZSA9IHVuZGVmaW5lZDtcbiAgICAgIGlmICghcmVxdWVzdC5lbGlnaWJsZSgpKSB7IHRoaXMuY2FuY2VsUmV0aXJlbWVudChzdWJqZWN0KTsgcmV0dXJuOyB9XG4gICAgICBjb25zdCByZXZpc2lvbiA9IHRoaXMucmV2aXNpb25Ub2tlbjtcbiAgICAgIGNvbnN0IHBsYW4gPSB0aGlzLm5hdGl2ZT8ucHJlcGFyZVJldGlyZW1lbnQ/LihzdWJqZWN0KTtcbiAgICAgIGlmICghcGxhbikgeyB0aGlzLmNhbmNlbFJldGlyZW1lbnQoc3ViamVjdCk7IHJldHVybjsgfVxuICAgICAgaWYgKCFwbGFuLnJlYWR5KSB7XG4gICAgICAgIHJlcXVlc3QucmVsZWFzZSA9IHBsYW4ub25SZWFkeSgoKSA9PiB0aGlzLnNjaGVkdWxlUmV0aXJlbWVudChzdWJqZWN0LCByZXF1ZXN0KSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIFJlYWRpbmVzcyBhbmQgb3duZXIgc2V0dGxlbWVudCBhcmUgc2VwYXJhdGUgbGlmZXRpbWVzLiBBIHBlcm1hbmVudGx5XG4gICAgICAvLyBpbmVsaWdpYmxlIHByb29mIHJlbWFpbnMgZXZpZGVuY2UsIHdpdGhvdXQgcmV0YWluaW5nIGEgZGVhZCByZXF1ZXN0LlxuICAgICAgaWYgKCFwbGFuLmNhblJldGlyZSkge1xuICAgICAgICBpZiAocGxhbi5vblNldHRsZW1lbnQpIHJlcXVlc3QucmVsZWFzZSA9IHBsYW4ub25TZXR0bGVtZW50KCgpID0+IHRoaXMuc2NoZWR1bGVSZXRpcmVtZW50KHN1YmplY3QsIHJlcXVlc3QpKTtcbiAgICAgICAgZWxzZSB0aGlzLmNhbmNlbFJldGlyZW1lbnQoc3ViamVjdCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghcmVxdWVzdC5lbGlnaWJsZSgpIHx8IHJldmlzaW9uICE9PSB0aGlzLnJldmlzaW9uVG9rZW4gfHwgIXBsYW4uY3VycmVudCgpKSB7XG4gICAgICAgIHRoaXMuY2FuY2VsUmV0aXJlbWVudChzdWJqZWN0KTsgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5jYW5jZWxSZXRpcmVtZW50KHN1YmplY3QpO1xuICAgICAgdGhpcy5yZXRpcmUoc3ViamVjdCk7XG4gICAgfSk7XG4gIH1cbiAgZGlzcG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLmRpc3Bvc2VkID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IHN1YmplY3Qgb2YgdGhpcy5yZXRpcmVtZW50cy5rZXlzKCkpIHRoaXMuY2FuY2VsUmV0aXJlbWVudChzdWJqZWN0KTtcbiAgICB0aGlzLnJldmlzaW9uVG9rZW4gPSB7fTtcbiAgICB0aGlzLnJldGlyZW1lbnRSZXZpc2lvbiA9IHt9O1xuICB9XG4gIHJldmlzaW9uKCk6b2JqZWN0IHsgcmV0dXJuIHRoaXMucmV2aXNpb25Ub2tlbjsgfVxuICBwcml2YXRlIG5hdGl2ZVBhcnRpY2lwYW50KCk6IEVudGl0eVB1YmxpY2F0aW9uUGFydGljaXBhbnQgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLm5hdGl2ZSA/Pz0gZmFjdG9yeT8uKHRoaXMpO1xuICB9XG4gIHN1YnNjcmliZShwYXJ0aWNpcGFudDogRW50aXR5UHVibGljYXRpb25QYXJ0aWNpcGFudCk6ICgpID0+IHZvaWQge1xuICAgIHRoaXMubmF0aXZlUGFydGljaXBhbnQoKTtcbiAgICB0aGlzLnJlY2lwaWVudHMuYWRkKHBhcnRpY2lwYW50KTtcbiAgICB0aGlzLnJlY2lwaWVudFJldmlzaW9uKys7dGhpcy5yZXZpc2lvblRva2VuPXt9O1xuICAgIHJldHVybiAoKSA9PiB7IGlmKHRoaXMucmVjaXBpZW50cy5kZWxldGUocGFydGljaXBhbnQpKXt0aGlzLnJlY2lwaWVudFJldmlzaW9uKys7dGhpcy5yZXZpc2lvblRva2VuPXt9O30gfTtcbiAgfVxuICBjYXB0dXJlSW5wdXQoc3ViamVjdD86IG51bWJlciwgZmllbGQ/OiBzdHJpbmcpOiBvYmplY3QgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLm5hdGl2ZVBhcnRpY2lwYW50KCk/LmNhcHR1cmVJbnB1dD8uKHN1YmplY3QsIGZpZWxkKTtcbiAgfVxuICBwcmVwYXJlUG9pbnQocGFja2V0OkVudGl0eVB1YmxpY2F0aW9uUGFja2V0KTpQcmVwYXJlZFB1YmxpY2F0aW9uVW5pdHx1bmRlZmluZWQge1xuICAgIGlmKCFwb2ludFByZXBhcmF0aW9uKXJldHVybiB0aGlzLnByZXBhcmUocGFja2V0KTtcbiAgICAvLyBSZWZ1c2FsIG11c3Qgbm90IGVucm9sbCBhIHNvdXJjZSBvciBsZWF2ZSBhIHBoYW50b20gZW1wdHkgZ3JvdXAgYmVoaW5kLlxuICAgIC8vIENvbXBsZXRlIGFsbCBhZG1pc3Npb24gd29yayBiZWZvcmUgcHVibGlzaGluZyBkZWZlcnJlZCBib29ra2VlcGluZy5cbiAgICBwYWNrZXQ9dGhpcy5hZG1pc3Npb24ucHJlcGFyZShwYWNrZXQpO1xuICAgIGxldCBncm91cD1wb2ludFByZXBhcmF0aW9uLmdldCh0aGlzKTtcbiAgICBpZighZ3JvdXApe1xuICAgICAgY29uc3Qgc291cmNlPXRoaXM7XG4gICAgICBjb25zdCBzdGF0ZTpQb2ludFByZXBhcmF0aW9uPXtwYWNrZXRzOltdLHNvdXJjZSx1bml0OnVuZGVmaW5lZCxpbnN0YWxsZWQ6ZmFsc2UsZmluYWxpemVkOmZhbHNlLGNvbXBsZXRlZDpmYWxzZX07XG4gICAgICBjb25zdCBjb21wbGV0aW9uPXt9O3BvaW50Q29tcGxldGlvbnMuc2V0KGNvbXBsZXRpb24sKCk9PntpZighc3RhdGUuY29tcGxldGVkKXtzdGF0ZS5jb21wbGV0ZWQ9dHJ1ZTtpZihzdGF0ZS51bml0KXNvdXJjZS5jb21wbGV0ZShzdGF0ZS51bml0LmNvbXBsZXRpb24pO319KTtcbiAgICAgIGNvbnN0IGdhdGU9e3NldChfa2V5OnVua25vd24sX3ZhbHVlOnVua25vd24pe2lmKCFzdGF0ZS5pbnN0YWxsZWQpe3N0YXRlLmluc3RhbGxlZD10cnVlO2lmKHN0YXRlLnVuaXQpaW5zdGFsbFRlcm1pbmFsUmVjb3JkKHN0YXRlLnVuaXQucmVjb3JkKTt9fX07XG4gICAgICBncm91cD17c3RhdGUscHVibGljYXRpb246e3JlY29yZDp7d3JpdGVzOlt7bWFwOmdhdGUsa2V5OnVuZGVmaW5lZCx2YWx1ZTp1bmRlZmluZWR9XSxhZGRzOltdfSxjb21wbGV0aW9uLHZhbGlkYXRlOigpPT5zdGF0ZS51bml0Py52YWxpZGF0ZT8uKCksZmluYWxpemU6KCk9PntpZighc3RhdGUuZmluYWxpemVkKXtzdGF0ZS5maW5hbGl6ZWQ9dHJ1ZTtzdGF0ZS51bml0Py5maW5hbGl6ZT8uKCk7fX19fTtcbiAgICAgIHBvaW50UHJlcGFyYXRpb24uc2V0KHRoaXMsZ3JvdXApO1xuICAgIH1cbiAgICBncm91cC5zdGF0ZS5wYWNrZXRzLnB1c2gocGFja2V0KTtyZXR1cm4gZ3JvdXAucHVibGljYXRpb247XG4gIH1cbiAgcHJlcGFyZShwYWNrZXQ6IEVudGl0eVB1YmxpY2F0aW9uUGFja2V0KTogUHJlcGFyZWRQdWJsaWNhdGlvblVuaXQgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHJlY2lwaWVudFJldmlzaW9uID0gdGhpcy5yZWNpcGllbnRSZXZpc2lvbixzb3VyY2VSZXZpc2lvbj10aGlzLnJldmlzaW9uVG9rZW47XG4gICAgY29uc3QgcmV0aXJlbWVudFJldmlzaW9uID0gdGhpcy5yZXRpcmVtZW50UmV2aXNpb247XG4gICAgY29uc3QgcGFydHM6IHsgcGFydGljaXBhbnQ6IEVudGl0eVB1YmxpY2F0aW9uUGFydGljaXBhbnQ7IHVuaXQ6IFByZXBhcmVkUHVibGljYXRpb25Vbml0IH1bXSA9IFtdO1xuICAgIHBhY2tldD10aGlzLmFkbWlzc2lvbi5wcmVwYXJlKHBhY2tldCk7XG4gICAgY29uc3QgbmF0aXZlID0gdGhpcy5uYXRpdmVQYXJ0aWNpcGFudCgpO1xuICAgIGNvbnN0IG5hdGl2ZVVuaXQgPSBuYXRpdmU/LnByZXBhcmUocGFja2V0KTtcbiAgICBjb25zdCBmYWxsYmFja1JlY29yZCA9IG5hdGl2ZSA/IHVuZGVmaW5lZCA6IHBhY2tldC5wcmVwYXJlUmVzcG9uc2liaWxpdHk/LigpO1xuICAgIGlmIChuYXRpdmUgJiYgbmF0aXZlVW5pdCkgcGFydHMucHVzaCh7IHBhcnRpY2lwYW50OiBuYXRpdmUsIHVuaXQ6IG5hdGl2ZVVuaXQgfSk7XG4gICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBbLi4udGhpcy5yZWNpcGllbnRzXSkge1xuICAgICAgY29uc3QgdW5pdCA9IHBhcnRpY2lwYW50LnByZXBhcmUocGFja2V0LCBuYXRpdmVVbml0Py5jb21wbGV0aW9uKTtcbiAgICAgIGlmICh1bml0KSBwYXJ0cy5wdXNoKHsgcGFydGljaXBhbnQsIHVuaXQgfSk7XG4gICAgfVxuICAgIGlmKHNvdXJjZVJldmlzaW9uIT09dGhpcy5yZXZpc2lvblRva2VuJiZyZWNpcGllbnRSZXZpc2lvbj09PXRoaXMucmVjaXBpZW50UmV2aXNpb24pdGhyb3cgbmV3IEVycm9yKFwiRW50aXR5IHB1YmxpY2F0aW9uIHNvdXJjZSBjaGFuZ2VkIGR1cmluZyBwcmVwYXJhdGlvblwiKTtcbiAgICBpZiAocmVjaXBpZW50UmV2aXNpb24gIT09IHRoaXMucmVjaXBpZW50UmV2aXNpb24pIHRocm93IG5ldyBFcnJvcignRW50aXR5IHB1YmxpY2F0aW9uIHJlY2lwaWVudHMgY2hhbmdlZCBkdXJpbmcgcHJlcGFyYXRpb24nKTtcbiAgICBpZiAoIXBhcnRzLmxlbmd0aCAmJiAhZmFsbGJhY2tSZWNvcmQpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgY29uc3QgdmFsaWRhdGUgPSAoKSA9PiB7XG4gICAgICBpZiAodGhpcy5kaXNwb3NlZCB8fCByZXRpcmVtZW50UmV2aXNpb24gIT09IHRoaXMucmV0aXJlbWVudFJldmlzaW9uIHx8IHJlY2lwaWVudFJldmlzaW9uICE9PSB0aGlzLnJlY2lwaWVudFJldmlzaW9uIHx8IHNvdXJjZVJldmlzaW9uICE9PSB0aGlzLnJldmlzaW9uVG9rZW4pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRW50aXR5IHB1YmxpY2F0aW9uIHNvdXJjZSBjaGFuZ2VkIGJlZm9yZSBpbnN0YWxsYXRpb24nKTtcbiAgICB9O1xuICAgIHJldHVybiB7XG4gICAgICB2YWxpZGF0ZSxcbiAgICAgIHJlY29yZDogY29tYmluZVRlcm1pbmFsUmVjb3JkcyhmYWxsYmFja1JlY29yZCwuLi5wYXJ0cy5tYXAocGFydCA9PiBwYXJ0LnVuaXQucmVjb3JkKSx7d3JpdGVzOlt7bWFwOntzZXQ6KF9rZXk6dW5rbm93bix2YWx1ZTp1bmtub3duKT0+e3RoaXMucmV2aXNpb25Ub2tlbj12YWx1ZSBhcyBvYmplY3Q7fX0sa2V5OnVuZGVmaW5lZCx2YWx1ZTp7fX1dLGFkZHM6W119KSEsXG4gICAgICBjb21wbGV0aW9uOiB7IHBhcnRzIH0sXG4gICAgICBmaW5hbGl6ZTogKCkgPT4ge1xuICAgICAgICB2YWxpZGF0ZSgpO1xuICAgICAgICBjb25zdCBiZWZvcmVGaW5hbGl6ZSA9IHRoaXMucmV2aXNpb25Ub2tlbjtcbiAgICAgICAgZm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSBwYXJ0LnVuaXQuZmluYWxpemU/LigpO1xuICAgICAgICB2YWxpZGF0ZSgpO1xuICAgICAgICBpZiAoYmVmb3JlRmluYWxpemUgIT09IHRoaXMucmV2aXNpb25Ub2tlbilcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0VudGl0eSBwdWJsaWNhdGlvbiBzb3VyY2UgY2hhbmdlZCBkdXJpbmcgZmluYWxpemF0aW9uJyk7XG4gICAgICB9LFxuICAgIH07XG4gIH1cbiAgcmVxdWVzdHNTZWVkKCk6Ym9vbGVhbiB7IHJldHVybiBbLi4udGhpcy5yZWNpcGllbnRzXS5zb21lKHBhcnRpY2lwYW50PT5wYXJ0aWNpcGFudC5zZWVkUmVxdWVzdGVkPy4oKSk7IH1cbiAgZXZpZGVuY2UoKTpFbnRpdHlQdWJsaWNhdGlvbkV2aWRlbmNlfHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLm5hdGl2ZVBhcnRpY2lwYW50KCk/LmV2aWRlbmNlPy4oKTsgfVxuICBjYXB0dXJlVmlld3Moc3ViamVjdD86bnVtYmVyLGZpZWxkPzpzdHJpbmcpOiByZWFkb25seSBvYmplY3RbXSB7IHJldHVybiB0aGlzLm5hdGl2ZVBhcnRpY2lwYW50KCk/LmNhcHR1cmVWaWV3cz8uKHN1YmplY3QsZmllbGQpPz9bXTsgfVxuICBpbnNwZWN0KCk6IFJlYWRvbmx5PFJlY29yZDxzdHJpbmcsbnVtYmVyPj4geyByZXR1cm4gey4uLih0aGlzLm5hdGl2ZT8uaW5zcGVjdD8uKCk/P3t9KSxyZWNpcGllbnRzOnRoaXMucmVjaXBpZW50cy5zaXplLG5hdGl2ZTp0aGlzLm5hdGl2ZT8xOjAscmV0aXJlbWVudFJlcXVlc3RzOnRoaXMucmV0aXJlbWVudHMuc2l6ZX07IH1cbiAgcmV0aXJlKHN1YmplY3Q6IG51bWJlcik6IHZvaWQgeyB0aGlzLmNhbmNlbFJldGlyZW1lbnQoc3ViamVjdCk7IHRoaXMubmF0aXZlPy5yZXRpcmU/LihzdWJqZWN0KTsgdGhpcy5yZXZpc2lvblRva2VuID0ge307IHRoaXMucmV0aXJlbWVudFJldmlzaW9uID0ge307IH1cbiAgY29tcGxldGUoY29tcGxldGlvbjogb2JqZWN0KTogdm9pZCB7XG4gICAgY29uc3QgcG9pbnQ9cG9pbnRDb21wbGV0aW9ucy5nZXQoY29tcGxldGlvbik7aWYocG9pbnQpe3BvaW50KCk7cmV0dXJuO31cbiAgICBjb25zdCB7IHBhcnRzIH0gPSBjb21wbGV0aW9uIGFzIHsgcGFydHM6IHJlYWRvbmx5IHtwYXJ0aWNpcGFudDogRW50aXR5UHVibGljYXRpb25QYXJ0aWNpcGFudDsgdW5pdDogUHJlcGFyZWRQdWJsaWNhdGlvblVuaXR9W10gfTtcbiAgICBsZXQgZmFpbGVkID0gZmFsc2U7XG4gICAgbGV0IGZpcnN0OiB1bmtub3duO1xuICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgICAgdHJ5IHsgcGFydC5wYXJ0aWNpcGFudC5jb21wbGV0ZShwYXJ0LnVuaXQuY29tcGxldGlvbik7IH1cbiAgICAgIGNhdGNoIChlcnJvcikgeyBpZiAoIWZhaWxlZCkgeyBmYWlsZWQgPSB0cnVlOyBmaXJzdCA9IGVycm9yOyB9IH1cbiAgICB9XG4gICAgaWYgKGZhaWxlZCkgdGhyb3cgZmlyc3Q7XG4gIH1cbn1cbmNvbnN0IEVOVElUWV9QVUJMSUNBVElPTiA9IFN5bWJvbCgnc2lnbmFsdHJlZS5lbnRpdHlQdWJsaWNhdGlvbicpO1xuY29uc3QgYW5jaG9ycyA9IG5ldyBXZWFrTWFwPEVudGl0eVB1YmxpY2F0aW9uU291cmNlLCBvYmplY3Q+KCk7XG5leHBvcnQgZnVuY3Rpb24gZ2V0RW50aXR5UHVibGljYXRpb25BbmNob3Ioc291cmNlOiBFbnRpdHlQdWJsaWNhdGlvblNvdXJjZSk6IG9iamVjdCB8IHVuZGVmaW5lZCB7IHJldHVybiBhbmNob3JzLmdldChzb3VyY2UpOyB9XG5leHBvcnQgaW50ZXJmYWNlIEVudGl0eVB1YmxpY2F0aW9uQmluZGluZyB7XG4gIHJlYWRvbmx5IHJlcGxhY2VTZWxlY3RlZD86ICh2YWx1ZTogdW5rbm93biwgc2VsZWN0aW9uOiBpbXBvcnQoJy4vbmF0aXZlLWZpZWxkLXNlbGVjdGlvbicpLkNsYWltZWRGaWVsZEVuZHBvaW50KSA9PiB2b2lkO1xuICByZWFkb25seSBzb3VyY2U6IEVudGl0eVB1YmxpY2F0aW9uU291cmNlO1xuICByZWFkb25seSBzdWJqZWN0PzogbnVtYmVyO1xuICByZWFkb25seSBmaWVsZD86IHN0cmluZztcbn1cbmV4cG9ydCBmdW5jdGlvbiBkZWZpbmVFbnRpdHlQdWJsaWNhdGlvbkJpbmRpbmcobm9kZTogb2JqZWN0LCBiaW5kaW5nOiBFbnRpdHlQdWJsaWNhdGlvbkJpbmRpbmcpOiB2b2lkIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5vZGUsIEVOVElUWV9QVUJMSUNBVElPTiwgeyB2YWx1ZTogYmluZGluZyB9KTtcbiAgaWYgKGJpbmRpbmcuc3ViamVjdCA9PT0gdW5kZWZpbmVkICYmIGJpbmRpbmcuZmllbGQgPT09IHVuZGVmaW5lZCkgYW5jaG9ycy5zZXQoYmluZGluZy5zb3VyY2UsIG5vZGUpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldEVudGl0eVB1YmxpY2F0aW9uQmluZGluZyhub2RlOiB1bmtub3duKTogRW50aXR5UHVibGljYXRpb25CaW5kaW5nIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIG5vZGUgIT09IG51bGwgJiYgKHR5cGVvZiBub2RlID09PSAnb2JqZWN0JyB8fCB0eXBlb2Ygbm9kZSA9PT0gJ2Z1bmN0aW9uJylcbiAgICA/IChub2RlIGFzIFJlY29yZDxzeW1ib2wsIEVudGl0eVB1YmxpY2F0aW9uQmluZGluZyB8IHVuZGVmaW5lZD4pW0VOVElUWV9QVUJMSUNBVElPTl1cbiAgICA6IHVuZGVmaW5lZDtcbn1cblxuY29uc3QgaW5wdXRTY29wZXM6IG9iamVjdFtdID0gW107XG5leHBvcnQgZnVuY3Rpb24gd2l0aEVudGl0eVB1YmxpY2F0aW9uSW5wdXQ8VD4oc291cmNlOiBFbnRpdHlQdWJsaWNhdGlvblNvdXJjZSwgc3ViamVjdDogbnVtYmVyIHwgdW5kZWZpbmVkLCBmaWVsZDogc3RyaW5nIHwgdW5kZWZpbmVkLCBib2R5OiAoKSA9PiBUKTogVCB7XG4gIGNvbnN0IGlucHV0ID0gc291cmNlLmNhcHR1cmVJbnB1dChzdWJqZWN0LGZpZWxkKTtcbiAgaWYgKGlucHV0KSBpbnB1dFNjb3Blcy5wdXNoKGlucHV0KTtcbiAgdHJ5IHsgcmV0dXJuIGJvZHkoKTsgfSBmaW5hbGx5IHsgaWYgKGlucHV0KSBpbnB1dFNjb3Blcy5wb3AoKTsgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJlbnRFbnRpdHlQdWJsaWNhdGlvbklucHV0cygpOiByZWFkb25seSBvYmplY3RbXSB7IHJldHVybiBpbnB1dFNjb3BlczsgfVxuY29uc3QgSU5TVEFMTEVEX1VOSVQgPSBTeW1ib2woJ2VudGl0eS1pbnN0YWxsZWQtcHVibGljYXRpb24nKTtcbmV4cG9ydCBmdW5jdGlvbiB3aXRoRW50aXR5UHVibGljYXRpb25Vbml0KG1ldGE6IFdyaXRlTWV0YWRhdGEgfCB1bmRlZmluZWQsIGlkOiBvYmplY3QpOiBXcml0ZU1ldGFkYXRhIHtcbiAgY29uc3QgcmVzdWx0OiBXcml0ZU1ldGFkYXRhICYge1tJTlNUQUxMRURfVU5JVF06b2JqZWN0fSA9IHsuLi5tZXRhLFtJTlNUQUxMRURfVU5JVF06aWR9O1xuICByZXR1cm4gcmVzdWx0O1xufVxuZXhwb3J0IGZ1bmN0aW9uIGVudGl0eVB1YmxpY2F0aW9uVW5pdChtZXRhOiBXcml0ZU1ldGFkYXRhIHwgdW5kZWZpbmVkKTogb2JqZWN0IHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIChtZXRhIGFzIChXcml0ZU1ldGFkYXRhICYge1tJTlNUQUxMRURfVU5JVF0/Om9iamVjdH0pIHwgdW5kZWZpbmVkKT8uW0lOU1RBTExFRF9VTklUXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdpdGhFbnRpdHlCb3VuZFB1YmxpY2F0aW9uSW5wdXQ8VD4obm9kZTogb2JqZWN0LCBib2R5OiAoKSA9PiBUKTogVCB7XG4gIGNvbnN0IGJpbmRpbmc9Z2V0RW50aXR5UHVibGljYXRpb25CaW5kaW5nKG5vZGUpO1xuICByZXR1cm4gYmluZGluZz93aXRoRW50aXR5UHVibGljYXRpb25JbnB1dChiaW5kaW5nLnNvdXJjZSxiaW5kaW5nLnN1YmplY3QsYmluZGluZy5maWVsZCxib2R5KTpib2R5KCk7XG59XG5cbmNvbnN0IHByZXBhcmVkQ2hhbmdlcyA9IG5ldyBXZWFrTWFwPG9iamVjdCxvYmplY3Q+KCk7XG5leHBvcnQgZnVuY3Rpb24gbWFya0VudGl0eVB1YmxpY2F0aW9uRmFjdHMoZmFjdHM6IG9iamVjdCwgdW5pdDogb2JqZWN0KTogdm9pZCB7IHByZXBhcmVkQ2hhbmdlcy5zZXQoZmFjdHMsdW5pdCk7IH1cbmV4cG9ydCBmdW5jdGlvbiBlbnRpdHlQdWJsaWNhdGlvbkZhY3RzVW5pdChmYWN0czogb2JqZWN0KTogb2JqZWN0IHwgdW5kZWZpbmVkIHsgcmV0dXJuIHByZXBhcmVkQ2hhbmdlcy5nZXQoZmFjdHMpOyB9XG5cbmludGVyZmFjZSBQb2ludFByZXBhcmF0aW9uIHtwYWNrZXRzOkVudGl0eVB1YmxpY2F0aW9uUGFja2V0W107c291cmNlOkVudGl0eVB1YmxpY2F0aW9uU291cmNlO3VuaXQ6UHJlcGFyZWRQdWJsaWNhdGlvblVuaXR8dW5kZWZpbmVkO2luc3RhbGxlZDpib29sZWFuO2ZpbmFsaXplZDpib29sZWFuO2NvbXBsZXRlZDpib29sZWFufVxuaW50ZXJmYWNlIFBvaW50R3JvdXAge3N0YXRlOlBvaW50UHJlcGFyYXRpb247cHVibGljYXRpb246UHJlcGFyZWRQdWJsaWNhdGlvblVuaXR9XG5sZXQgcG9pbnRQcmVwYXJhdGlvbjpNYXA8RW50aXR5UHVibGljYXRpb25Tb3VyY2UsUG9pbnRHcm91cD58dW5kZWZpbmVkO1xuY29uc3QgcG9pbnRDb21wbGV0aW9ucz1uZXcgV2Vha01hcDxvYmplY3QsKCk9PnZvaWQ+KCk7XG4vKiogUHJlc2VydmUgcGVyLWxpZmV0aW1lIG5hdGl2ZSBwbGFucyB3aGlsZSBwcmVwYXJpbmcgdGhlaXIgb25lIGNvbGxlY3Rpb24gdW5pdC4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3aXRoRW50aXR5UG9pbnRQdWJsaWNhdGlvblByZXBhcmF0aW9uPFQ+KGJvZHk6KCk9PlQpOlQge1xuICBjb25zdCBwcmV2aW91cz1wb2ludFByZXBhcmF0aW9uLGdyb3Vwcz1uZXcgTWFwPEVudGl0eVB1YmxpY2F0aW9uU291cmNlLFBvaW50R3JvdXA+KCk7XG4gIHBvaW50UHJlcGFyYXRpb249Z3JvdXBzO2xldCByZXN1bHQ6VDtcbiAgdHJ5e3Jlc3VsdD1ib2R5KCk7fWZpbmFsbHl7cG9pbnRQcmVwYXJhdGlvbj1wcmV2aW91czt9XG4gIGZvcihjb25zdCB7c3RhdGV9b2YgZ3JvdXBzLnZhbHVlcygpKXtcbiAgICBjb25zdCBmaXJzdD1zdGF0ZS5wYWNrZXRzWzBdITtcbiAgICBzdGF0ZS51bml0PXN0YXRlLnNvdXJjZS5wcmVwYXJlKHsuLi5maXJzdCxwaHlzaWNhbDpzdGF0ZS5wYWNrZXRzLmZsYXRNYXAocGFja2V0PT5wYWNrZXQucGh5c2ljYWwpLG9yZGluYXJ5OnN0YXRlLnBhY2tldHMuZmxhdE1hcChwYWNrZXQ9PnBhY2tldC5vcmRpbmFyeSksc3RlcHM6c3RhdGUucGFja2V0cy5mbGF0TWFwKHBhY2tldD0+cGFja2V0LnN0ZXBzPz9wYWNrZXQub3JkaW5hcnkubWFwKChlZGl0LG9yZGluYWwpPT4oe29yZGluYWwsb3JkaW5hcnk6W2VkaXRdfSkpKX0pO1xuICAgIHN0YXRlLnBhY2tldHM9W107XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJmaWxlIjoiL3NyYy9saWIvaW50ZXJuYWxzL2VudGl0eS1wdWJsaWNhdGlvbi50cyJ9

//# vitestCache=W3siZmlsZSI6IjEiLCJpZCI6IjEiLCJ1cmwiOiIyIiwiaW1wb3J0ZWRVcmxzIjoiMyIsIm1hcHBpbmdzIjpmYWxzZX0sIi9wcml2YXRlL3RtcC9zdC1jMjgtcjMtc2FtcGxlZC1hbGxvY2F0aW9uL2Jhc2VsaW5lL2NhbmRpZGF0ZS9wYWNrYWdlcy9rZXJuZWwvc3JjL2xpYi9pbnRlcm5hbHMvZW50aXR5LXB1YmxpY2F0aW9uLnRzIiwiL3NyYy9saWIvaW50ZXJuYWxzL2VudGl0eS1wdWJsaWNhdGlvbi50cyIsW11d
}}