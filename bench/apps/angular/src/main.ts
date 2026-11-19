import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';

bootstrapApplication(App, { providers: [provideBrowserGlobalErrorListeners()] }).catch((error: unknown) => {
  console.error(error);
  (window as unknown as { __benchBootError?: string }).__benchBootError = String(error);
});
