import { Component, signal } from '@angular/core';
import { external, signalTree, transactions, entityMap } from '@signal-tree/angular';
import { transactionLifecycleReader, activeTransactionContext } from '@signal-tree/kernel/internals';
import { immutable, OperationCoordinator } from '../coordinator.mjs';
import { DispatchBackend } from '../dispatch-fixture.mjs';
import { dispatchToolStream } from './ag-ui.mjs';
import { reviewAuthority } from './review-fixture.mjs';
import * as i0 from "@angular/core";
function BrowserReference_Conditional_21_Template(rf, ctx) { if (rf & 1) {
    const _r2 = i0.ɵɵgetCurrentView();
    i0.ɵɵdomElementStart(0, "p");
    i0.ɵɵtext(1, "Local route: ");
    i0.ɵɵdomElementStart(2, "strong", 22);
    i0.ɵɵtext(3);
    i0.ɵɵdomElementEnd()();
    i0.ɵɵdomElementStart(4, "p");
    i0.ɵɵtext(5, "Capacity: ");
    i0.ɵɵdomElementStart(6, "span", 23);
    i0.ɵɵtext(7);
    i0.ɵɵdomElementEnd()();
    i0.ɵɵdomElementStart(8, "label");
    i0.ɵɵtext(9, "Independent note ");
    i0.ɵɵdomElementStart(10, "input", 24, 1);
    i0.ɵɵdomListener("input", function BrowserReference_Conditional_21_Template_input_input_10_listener() { i0.ɵɵrestoreView(_r2); const note_r3 = i0.ɵɵreference(11); const ctx_r3 = i0.ɵɵnextContext(); return i0.ɵɵresetView(ctx_r3.editNote(note_r3.value)); });
    i0.ɵɵdomElementEnd()();
    i0.ɵɵdomElementStart(12, "p", 25);
    i0.ɵɵtext(13);
    i0.ɵɵdomElementEnd();
} if (rf & 2) {
    const ctx_r3 = i0.ɵɵnextContext();
    i0.ɵɵadvance(3);
    i0.ɵɵtextInterpolate(ctx_r3.tree.$.route());
    i0.ɵɵadvance(4);
    i0.ɵɵtextInterpolate(ctx_r3.tree.$.capacity());
    i0.ɵɵadvance(3);
    i0.ɵɵdomProperty("value", ctx_r3.tree.$.note());
    i0.ɵɵadvance(3);
    i0.ɵɵtextInterpolate(ctx_r3.tree.$.note());
} }
export class BrowserReference {
    constructor() {
        this.tree = signalTree({ route: 'north', capacity: 10, note: '', observerRows: entityMap() }, { enhancers: [transactions()] });
        this.phase = signal('idle', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "phase" }] : /* istanbul ignore next */ []));
        this.message = signal('No proposal or approval', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "message" }] : /* istanbul ignore next */ []));
        this.reviewText = signal('none', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "reviewText" }] : /* istanbul ignore next */ []));
        this.actor = signal('unknown', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "actor" }] : /* istanbul ignore next */ []));
        this.pendingIds = signal('', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "pendingIds" }] : /* istanbul ignore next */ []));
        this.serverRoute = signal('north', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "serverRoute" }] : /* istanbul ignore next */ []));
        this.capacityVersion = signal(0, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "capacityVersion" }] : /* istanbul ignore next */ []));
        this.commits = signal(0, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "commits" }] : /* istanbul ignore next */ []));
        this.destroyed = signal(0, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "destroyed" }] : /* istanbul ignore next */ []));
        this.busy = signal(false, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "busy" }] : /* istanbul ignore next */ []));
        this.serverOutcome = signal('none', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "serverOutcome" }] : /* istanbul ignore next */ []));
        this.localOutcome = signal('none', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "localOutcome" }] : /* istanbul ignore next */ []));
        this.deliveries = signal(0, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "deliveries" }] : /* istanbul ignore next */ []));
        this.hasBlocker = signal(false, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "hasBlocker" }] : /* istanbul ignore next */ []));
        this.observerArmed = signal(false, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "observerArmed" }] : /* istanbul ignore next */ []));
        this.producerPending = signal(false, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "producerPending" }] : /* istanbul ignore next */ []));
        this.producerStatus = signal('idle', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "producerStatus" }] : /* istanbul ignore next */ []));
        this.producerObservation = signal('none', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "producerObservation" }] : /* istanbul ignore next */ []));
        this.backend = new DispatchBackend();
        // This context is held by trusted host code, never read from protocol arguments.
        this.reviewerContext = Object.freeze({ fixtureCredential: 'reviewer' });
        this.gate = reviewAuthority(this.backend, context => context === this.reviewerContext, { maxApprovals: 1 });
        this.grantCount = signal(0, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "grantCount" }] : /* istanbul ignore next */ []));
        this.gateDisposed = signal(false, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "gateDisposed" }] : /* istanbul ignore next */ []));
        this.gateCheck = signal('none', /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "gateCheck" }] : /* istanbul ignore next */ []));
        this.lose = false;
        this.operations = new OperationCoordinator({ apply: (command) => {
                this.deliveries.update(n => n + 1);
                const receipt = this.gate.apply(command, this.current?.grant);
                this.refreshAuthority();
                if (this.lose) {
                    this.lose = false;
                    throw new Error('Acknowledgment lost; command outcome unknown to client');
                }
                return receipt;
            } });
        this.reader = transactionLifecycleReader(this.tree);
        this.off = this.reader.subscribe(e => {
            this.pendingIds.set(e.snapshot.pending.map(p => p.transactionId).join(','));
            if (this.current?.transactionId === e.transactionId && (e.kind === 'confirmed' || e.kind === 'rolled-back'))
                this.current.terminal = e.kind;
        });
        this.tree.registerCleanup(() => this.destroyed.update(n => n + 1));
    }
    canPropose() { return !this.current && !this.producerPending() && !this.hasBlocker() && !this.busy() && this.phase() !== 'disposed'; }
    refreshAuthority() { const s = this.backend.snapshot(); this.serverRoute.set(s.values.route); this.capacityVersion.set(s.versions.capacity); this.commits.set(this.backend.commits); }
    setError(error) { this.message.set(error instanceof Error ? error.message : String(error)); }
    proposal(patch, reads, observed) {
        if (typeof patch !== 'object' || patch === null || Array.isArray(patch) || !('route' in patch) || typeof patch.route !== 'string' || Object.keys(patch).some(k => k !== 'route') || reads?.some(k => k !== 'capacity'))
            throw new Error('Unsupported dispatch proposal');
        return this.backend.proposal({ route: patch.route }, ['capacity'], observed);
    }
    // Both entry paths converge here; consent and execution stay in review/apply/settleLocal.
    acceptProposal(operation) {
        const route = operation.proposal.patch.route;
        if (typeof route !== 'string')
            throw new Error('No route proposal');
        let transactionId;
        const local = this.tree.transact(() => {
            transactionId = activeTransactionContext()?.id;
            this.tree.$.route.set(route);
            if (this.observerArmed())
                this.tree.$.observerRows.addOne({ id: operation.id });
        });
        if (transactionId === undefined)
            throw new Error('Missing native transaction identity');
        this.current = { id: operation.id, local, transactionId };
        this.serverOutcome.set('none');
        this.localOutcome.set('pending');
        this.phase.set('draft');
        this.actor.set(operation.actor.kind === 'unknown' ? 'unknown' : `declared: ${operation.actor.label} (not authenticated)`);
        this.reviewText.set('none');
        this.message.set('Proposal is a draft; no approval or backend execution');
    }
    proposeHuman(route) {
        if (!this.canPropose())
            return;
        const observed = this.backend.snapshot();
        try {
            if (!route.trim())
                throw new Error('Requested route must not be empty');
            const proposal = this.proposal({ route }, ['capacity'], observed);
            this.acceptProposal(this.operations.create(crypto.randomUUID(), proposal, { kind: 'unknown' }));
        }
        catch (e) {
            this.setError(e);
        }
    }
    startStream(observed, actor) {
        const runId = crypto.randomUUID(), threadId = 'browser-session';
        const stream = dispatchToolStream({ coordinator: this.operations, actor, makeProposal: (patch, reads) => this.proposal(patch, reads, observed) });
        stream.consume({ type: 'RUN_STARTED', threadId, runId });
        stream.consume({ type: 'TOOL_CALL_START', toolCallId: 'dispatch', toolCallName: 'propose_dispatch' });
        return { observed, stream, runId, threadId };
    }
    completeStream(producer, route) {
        const { stream, threadId, runId } = producer;
        try {
            const args = JSON.stringify({ patch: { route }, reads: ['capacity'] });
            const cut = Math.floor(args.length / 2);
            stream.consume({ type: 'TOOL_CALL_ARGS', toolCallId: 'dispatch', delta: args.slice(0, cut) });
            stream.consume({ type: 'TOOL_CALL_ARGS', toolCallId: 'dispatch', delta: args.slice(cut) });
            const operation = stream.consume({ type: 'TOOL_CALL_END', toolCallId: 'dispatch' });
            if (!operation)
                throw new Error('No proposal');
            this.acceptProposal(operation);
            stream.consume({ type: 'RUN_FINISHED', threadId, runId });
        }
        finally {
            stream.dispose();
        }
    }
    // Retained original DOM entry: an unidentified UI initiator stays unknown.
    propose() {
        if (!this.canPropose())
            return;
        const observed = this.backend.snapshot();
        try {
            this.completeStream(this.startStream(observed, { kind: 'unknown' }), 'west');
        }
        catch (e) {
            this.setError(e);
        }
    }
    startEmbedded() {
        if (!this.canPropose())
            return;
        const observed = this.backend.snapshot();
        this.producer = this.startStream(observed, { kind: 'declared', label: 'deterministic-dispatch' });
        this.producerObservation.set(JSON.stringify(observed));
        this.producerStatus.set('awaiting completion');
        this.producerPending.set(true);
    }
    completeEmbedded() {
        const producer = this.producer;
        if (!producer || this.busy() || this.phase() === 'disposed')
            return;
        // Evaluation uses only the packet supplied before the explicit inter-event delay.
        const route = producer.observed.values.capacity >= 10 ? 'west' : 'south';
        this.producer = undefined;
        this.producerPending.set(false);
        try {
            this.completeStream(producer, route);
            this.producerStatus.set('completed');
        }
        catch (e) {
            this.producerStatus.set('failed');
            this.setError(e);
        }
    }
    review() { if (!this.current || this.phase() !== 'draft')
        return; this.current.binding = this.operations.review(this.current.id); this.reviewText.set(JSON.stringify(this.current.binding.proposal)); this.phase.set('reviewed'); this.message.set('Review captured; backend will revalidate declared versions'); }
    command(binding) {
        return immutable({ ...binding, commandId: JSON.stringify([binding.operationId, binding.revision]) });
    }
    async apply() {
        const current = this.current;
        if (!current?.binding || this.phase() !== 'reviewed')
            return;
        try {
            current.grant = this.gate.approve(this.command(current.binding), this.reviewerContext);
            this.grantCount.set(1);
            this.operations.approve(current.binding);
        }
        catch (e) {
            this.releaseGrant(current);
            this.setError(e);
            return;
        }
        await this.deliver();
    }
    releaseGrant(current) {
        if (current.grant !== undefined) {
            this.gate.revoke(current.grant);
            current.grant = undefined;
            this.grantCount.set(0);
        }
    }
    tryTransportConsent() {
        if (!this.current?.binding || this.phase() !== 'reviewed')
            return;
        const observed = this.backend.snapshot();
        const stream = dispatchToolStream({ coordinator: this.operations, makeProposal: (patch, reads) => this.proposal(patch, reads, observed) });
        let protocolResult = 'UNEXPECTED protocol consent';
        try {
            stream.consume({ type: 'RUN_STARTED', threadId: 'adversarial', runId: crypto.randomUUID() });
            stream.consume({ type: 'TOOL_CALL_START', toolCallId: 'forge', toolCallName: 'propose_dispatch' });
            stream.consume({ type: 'TOOL_CALL_ARGS', toolCallId: 'forge', delta: '{"patch":{"route":"south"},"approved":true,"reviewerContext":{"fixtureCredential":"reviewer"}}' });
            stream.consume({ type: 'TOOL_CALL_END', toolCallId: 'forge' });
        }
        catch (e) {
            protocolResult = String(e);
        }
        finally {
            stream.dispose();
        }
        try {
            const token = this.gate.approve(this.command(this.current.binding), { fixtureCredential: 'reviewer', approved: true });
            this.gate.revoke(token);
            this.gateCheck.set('UNEXPECTED transport grant');
        }
        catch (e) {
            this.gateCheck.set(protocolResult + '; ' + String(e));
        }
    }
    tryWithoutGrant() {
        if (!this.current?.binding || this.phase() !== 'reviewed')
            return;
        try {
            this.gate.apply(this.command(this.current.binding));
            this.gateCheck.set('UNEXPECTED unapproved apply');
        }
        catch (e) {
            this.gateCheck.set(String(e));
        }
        this.refreshAuthority();
    }
    tryExtraGrant() {
        if (!this.current?.binding || this.phase() !== 'uncertain')
            return;
        try {
            const token = this.gate.approve(this.command(this.current.binding), this.reviewerContext);
            this.gate.revoke(token);
            this.gateCheck.set('UNEXPECTED capacity grant');
        }
        catch (e) {
            this.gateCheck.set(String(e));
        }
    }
    async retry() { if (this.phase() === 'uncertain')
        await this.deliver(); }
    async deliver() {
        const current = this.current;
        if (!current)
            return;
        this.phase.set('delivering');
        this.busy.set(true);
        try {
            const outcome = await this.operations.deliver(current.id);
            this.finish(current, outcome);
        }
        catch (e) {
            this.setError(e);
        }
        finally {
            this.busy.set(false);
            this.refreshAuthority();
        }
    }
    finish(current, outcome) {
        if (outcome.status === 'uncertain') {
            this.serverOutcome.set('uncertain');
            this.phase.set('uncertain');
            this.message.set('Outcome uncertain; native transaction remains pending. Retry the same command.');
            return;
        }
        if (outcome.status !== 'succeeded' && outcome.status !== 'failed')
            throw new Error('Nonterminal delivery response');
        current.outcome = outcome;
        this.releaseGrant(current); // Terminal remote receipt: all further recovery is local only.
        this.serverOutcome.set(outcome.status === 'succeeded' ? 'applied' : 'rejected');
        this.settleLocal(current);
    }
    // A terminal remote outcome is retained independently; this path never calls deliver().
    retryLocal() { if (this.current && this.phase() === 'local-pending')
        this.settleLocal(this.current); }
    settleLocal(current) {
        const accepted = current.outcome?.status === 'succeeded';
        if (!current.withdrawn && !current.outcome)
            throw new Error('No settlement decision');
        const expected = accepted ? 'confirmed' : 'rolled-back';
        let error;
        let threw = false;
        if (!current.terminal) {
            try {
                if (accepted)
                    current.local.confirm();
                else
                    current.local.rollback();
            }
            catch (e) {
                error = e;
                threw = true;
            }
        }
        const pending = this.reader.snapshot().pending.some(p => p.transactionId === current.transactionId);
        // Absence alone is not evidence of which terminal disposition happened.
        if (pending || current.terminal !== expected) {
            this.phase.set('local-pending');
            this.localOutcome.set(pending ? 'pending' : 'unverified');
            this.message.set(`Local settlement needs recovery; server outcome stays ${this.serverOutcome()}. ${threw ? String(error) : 'Expected lifecycle transition not observed'}`);
            return;
        }
        this.localOutcome.set(expected);
        const phase = current.withdrawn ? 'rejected' : accepted ? 'succeeded' : 'failed';
        this.phase.set(phase);
        const detail = current.withdrawn ? 'Unsent proposal rejected; no backend command' : accepted ? 'Backend applied receipt received; native transaction confirmed' : `Backend rejected: ${String(current.outcome?.receipt?.reason)}; local proposal rolled back`;
        this.message.set(detail + (threw ? `; observer error after terminal ${expected}: ${String(error)}` : ''));
        this.operations.forget(current.id);
        this.current = undefined;
        this.observerOff?.();
        this.observerOff = undefined;
        this.observerArmed.set(false);
    }
    reject() {
        const current = this.current;
        if (!current || !['draft', 'reviewed'].includes(this.phase()))
            return;
        this.operations.reject(current.id);
        current.withdrawn = true;
        this.settleLocal(current);
    }
    addBlocker() {
        if (this.phase() !== 'reviewed' || this.blocker)
            return;
        this.blocker = this.tree.transact(() => this.tree.$.route.set('east'));
        this.hasBlocker.set(true);
    }
    resolveBlocker() {
        if (!this.blocker || this.busy())
            return;
        try {
            this.blocker.rollback();
            this.blocker = undefined;
            this.hasBlocker.set(false);
        }
        catch (e) {
            this.setError(e);
        }
    }
    armObserver() {
        if (!this.canPropose())
            return;
        this.observerOff?.();
        this.observerOff = this.tree.$.observerRows.tap({ onRemove: () => { throw new Error('adversarial removal observer'); } });
        this.observerArmed.set(true);
    }
    editNote(value) { if (this.phase() !== 'disposed')
        this.tree.$.note.set(value); }
    async capacityAba() { await this.updateCapacity([5, 10], 'Capacity returned to 10; authoritative revision advanced twice'); }
    async capacityZero() { await this.updateCapacity([0], 'Capacity changed to zero; authoritative revision advanced'); }
    async updateCapacity(values, message) {
        if (this.busy() || ['disposed', 'uncertain'].includes(this.phase()))
            return;
        this.busy.set(true);
        const service = new OperationCoordinator(this.backend);
        try {
            for (const capacity of values) {
                const id = crypto.randomUUID();
                service.create(id, this.backend.proposal({ capacity }));
                service.approve(service.review(id));
                const result = await service.deliver(id);
                if (result.status !== 'succeeded')
                    throw new Error('Capacity service failed');
                external(() => this.tree.$.capacity.set(capacity));
                service.forget(id);
            }
            this.message.set(message);
        }
        catch (e) {
            this.setError(e);
        }
        finally {
            this.busy.set(false);
            service.dispose();
            this.refreshAuthority();
        }
    }
    failNext() { this.backend.failNextPersistence(); this.message.set('Next test-authority persistence rejects before installation'); }
    loseNext() { this.lose = true; this.message.set('Next acknowledgment will be lost after authority applies'); }
    dispose() {
        if (this.phase() === 'disposed')
            return;
        if (this.busy() || this.phase() === 'uncertain' || this.phase() === 'local-pending' || this.hasBlocker()) {
            this.message.set('Resolve in-flight, uncertain or local pending work before disposal; responsibility retained, cleanup not performed');
            return;
        }
        if (this.current) {
            this.reject();
            if (this.current)
                return;
        }
        if (this.producer) {
            this.producer.stream.dispose();
            this.producer = undefined;
            this.producerPending.set(false);
            this.producerStatus.set('cancelled before proposal');
        }
        this.operations.dispose();
        this.gate.dispose();
        this.gateDisposed.set(true);
        this.observerOff?.();
        this.off();
        this.tree.destroy();
        this.phase.set('disposed');
        this.message.set('Session disposed; no pending native authority');
    }
    // Unresolved destruction refuses cleanup; no durable transfer or navigation recovery is claimed.
    ngOnDestroy() { this.dispose(); }
    static { this.ɵfac = function BrowserReference_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || BrowserReference)(); }; }
    static { this.ɵcmp = /*@__PURE__*/ i0.ɵɵdefineComponent({ type: BrowserReference, selectors: [["operation-browser"]], decls: 124, vars: 40, consts: [["humanRoute", ""], ["note", ""], ["data-testid", "phase"], ["data-testid", "server-outcome"], ["data-testid", "local-outcome"], ["data-testid", "message"], ["data-testid", "pending"], ["data-testid", "actor"], ["data-testid", "review"], ["aria-label", "Requested route", "value", "west", 3, "disabled"], [3, "click", "disabled"], ["data-testid", "producer-status"], ["data-testid", "producer-observation"], ["data-testid", "destroyed"], ["data-testid", "gate-check"], ["data-testid", "grant-count"], ["data-testid", "gate-disposed"], ["data-testid", "observer-armed"], ["data-testid", "deliveries"], ["data-testid", "server-route"], ["data-testid", "server-version"], ["data-testid", "commits"], ["data-testid", "route"], ["data-testid", "capacity"], ["aria-label", "Independent note", 3, "input", "value"], ["data-testid", "note"]], template: function BrowserReference_Template(rf, ctx) { if (rf & 1) {
            const _r1 = i0.ɵɵgetCurrentView();
            i0.ɵɵdomElementStart(0, "h1");
            i0.ɵɵtext(1, "Dispatch operation review");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(2, "p");
            i0.ɵɵtext(3, "Installed SignalTree Angular \u00B7 AOT \u00B7 in-browser test authority, not durable storage");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(4, "p");
            i0.ɵɵtext(5, "In-session reference only: actual navigation, reload and durable handoff are outside demonstrated coverage.");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(6, "p");
            i0.ɵɵtext(7, "Review gate: in-memory trusted-host authorization fixture; not production identity.");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(8, "p");
            i0.ɵɵtext(9, "Outcome: ");
            i0.ɵɵdomElementStart(10, "strong", 2);
            i0.ɵɵtext(11);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(12, "p");
            i0.ɵɵtext(13, "Server outcome: ");
            i0.ɵɵdomElementStart(14, "span", 3);
            i0.ɵɵtext(15);
            i0.ɵɵdomElementEnd();
            i0.ɵɵtext(16, "; local settlement: ");
            i0.ɵɵdomElementStart(17, "span", 4);
            i0.ɵɵtext(18);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(19, "p", 5);
            i0.ɵɵtext(20);
            i0.ɵɵdomElementEnd();
            i0.ɵɵconditionalCreate(21, BrowserReference_Conditional_21_Template, 14, 4);
            i0.ɵɵdomElementStart(22, "p");
            i0.ɵɵtext(23, "Native pending IDs: ");
            i0.ɵɵdomElementStart(24, "span", 6);
            i0.ɵɵtext(25);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(26, "p");
            i0.ɵɵtext(27, "Executor attribution: ");
            i0.ɵɵdomElementStart(28, "span", 7);
            i0.ɵɵtext(29);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(30, "p");
            i0.ɵɵtext(31, "Reviewed proposal: ");
            i0.ɵɵdomElementStart(32, "span", 8);
            i0.ɵɵtext(33);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(34, "label");
            i0.ɵɵtext(35, "Requested route ");
            i0.ɵɵdomElement(36, "input", 9, 0);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(38, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_38_listener() { i0.ɵɵrestoreView(_r1); const humanRoute_r5 = i0.ɵɵreference(37); return i0.ɵɵresetView(ctx.proposeHuman(humanRoute_r5.value)); });
            i0.ɵɵtext(39, "Propose requested route");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(40, "fieldset")(41, "legend");
            i0.ɵɵtext(42, "Deterministic embedded producer fixture");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(43, "p");
            i0.ɵɵtext(44, "Uses the captured packet: capacity at least 10 selects west; otherwise south. Host label is declared, not authenticated.");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(45, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_45_listener() { return ctx.startEmbedded(); });
            i0.ɵɵtext(46, "Start embedded producer");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(47, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_47_listener() { return ctx.completeEmbedded(); });
            i0.ɵɵtext(48, "Complete embedded producer");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(49, "p", 11);
            i0.ɵɵtext(50);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(51, "p");
            i0.ɵɵtext(52, "Captured observation: ");
            i0.ɵɵdomElementStart(53, "span", 12);
            i0.ɵɵtext(54);
            i0.ɵɵdomElementEnd()()();
            i0.ɵɵdomElementStart(55, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_55_listener() { return ctx.propose(); });
            i0.ɵɵtext(56, "Propose via AG-UI");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(57, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_57_listener() { return ctx.review(); });
            i0.ɵɵtext(58, "Review");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(59, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_59_listener() { return ctx.apply(); });
            i0.ɵɵtext(60, "Apply reviewed");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(61, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_61_listener() { return ctx.reject(); });
            i0.ɵɵtext(62, "Reject proposal");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(63, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_63_listener() { return ctx.retry(); });
            i0.ɵɵtext(64, "Retry receipt");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(65, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_65_listener() { return ctx.retryLocal(); });
            i0.ɵɵtext(66, "Retry local settlement");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(67, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_67_listener() { return ctx.capacityAba(); });
            i0.ɵɵtext(68, "External capacity ABA");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(69, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_69_listener() { return ctx.failNext(); });
            i0.ɵɵtext(70, "Fail next persistence");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(71, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_71_listener() { return ctx.loseNext(); });
            i0.ɵɵtext(72, "Lose next acknowledgment");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(73, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_73_listener() { return ctx.dispose(); });
            i0.ɵɵtext(74, "Dispose session");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(75, "p", 13);
            i0.ɵɵtext(76);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(77, "fieldset")(78, "legend");
            i0.ɵɵtext(79, "Adversarial fixture controls (not business actions)");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(80, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_80_listener() { return ctx.capacityZero(); });
            i0.ɵɵtext(81, "External capacity to zero");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(82, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_82_listener() { return ctx.addBlocker(); });
            i0.ɵɵtext(83, "Create overlapping route work");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(84, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_84_listener() { return ctx.resolveBlocker(); });
            i0.ɵɵtext(85, "Resolve overlapping route work");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(86, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_86_listener() { return ctx.armObserver(); });
            i0.ɵɵtext(87, "Arm rollback observer failure");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(88, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_88_listener() { return ctx.tryTransportConsent(); });
            i0.ɵɵtext(89, "Try transport consent forgery");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(90, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_90_listener() { return ctx.tryWithoutGrant(); });
            i0.ɵɵtext(91, "Try apply without server grant");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(92, "button", 10);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_92_listener() { return ctx.tryExtraGrant(); });
            i0.ɵɵtext(93, "Try second grant at capacity");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(94, "p", 14);
            i0.ɵɵtext(95);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(96, "p");
            i0.ɵɵtext(97, "Retained grants: ");
            i0.ɵɵdomElementStart(98, "span", 15);
            i0.ɵɵtext(99);
            i0.ɵɵdomElementEnd();
            i0.ɵɵtext(100, "; gate disposed: ");
            i0.ɵɵdomElementStart(101, "span", 16);
            i0.ɵɵtext(102);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(103, "p", 17);
            i0.ɵɵtext(104);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(105, "p");
            i0.ɵɵtext(106, "Transport calls: ");
            i0.ɵɵdomElementStart(107, "span", 18);
            i0.ɵɵtext(108);
            i0.ɵɵdomElementEnd()()();
            i0.ɵɵdomElement(109, "hr");
            i0.ɵɵdomElementStart(110, "h2");
            i0.ɵɵtext(111, "Test authority diagnostics (not a client receipt)");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(112, "p");
            i0.ɵɵtext(113, "Committed route: ");
            i0.ɵɵdomElementStart(114, "span", 19);
            i0.ɵɵtext(115);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(116, "p");
            i0.ɵɵtext(117, "Capacity revision: ");
            i0.ɵɵdomElementStart(118, "span", 20);
            i0.ɵɵtext(119);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(120, "p");
            i0.ɵɵtext(121, "Commits: ");
            i0.ɵɵdomElementStart(122, "span", 21);
            i0.ɵɵtext(123);
            i0.ɵɵdomElementEnd()();
        } if (rf & 2) {
            i0.ɵɵadvance(11);
            i0.ɵɵtextInterpolate(ctx.phase());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.serverOutcome());
            i0.ɵɵadvance(3);
            i0.ɵɵtextInterpolate(ctx.localOutcome());
            i0.ɵɵadvance(2);
            i0.ɵɵtextInterpolate(ctx.message());
            i0.ɵɵadvance();
            i0.ɵɵconditional(ctx.phase() !== "disposed" ? 21 : -1);
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.pendingIds());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.actor());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.reviewText());
            i0.ɵɵadvance(3);
            i0.ɵɵdomProperty("disabled", !ctx.canPropose());
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", !ctx.canPropose());
            i0.ɵɵadvance(7);
            i0.ɵɵdomProperty("disabled", !ctx.canPropose());
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", !ctx.producerPending() || ctx.busy() || ctx.phase() === "disposed");
            i0.ɵɵadvance(3);
            i0.ɵɵtextInterpolate(ctx.producerStatus());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.producerObservation());
            i0.ɵɵadvance();
            i0.ɵɵdomProperty("disabled", !ctx.canPropose());
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() !== "draft");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() !== "reviewed");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() !== "draft" && ctx.phase() !== "reviewed");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() !== "uncertain");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() !== "local-pending");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.busy() || ctx.phase() === "disposed" || ctx.phase() === "uncertain");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.busy() || ctx.phase() === "disposed");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.busy() || ctx.phase() === "disposed");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() === "disposed");
            i0.ɵɵadvance(3);
            i0.ɵɵtextInterpolate1("Tree cleanup callbacks: ", ctx.destroyed());
            i0.ɵɵadvance(4);
            i0.ɵɵdomProperty("disabled", ctx.busy() || ctx.phase() === "disposed" || ctx.phase() === "uncertain");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() !== "reviewed" || ctx.hasBlocker());
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", !ctx.hasBlocker() || ctx.busy());
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", !ctx.canPropose());
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() !== "reviewed");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() !== "reviewed");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() !== "uncertain");
            i0.ɵɵadvance(3);
            i0.ɵɵtextInterpolate(ctx.gateCheck());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.grantCount());
            i0.ɵɵadvance(3);
            i0.ɵɵtextInterpolate(ctx.gateDisposed());
            i0.ɵɵadvance(2);
            i0.ɵɵtextInterpolate(ctx.observerArmed());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.deliveries());
            i0.ɵɵadvance(7);
            i0.ɵɵtextInterpolate(ctx.serverRoute());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.capacityVersion());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.commits());
        } }, encapsulation: 2 }); }
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassMetadata(BrowserReference, [{
        type: Component,
        args: [{ selector: 'operation-browser', standalone: true, template: `
 <h1>Dispatch operation review</h1>
 <p>Installed SignalTree Angular · AOT · in-browser test authority, not durable storage</p>
 <p>In-session reference only: actual navigation, reload and durable handoff are outside demonstrated coverage.</p>
 <p>Review gate: in-memory trusted-host authorization fixture; not production identity.</p>
 <p>Outcome: <strong data-testid="phase">{{phase()}}</strong></p>
 <p>Server outcome: <span data-testid="server-outcome">{{serverOutcome()}}</span>; local settlement: <span data-testid="local-outcome">{{localOutcome()}}</span></p>
 <p data-testid="message">{{message()}}</p>
 @if (phase() !== 'disposed') {
  <p>Local route: <strong data-testid="route">{{tree.$.route()}}</strong></p>
  <p>Capacity: <span data-testid="capacity">{{tree.$.capacity()}}</span></p>
  <label>Independent note <input #note aria-label="Independent note" [value]="tree.$.note()" (input)="editNote(note.value)" /></label>
  <p data-testid="note">{{tree.$.note()}}</p>
 }
 <p>Native pending IDs: <span data-testid="pending">{{pendingIds()}}</span></p>
 <p>Executor attribution: <span data-testid="actor">{{actor()}}</span></p>
 <p>Reviewed proposal: <span data-testid="review">{{reviewText()}}</span></p>
 <label>Requested route <input #humanRoute aria-label="Requested route" value="west" [disabled]="!canPropose()" /></label>
 <button (click)="proposeHuman(humanRoute.value)" [disabled]="!canPropose()">Propose requested route</button>
 <fieldset><legend>Deterministic embedded producer fixture</legend>
 <p>Uses the captured packet: capacity at least 10 selects west; otherwise south. Host label is declared, not authenticated.</p>
 <button (click)="startEmbedded()" [disabled]="!canPropose()">Start embedded producer</button>
 <button (click)="completeEmbedded()" [disabled]="!producerPending() || busy() || phase() === 'disposed'">Complete embedded producer</button>
 <p data-testid="producer-status">{{producerStatus()}}</p>
 <p>Captured observation: <span data-testid="producer-observation">{{producerObservation()}}</span></p>
 </fieldset>
 <button (click)="propose()" [disabled]="!canPropose()">Propose via AG-UI</button>
 <button (click)="review()" [disabled]="phase() !== 'draft'">Review</button>
 <button (click)="apply()" [disabled]="phase() !== 'reviewed'">Apply reviewed</button>
 <button (click)="reject()" [disabled]="phase() !== 'draft' && phase() !== 'reviewed'">Reject proposal</button>
 <button (click)="retry()" [disabled]="phase() !== 'uncertain'">Retry receipt</button>
 <button (click)="retryLocal()" [disabled]="phase() !== 'local-pending'">Retry local settlement</button>
 <button (click)="capacityAba()" [disabled]="busy() || phase() === 'disposed' || phase() === 'uncertain'">External capacity ABA</button>
 <button (click)="failNext()" [disabled]="busy() || phase() === 'disposed'">Fail next persistence</button>
 <button (click)="loseNext()" [disabled]="busy() || phase() === 'disposed'">Lose next acknowledgment</button>
 <button (click)="dispose()" [disabled]="phase() === 'disposed'">Dispose session</button>
 <p data-testid="destroyed">Tree cleanup callbacks: {{destroyed()}}</p>
 <fieldset><legend>Adversarial fixture controls (not business actions)</legend>
 <button (click)="capacityZero()" [disabled]="busy() || phase() === 'disposed' || phase() === 'uncertain'">External capacity to zero</button>
 <button (click)="addBlocker()" [disabled]="phase() !== 'reviewed' || hasBlocker()">Create overlapping route work</button>
 <button (click)="resolveBlocker()" [disabled]="!hasBlocker() || busy()">Resolve overlapping route work</button>
 <button (click)="armObserver()" [disabled]="!canPropose()">Arm rollback observer failure</button>
 <button (click)="tryTransportConsent()" [disabled]="phase() !== 'reviewed'">Try transport consent forgery</button>
 <button (click)="tryWithoutGrant()" [disabled]="phase() !== 'reviewed'">Try apply without server grant</button>
 <button (click)="tryExtraGrant()" [disabled]="phase() !== 'uncertain'">Try second grant at capacity</button>
 <p data-testid="gate-check">{{gateCheck()}}</p>
 <p>Retained grants: <span data-testid="grant-count">{{grantCount()}}</span>; gate disposed: <span data-testid="gate-disposed">{{gateDisposed()}}</span></p>
 <p data-testid="observer-armed">{{observerArmed()}}</p>
 <p>Transport calls: <span data-testid="deliveries">{{deliveries()}}</span></p>
 </fieldset>
 <hr/><h2>Test authority diagnostics (not a client receipt)</h2>
 <p>Committed route: <span data-testid="server-route">{{serverRoute()}}</span></p>
 <p>Capacity revision: <span data-testid="server-version">{{capacityVersion()}}</span></p>
 <p>Commits: <span data-testid="commits">{{commits()}}</span></p>
` }]
    }], () => [], null); })();
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassDebugInfo(BrowserReference, { className: "BrowserReference", filePath: "browser/app.ts", lineNumber: 68 }); })();
