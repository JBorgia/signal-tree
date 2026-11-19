import { Component, signal } from '@angular/core';
import { external, signalTree, transactions, entityMap } from '@signal-tree/angular';
import { transactionLifecycleReader, activeTransactionContext } from '@signal-tree/kernel/internals';
import { OperationCoordinator } from '../coordinator.mjs';
import { DispatchBackend } from '../dispatch-fixture.mjs';
import { dispatchToolStream } from './ag-ui.mjs';
import * as i0 from "@angular/core";
function BrowserReference_Conditional_17_Template(rf, ctx) { if (rf & 1) {
    const _r1 = i0.ɵɵgetCurrentView();
    i0.ɵɵdomElementStart(0, "p");
    i0.ɵɵtext(1, "Local route: ");
    i0.ɵɵdomElementStart(2, "strong", 15);
    i0.ɵɵtext(3);
    i0.ɵɵdomElementEnd()();
    i0.ɵɵdomElementStart(4, "p");
    i0.ɵɵtext(5, "Capacity: ");
    i0.ɵɵdomElementStart(6, "span", 16);
    i0.ɵɵtext(7);
    i0.ɵɵdomElementEnd()();
    i0.ɵɵdomElementStart(8, "label");
    i0.ɵɵtext(9, "Independent note ");
    i0.ɵɵdomElementStart(10, "input", 17, 0);
    i0.ɵɵdomListener("input", function BrowserReference_Conditional_17_Template_input_input_10_listener() { i0.ɵɵrestoreView(_r1); const note_r2 = i0.ɵɵreference(11); const ctx_r2 = i0.ɵɵnextContext(); return i0.ɵɵresetView(ctx_r2.editNote(note_r2.value)); });
    i0.ɵɵdomElementEnd()();
    i0.ɵɵdomElementStart(12, "p", 18);
    i0.ɵɵtext(13);
    i0.ɵɵdomElementEnd();
} if (rf & 2) {
    const ctx_r2 = i0.ɵɵnextContext();
    i0.ɵɵadvance(3);
    i0.ɵɵtextInterpolate(ctx_r2.tree.$.route());
    i0.ɵɵadvance(4);
    i0.ɵɵtextInterpolate(ctx_r2.tree.$.capacity());
    i0.ɵɵadvance(3);
    i0.ɵɵdomProperty("value", ctx_r2.tree.$.note());
    i0.ɵɵadvance(3);
    i0.ɵɵtextInterpolate(ctx_r2.tree.$.note());
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
        this.backend = new DispatchBackend();
        this.lose = false;
        this.operations = new OperationCoordinator({ apply: (command) => {
                this.deliveries.update(n => n + 1);
                const receipt = this.backend.apply(command);
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
    canPropose() { return !this.current && !this.hasBlocker() && !this.busy() && this.phase() !== 'disposed'; }
    refreshAuthority() { const s = this.backend.snapshot(); this.serverRoute.set(s.values.route); this.capacityVersion.set(s.versions.capacity); this.commits.set(this.backend.commits); }
    setError(error) { this.message.set(error instanceof Error ? error.message : String(error)); }
    proposal(patch, reads, observed) {
        if (typeof patch !== 'object' || patch === null || Array.isArray(patch) || !('route' in patch) || typeof patch.route !== 'string' || Object.keys(patch).some(k => k !== 'route') || reads?.some(k => k !== 'capacity'))
            throw new Error('Unsupported dispatch proposal');
        return this.backend.proposal({ route: patch.route }, ['capacity'], observed);
    }
    propose() {
        if (!this.canPropose())
            return;
        const runId = crypto.randomUUID();
        const threadId = 'browser-session';
        const call = 'dispatch';
        const observed = this.backend.snapshot(); // Bind the packet before constructing the producer stream.
        const stream = dispatchToolStream({ coordinator: this.operations, makeProposal: (patch, reads) => this.proposal(patch, reads, observed) });
        try {
            stream.consume({ type: 'RUN_STARTED', threadId, runId });
            stream.consume({ type: 'TOOL_CALL_START', toolCallId: call, toolCallName: 'propose_dispatch' });
            stream.consume({ type: 'TOOL_CALL_ARGS', toolCallId: call, delta: '{"patch":{"route":' });
            stream.consume({ type: 'TOOL_CALL_ARGS', toolCallId: call, delta: '"west"},"reads":["capacity"]}' });
            const operation = stream.consume({ type: 'TOOL_CALL_END', toolCallId: call });
            if (!operation || typeof operation.proposal.patch.route !== 'string')
                throw new Error('No proposal');
            const route = operation.proposal.patch.route;
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
            stream.consume({ type: 'RUN_FINISHED', threadId, runId });
            this.phase.set('draft');
            this.actor.set(operation.actor.kind);
            this.reviewText.set('none');
            this.message.set('Tool output is a draft; no approval or backend execution');
        }
        catch (e) {
            this.setError(e);
        }
        finally {
            stream.dispose();
        }
    }
    review() { if (!this.current || this.phase() !== 'draft')
        return; this.current.binding = this.operations.review(this.current.id); this.reviewText.set(JSON.stringify(this.current.binding.proposal)); this.phase.set('reviewed'); this.message.set('Review captured; backend will revalidate declared versions'); }
    async apply() { if (!this.current?.binding || this.phase() !== 'reviewed')
        return; this.operations.approve(this.current.binding); await this.deliver(); }
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
    async capacityAba() {
        if (this.busy() || ['disposed', 'uncertain'].includes(this.phase()))
            return;
        this.busy.set(true);
        const service = new OperationCoordinator(this.backend);
        try {
            for (const capacity of [5, 10]) {
                const id = crypto.randomUUID();
                service.create(id, this.backend.proposal({ capacity }));
                service.approve(service.review(id));
                const result = await service.deliver(id);
                if (result.status !== 'succeeded')
                    throw new Error('Capacity service failed');
                external(() => this.tree.$.capacity.set(capacity));
                service.forget(id);
            }
            this.message.set('Capacity returned to 10; authoritative revision advanced twice');
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
        this.operations.dispose();
        this.observerOff?.();
        this.off();
        this.tree.destroy();
        this.phase.set('disposed');
        this.message.set('Session disposed; no pending native authority');
    }
    // Unresolved destruction refuses cleanup; no durable transfer or navigation recovery is claimed.
    ngOnDestroy() { this.dispose(); }
    static { this.ɵfac = function BrowserReference_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || BrowserReference)(); }; }
    static { this.ɵcmp = /*@__PURE__*/ i0.ɵɵdefineComponent({ type: BrowserReference, selectors: [["operation-browser"]], decls: 82, vars: 27, consts: [["note", ""], ["data-testid", "phase"], ["data-testid", "server-outcome"], ["data-testid", "local-outcome"], ["data-testid", "message"], ["data-testid", "pending"], ["data-testid", "actor"], ["data-testid", "review"], [3, "click", "disabled"], ["data-testid", "destroyed"], ["data-testid", "observer-armed"], ["data-testid", "deliveries"], ["data-testid", "server-route"], ["data-testid", "server-version"], ["data-testid", "commits"], ["data-testid", "route"], ["data-testid", "capacity"], ["aria-label", "Independent note", 3, "input", "value"], ["data-testid", "note"]], template: function BrowserReference_Template(rf, ctx) { if (rf & 1) {
            i0.ɵɵdomElementStart(0, "h1");
            i0.ɵɵtext(1, "Dispatch operation review");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(2, "p");
            i0.ɵɵtext(3, "Installed SignalTree Angular \u00B7 AOT \u00B7 in-browser test authority, not durable storage");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(4, "p");
            i0.ɵɵtext(5, "Outcome: ");
            i0.ɵɵdomElementStart(6, "strong", 1);
            i0.ɵɵtext(7);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(8, "p");
            i0.ɵɵtext(9, "Server outcome: ");
            i0.ɵɵdomElementStart(10, "span", 2);
            i0.ɵɵtext(11);
            i0.ɵɵdomElementEnd();
            i0.ɵɵtext(12, "; local settlement: ");
            i0.ɵɵdomElementStart(13, "span", 3);
            i0.ɵɵtext(14);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(15, "p", 4);
            i0.ɵɵtext(16);
            i0.ɵɵdomElementEnd();
            i0.ɵɵconditionalCreate(17, BrowserReference_Conditional_17_Template, 14, 4);
            i0.ɵɵdomElementStart(18, "p");
            i0.ɵɵtext(19, "Native pending IDs: ");
            i0.ɵɵdomElementStart(20, "span", 5);
            i0.ɵɵtext(21);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(22, "p");
            i0.ɵɵtext(23, "Executor attribution: ");
            i0.ɵɵdomElementStart(24, "span", 6);
            i0.ɵɵtext(25);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(26, "p");
            i0.ɵɵtext(27, "Reviewed proposal: ");
            i0.ɵɵdomElementStart(28, "span", 7);
            i0.ɵɵtext(29);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(30, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_30_listener() { return ctx.propose(); });
            i0.ɵɵtext(31, "Propose via AG-UI");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(32, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_32_listener() { return ctx.review(); });
            i0.ɵɵtext(33, "Review");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(34, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_34_listener() { return ctx.apply(); });
            i0.ɵɵtext(35, "Apply reviewed");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(36, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_36_listener() { return ctx.reject(); });
            i0.ɵɵtext(37, "Reject proposal");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(38, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_38_listener() { return ctx.retry(); });
            i0.ɵɵtext(39, "Retry receipt");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(40, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_40_listener() { return ctx.retryLocal(); });
            i0.ɵɵtext(41, "Retry local settlement");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(42, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_42_listener() { return ctx.capacityAba(); });
            i0.ɵɵtext(43, "External capacity ABA");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(44, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_44_listener() { return ctx.failNext(); });
            i0.ɵɵtext(45, "Fail next persistence");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(46, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_46_listener() { return ctx.loseNext(); });
            i0.ɵɵtext(47, "Lose next acknowledgment");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(48, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_48_listener() { return ctx.dispose(); });
            i0.ɵɵtext(49, "Dispose session");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(50, "p", 9);
            i0.ɵɵtext(51);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(52, "fieldset")(53, "legend");
            i0.ɵɵtext(54, "Adversarial fixture controls (not business actions)");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(55, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_55_listener() { return ctx.addBlocker(); });
            i0.ɵɵtext(56, "Create overlapping route work");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(57, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_57_listener() { return ctx.resolveBlocker(); });
            i0.ɵɵtext(58, "Resolve overlapping route work");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(59, "button", 8);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_59_listener() { return ctx.armObserver(); });
            i0.ɵɵtext(60, "Arm rollback observer failure");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(61, "p", 10);
            i0.ɵɵtext(62);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(63, "p");
            i0.ɵɵtext(64, "Transport calls: ");
            i0.ɵɵdomElementStart(65, "span", 11);
            i0.ɵɵtext(66);
            i0.ɵɵdomElementEnd()()();
            i0.ɵɵdomElement(67, "hr");
            i0.ɵɵdomElementStart(68, "h2");
            i0.ɵɵtext(69, "Test authority diagnostics (not a client receipt)");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(70, "p");
            i0.ɵɵtext(71, "Committed route: ");
            i0.ɵɵdomElementStart(72, "span", 12);
            i0.ɵɵtext(73);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(74, "p");
            i0.ɵɵtext(75, "Capacity revision: ");
            i0.ɵɵdomElementStart(76, "span", 13);
            i0.ɵɵtext(77);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(78, "p");
            i0.ɵɵtext(79, "Commits: ");
            i0.ɵɵdomElementStart(80, "span", 14);
            i0.ɵɵtext(81);
            i0.ɵɵdomElementEnd()();
        } if (rf & 2) {
            i0.ɵɵadvance(7);
            i0.ɵɵtextInterpolate(ctx.phase());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.serverOutcome());
            i0.ɵɵadvance(3);
            i0.ɵɵtextInterpolate(ctx.localOutcome());
            i0.ɵɵadvance(2);
            i0.ɵɵtextInterpolate(ctx.message());
            i0.ɵɵadvance();
            i0.ɵɵconditional(ctx.phase() !== "disposed" ? 17 : -1);
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.pendingIds());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.actor());
            i0.ɵɵadvance(4);
            i0.ɵɵtextInterpolate(ctx.reviewText());
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
            i0.ɵɵdomProperty("disabled", ctx.phase() !== "reviewed" || ctx.hasBlocker());
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", !ctx.hasBlocker() || ctx.busy());
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", !ctx.canPropose());
            i0.ɵɵadvance(3);
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
 <button (click)="addBlocker()" [disabled]="phase() !== 'reviewed' || hasBlocker()">Create overlapping route work</button>
 <button (click)="resolveBlocker()" [disabled]="!hasBlocker() || busy()">Resolve overlapping route work</button>
 <button (click)="armObserver()" [disabled]="!canPropose()">Arm rollback observer failure</button>
 <p data-testid="observer-armed">{{observerArmed()}}</p>
 <p>Transport calls: <span data-testid="deliveries">{{deliveries()}}</span></p>
 </fieldset>
 <hr/><h2>Test authority diagnostics (not a client receipt)</h2>
 <p>Committed route: <span data-testid="server-route">{{serverRoute()}}</span></p>
 <p>Capacity revision: <span data-testid="server-version">{{capacityVersion()}}</span></p>
 <p>Commits: <span data-testid="commits">{{commits()}}</span></p>
` }]
    }], () => [], null); })();
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassDebugInfo(BrowserReference, { className: "BrowserReference", filePath: "browser/app.ts", lineNumber: 48 }); })();
