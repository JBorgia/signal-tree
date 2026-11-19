import {Component} from '@angular/core';
import {signalTree,entityMap} from '@signal-tree/angular';
@Component({selector:'peer-control',standalone:true,template:'<button (click)="increment()">{{tree.$.count()}}</button><p>{{tree.$.rows.activeId()}}</p>'})
export class PeerControl {readonly tree=signalTree({count:1,rows:entityMap<{id:string;n:number},string>()}); increment(){this.tree.$.count.set(this.tree.$.count()+1);} ngOnDestroy(){this.tree.destroy();}}
