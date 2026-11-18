import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app';
import { Workspace } from './workflow';
import { functionalChecks } from './checks';
import { ARM } from './selected-arm';
enableProdMode();
if (new URLSearchParams(location.search).has('lab')) {
  window.adoptionLab = { Workspace, functionalChecks, arm: ARM };
} else {
  bootstrapApplication(App).catch((error) => {
    console.error(error);
  });
}
