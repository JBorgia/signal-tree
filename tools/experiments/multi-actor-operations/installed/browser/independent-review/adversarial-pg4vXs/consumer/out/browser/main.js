import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserReference } from './app.js';
bootstrapApplication(BrowserReference, { providers: [provideZonelessChangeDetection()] }).then(ref => { const instance = ref.components[0].instance; window.reviewProbe = { destroy: () => ref.destroy(), snapshot: () => ({ phase: instance.phase(), destroyed: instance.destroyed(), pending: instance.pendingIds(), busy: instance.busy(), message: instance.message() }) }; }).catch(error => { console.error(error); document.body.setAttribute('data-bootstrap-error', String(error)); });
