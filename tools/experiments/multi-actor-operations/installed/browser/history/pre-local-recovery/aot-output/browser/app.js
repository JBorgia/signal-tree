import { Component, signal } from '@angular/core';
import { external, signalTree, transactions } from '@signal-tree/angular';
import { transactionLifecycleReader } from '@signal-tree/kernel/internals';
import { OperationCoordinator } from '../coordinator.mjs';
import { DispatchBackend } from '../dispatch-fixture.mjs';
import { dispatchToolStream } from './ag-ui.mjs';
import * as i0 from "@angular/core";
function BrowserReference_Conditional_10_Template(rf, ctx) { if (rf & 1) {
    const _r1 = i0.ɵɵgetCurrentView();
    i0.ɵɵdomElementStart(0, "p");
    i0.ɵɵtext(1, "Local route: ");
    i0.ɵɵdomElementStart(2, "strong", 11);
    i0.ɵɵtext(3);
    i0.ɵɵdomElementEnd()();
    i0.ɵɵdomElementStart(4, "p");
    i0.ɵɵtext(5, "Capacity: ");
    i0.ɵɵdomElementStart(6, "span", 12);
    i0.ɵɵtext(7);
    i0.ɵɵdomElementEnd()();
    i0.ɵɵdomElementStart(8, "label");
    i0.ɵɵtext(9, "Independent note ");
    i0.ɵɵdomElementStart(10, "input", 13, 0);
    i0.ɵɵdomListener("input", function BrowserReference_Conditional_10_Template_input_input_10_listener() { i0.ɵɵrestoreView(_r1); const note_r2 = i0.ɵɵreference(11); const ctx_r2 = i0.ɵɵnextContext(); return i0.ɵɵresetView(ctx_r2.editNote(note_r2.value)); });
    i0.ɵɵdomElementEnd()();
    i0.ɵɵdomElementStart(12, "p", 14);
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
        this.tree = signalTree({ route: 'north', capacity: 10, note: '' }, { enhancers: [transactions()] });
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
        this.backend = new DispatchBackend();
        this.lose = false;
        this.operations = new OperationCoordinator({ apply: (command) => {
                const receipt = this.backend.apply(command);
                this.refreshAuthority();
                if (this.lose) {
                    this.lose = false;
                    throw new Error('Acknowledgment lost; command outcome unknown to client');
                }
                return receipt;
            } });
        this.reader = transactionLifecycleReader(this.tree);
        this.off = this.reader.subscribe(e => this.pendingIds.set(e.snapshot.pending.map(p => p.transactionId).join(',')));
        this.tree.registerCleanup(() => this.destroyed.update(n => n + 1));
    }
    canPropose() { return !this.current && !this.busy() && this.phase() !== 'disposed'; }
    refreshAuthority() { const s = this.backend.snapshot(); this.serverRoute.set(s.values.route); this.capacityVersion.set(s.versions.capacity); this.commits.set(this.backend.commits); }
    setError(error) { this.message.set(error instanceof Error ? error.message : String(error)); }
    proposal(patch, reads) {
        if (typeof patch !== 'object' || patch === null || Array.isArray(patch) || !('route' in patch) || typeof patch.route !== 'string' || Object.keys(patch).some(k => k !== 'route') || reads?.some(k => k !== 'capacity'))
            throw new Error('Unsupported dispatch proposal');
        return this.backend.proposal({ route: patch.route }, ['capacity']);
    }
    propose() {
        if (!this.canPropose())
            return;
        const runId = crypto.randomUUID();
        const threadId = 'browser-session';
        const call = 'dispatch';
        const stream = dispatchToolStream({ coordinator: this.operations, makeProposal: (patch, reads) => this.proposal(patch, reads) });
        try {
            stream.consume({ type: 'RUN_STARTED', threadId, runId });
            stream.consume({ type: 'TOOL_CALL_START', toolCallId: call, toolCallName: 'propose_dispatch' });
            stream.consume({ type: 'TOOL_CALL_ARGS', toolCallId: call, delta: '{"patch":{"route":' });
            stream.consume({ type: 'TOOL_CALL_ARGS', toolCallId: call, delta: '"west"},"reads":["capacity"]}' });
            const operation = stream.consume({ type: 'TOOL_CALL_END', toolCallId: call });
            if (!operation || typeof operation.proposal.patch.route !== 'string')
                throw new Error('No proposal');
            const route = operation.proposal.patch.route;
            const local = this.tree.transact(() => this.tree.$.route.set(route));
            this.current = { id: operation.id, local };
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
            this.phase.set('uncertain');
            this.message.set('Outcome uncertain; native transaction remains pending. Retry the same command.');
            return;
        }
        if (outcome.status === 'succeeded') {
            current.local.confirm();
            this.phase.set('succeeded');
            this.message.set('Backend applied receipt received; native transaction confirmed');
        }
        else if (outcome.status === 'failed') {
            current.local.rollback();
            this.phase.set('failed');
            this.message.set(`Backend rejected: ${String(outcome.receipt?.reason)}; local proposal rolled back`);
        }
        else
            throw new Error('Nonterminal delivery response');
        this.operations.forget(current.id);
        this.current = undefined;
    }
    reject() { const current = this.current; if (!current || !['draft', 'reviewed'].includes(this.phase()))
        return; try {
        current.local.rollback();
        this.operations.reject(current.id);
        this.operations.forget(current.id);
        this.current = undefined;
        this.phase.set('rejected');
        this.message.set('Unsent proposal rejected; no backend command');
    }
    catch (e) {
        this.setError(e);
    } }
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
        if (this.busy() || this.phase() === 'uncertain') {
            this.message.set('Resolve in-flight or uncertain work before disposal');
            return;
        }
        if (this.current) {
            this.reject();
            if (this.current)
                return;
        }
        this.operations.dispose();
        this.off();
        this.tree.destroy();
        this.phase.set('disposed');
        this.message.set('Session disposed; no pending native authority');
    }
    ngOnDestroy() { this.dispose(); }
    static { this.ɵfac = function BrowserReference_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || BrowserReference)(); }; }
    static { this.ɵcmp = /*@__PURE__*/ i0.ɵɵdefineComponent({ type: BrowserReference, selectors: [["operation-browser"]], decls: 58, vars: 19, consts: [["note", ""], ["data-testid", "phase"], ["data-testid", "message"], ["data-testid", "pending"], ["data-testid", "actor"], ["data-testid", "review"], [3, "click", "disabled"], ["data-testid", "destroyed"], ["data-testid", "server-route"], ["data-testid", "server-version"], ["data-testid", "commits"], ["data-testid", "route"], ["data-testid", "capacity"], ["aria-label", "Independent note", 3, "input", "value"], ["data-testid", "note"]], template: function BrowserReference_Template(rf, ctx) { if (rf & 1) {
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
            i0.ɵɵdomElementStart(8, "p", 2);
            i0.ɵɵtext(9);
            i0.ɵɵdomElementEnd();
            i0.ɵɵconditionalCreate(10, BrowserReference_Conditional_10_Template, 14, 4);
            i0.ɵɵdomElementStart(11, "p");
            i0.ɵɵtext(12, "Native pending IDs: ");
            i0.ɵɵdomElementStart(13, "span", 3);
            i0.ɵɵtext(14);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(15, "p");
            i0.ɵɵtext(16, "Executor attribution: ");
            i0.ɵɵdomElementStart(17, "span", 4);
            i0.ɵɵtext(18);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(19, "p");
            i0.ɵɵtext(20, "Reviewed proposal: ");
            i0.ɵɵdomElementStart(21, "span", 5);
            i0.ɵɵtext(22);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(23, "button", 6);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_23_listener() { return ctx.propose(); });
            i0.ɵɵtext(24, "Propose via AG-UI");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(25, "button", 6);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_25_listener() { return ctx.review(); });
            i0.ɵɵtext(26, "Review");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(27, "button", 6);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_27_listener() { return ctx.apply(); });
            i0.ɵɵtext(28, "Apply reviewed");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(29, "button", 6);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_29_listener() { return ctx.reject(); });
            i0.ɵɵtext(30, "Reject proposal");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(31, "button", 6);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_31_listener() { return ctx.retry(); });
            i0.ɵɵtext(32, "Retry receipt");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(33, "button", 6);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_33_listener() { return ctx.capacityAba(); });
            i0.ɵɵtext(34, "External capacity ABA");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(35, "button", 6);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_35_listener() { return ctx.failNext(); });
            i0.ɵɵtext(36, "Fail next persistence");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(37, "button", 6);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_37_listener() { return ctx.loseNext(); });
            i0.ɵɵtext(38, "Lose next acknowledgment");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(39, "button", 6);
            i0.ɵɵdomListener("click", function BrowserReference_Template_button_click_39_listener() { return ctx.dispose(); });
            i0.ɵɵtext(40, "Dispose session");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(41, "p", 7);
            i0.ɵɵtext(42);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElement(43, "hr");
            i0.ɵɵdomElementStart(44, "h2");
            i0.ɵɵtext(45, "Test authority diagnostics (not a client receipt)");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(46, "p");
            i0.ɵɵtext(47, "Committed route: ");
            i0.ɵɵdomElementStart(48, "span", 8);
            i0.ɵɵtext(49);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(50, "p");
            i0.ɵɵtext(51, "Capacity revision: ");
            i0.ɵɵdomElementStart(52, "span", 9);
            i0.ɵɵtext(53);
            i0.ɵɵdomElementEnd()();
            i0.ɵɵdomElementStart(54, "p");
            i0.ɵɵtext(55, "Commits: ");
            i0.ɵɵdomElementStart(56, "span", 10);
            i0.ɵɵtext(57);
            i0.ɵɵdomElementEnd()();
        } if (rf & 2) {
            i0.ɵɵadvance(7);
            i0.ɵɵtextInterpolate(ctx.phase());
            i0.ɵɵadvance(2);
            i0.ɵɵtextInterpolate(ctx.message());
            i0.ɵɵadvance();
            i0.ɵɵconditional(ctx.phase() !== "disposed" ? 10 : -1);
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
            i0.ɵɵdomProperty("disabled", ctx.busy() || ctx.phase() === "disposed" || ctx.phase() === "uncertain");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.busy() || ctx.phase() === "disposed");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.busy() || ctx.phase() === "disposed");
            i0.ɵɵadvance(2);
            i0.ɵɵdomProperty("disabled", ctx.phase() === "disposed");
            i0.ɵɵadvance(3);
            i0.ɵɵtextInterpolate1("Tree cleanup callbacks: ", ctx.destroyed());
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
 <button (click)="capacityAba()" [disabled]="busy() || phase() === 'disposed' || phase() === 'uncertain'">External capacity ABA</button>
 <button (click)="failNext()" [disabled]="busy() || phase() === 'disposed'">Fail next persistence</button>
 <button (click)="loseNext()" [disabled]="busy() || phase() === 'disposed'">Lose next acknowledgment</button>
 <button (click)="dispose()" [disabled]="phase() === 'disposed'">Dispose session</button>
 <p data-testid="destroyed">Tree cleanup callbacks: {{destroyed()}}</p>
 <hr/><h2>Test authority diagnostics (not a client receipt)</h2>
 <p>Committed route: <span data-testid="server-route">{{serverRoute()}}</span></p>
 <p>Capacity revision: <span data-testid="server-version">{{capacityVersion()}}</span></p>
 <p>Commits: <span data-testid="commits">{{commits()}}</span></p>
` }]
    }], () => [], null); })();
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassDebugInfo(BrowserReference, { className: "BrowserReference", filePath: "browser/app.ts", lineNumber: 38 }); })();
