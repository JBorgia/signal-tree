import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { HttpReference } from './app.js';
bootstrapApplication(HttpReference, {
  providers: [provideZonelessChangeDetection()],
}).catch((error) => {
  console.error(error);
  document.body.setAttribute('data-bootstrap-error', String(error));
});
