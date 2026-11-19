from pathlib import Path
r=Path('/private/tmp/st-publication-retirement-successor/candidate/packages/kernel/src/lib')
p=r/'internals/entity-publication.ts';s=p.read_text();s=s.replace('export interface EntityPublicationParticipant {','''export interface EntityRetirementPlan {
  readonly ready: boolean;
  readonly neutral: boolean;
  current(): boolean;
  onReady(callback: () => void): () => void;
}
type RetirementRequest = { eligible: () => boolean; release?: () => void; queued: boolean };
export interface EntityPublicationParticipant {''').replace('  retire?(subject: number): void;','  retire?(subject: number): void;\n  prepareRetirement?(subject: number): EntityRetirementPlan;')
s=s.replace('  private revisionToken:object={};','''  private revisionToken:object={};
  private readonly retirements = new Map<number, RetirementRequest>();
  private disposed = false;
  /** Called only for a successfully installed kernel forget-lifetime mutation. */
  requestRetirement(subject: number, eligible: () => boolean): void {
    if (this.disposed) return;
    this.cancelRetirement(subject);
    const request: RetirementRequest = { eligible, queued: false };
    this.retirements.set(subject, request);
    this.scheduleRetirement(subject, request);
  }
  private cancelRetirement(subject: number): void {
    const request = this.retirements.get(subject);
    this.retirements.delete(subject);
    request?.release?.();
  }
  private scheduleRetirement(subject: number, request: RetirementRequest): void {
    if (request.queued || this.disposed || this.retirements.get(subject) !== request) return;
    request.queued = true;
    // Readiness can notify during finalize, before installation. Only recheck
    // after the synchronous installed completion/reentry frontier has closed.
    queueMicrotask(() => {
      request.queued = false;
      if (this.disposed || this.retirements.get(subject) !== request) return;
      request.release?.(); request.release = undefined;
      if (!request.eligible()) { this.cancelRetirement(subject); return; }
      const revision = this.revisionToken;
      const plan = this.native?.prepareRetirement?.(subject);
      if (!plan) { this.cancelRetirement(subject); return; }
      if (!plan.ready) {
        request.release = plan.onReady(() => this.scheduleRetirement(subject, request));
        return;
      }
      // No owner-settlement subscription is implied by requirement readiness.
      // A ready non-neutral record remains source evidence; drop only the request.
      if (!plan.neutral) { this.cancelRetirement(subject); return; }
      if (!request.eligible() || revision !== this.revisionToken || !plan.current()) {
        this.cancelRetirement(subject); return;
      }
      this.cancelRetirement(subject);
      this.retire(subject);
    });
  }
  dispose(): void {
    this.disposed = true;
    for (const subject of this.retirements.keys()) this.cancelRetirement(subject);
    this.revisionToken = {};
  }''')
s=s.replace('      finalize: () => { for (const part of parts) part.unit.finalize?.(); },','''      finalize: () => {
        const validate = () => {
          if (this.disposed || sourceRevision !== this.revisionToken || recipientRevision !== this.recipientRevision)
            throw new Error('Entity publication source changed before installation');
        };
        validate();
        for (const part of parts) part.unit.finalize?.();
        validate();
      },''')
s=s.replace('recipients:this.recipients.size,native:this.native?1:0','recipients:this.recipients.size,native:this.native?1:0,retirementRequests:this.retirements.size')
s=s.replace('retire(subject: number): void { this.native?.retire?.(subject); }','retire(subject: number): void { this.cancelRetirement(subject); this.native?.retire?.(subject); this.revisionToken = {}; }')
p.write_text(s)
p=r/'experimental-publication/entity.ts';s=p.read_text();s=s.replace('placementViews:placementViews.size,preparedFieldEdits:', 'placementViews:placementViews.size,mappings:mappings.size,mappingViews:mappingViews.size,preparedFieldEdits:')
s=s.replace('    retire(subject){fields.delete(subject);members.delete(subject);placements.delete(subject);views.delete(subject);visible.delete(subject);placementViews.delete(subject);retirements++;},','''    prepareRetirement(subject){
      // Snapshot only this exact subject. Missing entries contribute no evidence.
      const snapshots = [fields.get(subject), members.get(subject), placements.get(subject), views.get(subject), visible.get(subject), placementViews.get(subject), mappings.get(subject), mappingViews.get(subject)] as const;
      const requirements = new Set<Requirement>();
      for (const endpoint of snapshots[0]?.values() ?? []) requirements.add(endpoint.requirement as Requirement);
      if (snapshots[1]) requirements.add(snapshots[1].requirement);
      if (snapshots[2]) requirements.add(snapshots[2]);
      for (const view of snapshots[3]?.values() ?? []) requirements.add(view.requirement);
      if (snapshots[4]) requirements.add(snapshots[4].requirement);
      if (snapshots[5]) requirements.add(snapshots[5].requirement);
      if (snapshots[6]) requirements.add(snapshots[6]);
      if (snapshots[7]) requirements.add(snapshots[7].requirement);
      const ready = [...requirements].every(lifecycle.nativeRequirementReady);
      const neutral = ready && [...requirements].every(requirement => {
        const proof = lifecycle.nativeProof(requirement);
        return !proof.unknown && !proof.invalid && !proof.unavailableInput && !proof.terminalRejectedRoles &&
          proof.owners.length === 0 && (proof.destination?.length ?? 0) === 0 &&
          (proof.input?.length ?? 0) === 0 && (proof.validation?.length ?? 0) === 0 &&
          (proof.possible?.length ?? 0) === 0;
      });
      return { ready, neutral,
        current: () => snapshots[0] === fields.get(subject) && snapshots[1] === members.get(subject) &&
          snapshots[2] === placements.get(subject) && snapshots[3] === views.get(subject) &&
          snapshots[4] === visible.get(subject) && snapshots[5] === placementViews.get(subject) &&
          snapshots[6] === mappings.get(subject) && snapshots[7] === mappingViews.get(subject),
        onReady(callback){
          const releases = [...requirements].filter(requirement => !lifecycle.nativeRequirementReady(requirement))
            .map(requirement => lifecycle.onNativeRequirementReady(requirement, callback));
          return () => { for (const release of releases) release(); };
        },
      };
    },
    retire(subject){fields.delete(subject);members.delete(subject);placements.delete(subject);views.delete(subject);visible.delete(subject);placementViews.delete(subject);mappings.delete(subject);mappingViews.delete(subject);retirements++;},''')
