// Vitest setup for @signal-tree/angular.
//
// Importing the package's realization module IS the installation — the same
// structural mechanism a consumer gets from `import ... from
// '@signal-tree/angular'`. Nothing here calls an installer directly, so these
// specs exercise the real initialization path rather than a test-only one.
import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// NOTE: the realization is deliberately NOT installed here. If this setup
// installed it, every spec would pass regardless of whether the public root
// works, and `public-root-initialization.spec.ts` would be vacuous. Specs must
// obtain realization the way an application does: by importing the package.

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
