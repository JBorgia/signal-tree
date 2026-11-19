import { Component } from '@angular/core';
import { signalTree, entityMap } from '@signal-tree/angular';
import * as i0 from "@angular/core";
export class PeerControl {
    tree = signalTree({ count: 1, rows: entityMap() });
    increment() { this.tree.$.count.set(this.tree.$.count() + 1); }
    ngOnDestroy() { this.tree.destroy(); }
    static ɵfac = function PeerControl_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || PeerControl)(); };
    static ɵcmp = /*@__PURE__*/ i0.ɵɵdefineComponent({ type: PeerControl, selectors: [["peer-control"]], decls: 4, vars: 2, consts: [[3, "click"]], template: function PeerControl_Template(rf, ctx) { if (rf & 1) {
            i0.ɵɵelementStart(0, "button", 0);
            i0.ɵɵlistener("click", function PeerControl_Template_button_click_0_listener() { return ctx.increment(); });
            i0.ɵɵtext(1);
            i0.ɵɵelementEnd();
            i0.ɵɵelementStart(2, "p");
            i0.ɵɵtext(3);
            i0.ɵɵelementEnd();
        } if (rf & 2) {
            i0.ɵɵadvance();
            i0.ɵɵtextInterpolate(ctx.tree.$.count());
            i0.ɵɵadvance(2);
            i0.ɵɵtextInterpolate(ctx.tree.$.rows.activeId());
        } }, encapsulation: 2 });
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassMetadata(PeerControl, [{
        type: Component,
        args: [{ selector: 'peer-control', standalone: true, template: '<button (click)="increment()">{{tree.$.count()}}</button><p>{{tree.$.rows.activeId()}}</p>' }]
    }], null, null); })();
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassDebugInfo(PeerControl, { className: "PeerControl", filePath: "component.ts", lineNumber: 4 }); })();
