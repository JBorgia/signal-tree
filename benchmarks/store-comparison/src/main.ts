import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { BenchRoot } from './app/root';
import { ROUTES } from './app/routes';

// Zoneless: change detection is scheduled by signal writes, as in a modern Angular app.
bootstrapApplication(BenchRoot, {
  providers: [provideZonelessChangeDetection(), provideRouter(ROUTES)],
}).catch((error: unknown) => {
  (globalThis as { __benchBootError?: string }).__benchBootError =
    String(error);
  console.error(error);
});
