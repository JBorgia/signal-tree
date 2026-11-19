import { Component, computed } from '@angular/core';
import { external, signalTree, transactions } from '@signal-tree/angular';
import * as i0 from "@angular/core";
export class ReferenceComponent {
    constructor() {
        this.tree = signalTree({ route: 'north', capacity: 10, note: '' }, { enhancers: [transactions()] });
        this.summary = computed(() => `${this.tree.$.route()}:${this.tree.$.capacity()}`, /* @ts-ignore */
        ...(ngDevMode ? [{ debugName: "summary" }] : /* istanbul ignore next */ []));
    }
    proposeWest() {
        if (this.pending)
            throw new Error('Settle current proposal first');
        this.pending = this.tree.transact(() => this.tree.$.route.set('west'));
    }
    confirm() { this.pending?.confirm(); this.pending = undefined; }
    reject() { this.pending?.rollback(); this.pending = undefined; }
    ingestCapacity(value) { external(() => this.tree.$.capacity.set(value)); }
    ngOnDestroy() { this.tree.destroy(); }
    static { this.ɵfac = function ReferenceComponent_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || ReferenceComponent)(); }; }
    static { this.ɵcmp = /*@__PURE__*/ i0.ɵɵdefineComponent({ type: ReferenceComponent, selectors: [["operation-reference"]], decls: 14, vars: 3, consts: [[3, "click"]], template: function ReferenceComponent_Template(rf, ctx) { if (rf & 1) {
            i0.ɵɵdomElementStart(0, "h1");
            i0.ɵɵtext(1, "Dispatch review");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(2, "p");
            i0.ɵɵtext(3);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(4, "p");
            i0.ɵɵtext(5);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(6, "p");
            i0.ɵɵtext(7);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(8, "button", 0);
            i0.ɵɵdomListener("click", function ReferenceComponent_Template_button_click_8_listener() { return ctx.proposeWest(); });
            i0.ɵɵtext(9, "Propose west");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(10, "button", 0);
            i0.ɵɵdomListener("click", function ReferenceComponent_Template_button_click_10_listener() { return ctx.confirm(); });
            i0.ɵɵtext(11, "Confirm locally");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(12, "button", 0);
            i0.ɵɵdomListener("click", function ReferenceComponent_Template_button_click_12_listener() { return ctx.reject(); });
            i0.ɵɵtext(13, "Reject locally");
            i0.ɵɵdomElementEnd();
        } if (rf & 2) {
            i0.ɵɵadvance(3);
            i0.ɵɵtextInterpolate1("Route: ", ctx.tree.$.route());
            i0.ɵɵadvance(2);
            i0.ɵɵtextInterpolate1("Capacity: ", ctx.tree.$.capacity());
            i0.ɵɵadvance(2);
            i0.ɵɵtextInterpolate(ctx.summary());
        } }, encapsulation: 2 }); }
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassMetadata(ReferenceComponent, [{
        type: Component,
        args: [{
                selector: 'operation-reference',
                standalone: true,
                template: `
    <h1>Dispatch review</h1>
    <p>Route: {{ tree.$.route() }}</p>
    <p>Capacity: {{ tree.$.capacity() }}</p>
    <p>{{ summary() }}</p>
    <button (click)="proposeWest()">Propose west</button>
    <button (click)="confirm()">Confirm locally</button>
    <button (click)="reject()">Reject locally</button>
  `,
            }]
    }], null, null); })();
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassDebugInfo(ReferenceComponent, { className: "ReferenceComponent", filePath: "reference.component.ts", lineNumber: 17 }); })();
