import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserReference } from './app.js';
bootstrapApplication(BrowserReference,{providers:[provideZonelessChangeDetection()]}).catch(error=>{console.error(error);document.body.setAttribute('data-bootstrap-error',String(error));});
