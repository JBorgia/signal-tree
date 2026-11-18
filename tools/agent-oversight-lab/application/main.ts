import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { OversightApplication } from './app.js';
bootstrapApplication(OversightApplication, {
  providers: [provideZonelessChangeDetection()],
}).catch(() => {
  document.body.textContent = 'Workspace could not start.';
});
