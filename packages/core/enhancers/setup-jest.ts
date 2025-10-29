import 'zone.js';
import 'zone.js/bundles/zone-testing.umd.js';

import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

// Minimal Angular TestBed init for Jest environment.
// We intentionally avoid importing `jest-preset-angular/setup-jest` here because
// the enhancers test runner resolves modules from the package root and that
// import was failing in the test environment. If you prefer to use the full
// preset, re-add the import once module resolution is corrected.
// Zone.js is required by Angular's runtime in this configuration.
// Import bundles directly to avoid resolution problems with pnpm's hoisting.
TestBed.initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