p.write_text(s)
p=r/'entity-signal.ts';s=p.read_text();s=s.replace('    hasRestorationAuthority?: boolean;','    hasRestorationAuthority?: boolean;\n    onDispose?: (callback: () => void) => () => void;')
s=s.replace('  const entityPublication = new EntityPublicationSource();','  const entityPublication = new EntityPublicationSource();\n  options?.onDispose?.(() => entityPublication.dispose());')
s=s.replace('    if(forgetLifetime)entityPublication.retire(prepared.subjectId);','    // Shared installed-frame completion requests publication retirement.')
a=s.index('    publication.unit?.finalize?.();',s.index('  function commitAndProjectEntityMutationFrame('));b=s.index('    return {\n      ...result,',a)
s=s[:a]+'''    publication.unit?.finalize?.();
    let installed = false;
    let result: ReturnType<typeof frame.commit> | undefined;
    let failed = false;
    let firstError: unknown;
    const attempt = (body: () => void) => {
      try { body(); } catch (error) { if (!failed) { failed = true; firstError = error; } }
    };
    attempt(() => {
      result = frame.commit(
        observe ? () => observe(ordinaryPlan.changes) : undefined,
        responsibility, structuralFrontier, valueTransitions,
        () => {
          ordinaryPlan.install();
          if (publication.unit) installTerminalRecord(publication.unit.record);
          installed = true;
        }
      );
    });
    if (installed) {
      if (options?.advancePhysicalRevision !== false) physicalCommitClock?.advance();
      // All completions are attempted before retirement, even after one throws.
      attempt(() => { if (publication.unit) entityPublication.complete(publication.unit.completion); });
      attempt(() => { membershipTap?.(MEMBERSHIP_FACTS, frame.mutations); });
      // A missing lifetime is authority only because THIS frame installed its
      // authorized forget. No caller may infer eligibility from missing alone.
      for (const mutation of frame.mutations) {
        if (mutation.kind === 'retire-retained-value' && mutation.forgetLifetime) {
          const subject = mutation.subjectId;
          entityPublication.requestRetirement(subject, () =>
            resolveSubjectState(subject) === undefined && !ordinaryTopology.retains(subject));
        }
      }
      // The existing no-owner kernel gate still decides physical reclamation.
      // It must run for installed removals even if source completion threw.
      const removed = frame.mutations.filter(mutation => mutation.kind === 'tombstone-subject').map(mutation => mutation.subjectId);
      attempt(() => reclaimRetiredSubjectsWithoutOwner(removed));
    }
    if (failed) throw firstError;
    if (!result) throw new Error('Entity frame did not install');
''' + s[b:]
p.write_text(s)
# Root-scoped disposal, not process-wide retirement scanning.
p=r/'internals/materialize-markers.ts';s=p.read_text();s=s.replace('export interface MaterializationContext {','export interface MaterializationContext {\n  onDispose?: (callback: () => void) => () => void;\n  dispose?: () => void;')
s=s.replace('  const positionRegistry = createPositionRegistry();\n  return {','''  const positionRegistry = createPositionRegistry();
  const cleanup = new Set<() => void>();
  let disposed = false;
  return {
    onDispose(callback) {
      if (disposed) { callback(); return () => undefined; }
      cleanup.add(callback);
      return () => { cleanup.delete(callback); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const callback of cleanup) callback();
      cleanup.clear();
    },''')
p.write_text(s)
p=r/'markers/entity-map.ts';s=p.read_text().replace('          physicalCommitClock: context.physicalCommitClock,','          physicalCommitClock: context.physicalCommitClock,\n          onDispose: context.onDispose,');p.write_text(s)
p=r/'signal-tree.ts';s=p.read_text().replace('        terminateOwnerInvalidation(tree as object);','        terminateOwnerInvalidation(tree as object);\n        materializationContext.dispose?.();');p.write_text(s)
