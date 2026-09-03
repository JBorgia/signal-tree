import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

import {
  CodeTabsComponent,
  type CodeFile,
} from '../../examples/shared/components/example-shell';

interface HomeLink {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly route: string;
  readonly action: string;
}

interface PackageEntry {
  readonly name: string;
  readonly role: string;
  readonly detail: string;
  readonly package: 'angular' | 'kernel' | 'react';
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CodeTabsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly paths: readonly HomeLink[] = [
    {
      eyebrow: 'New to SignalTree',
      title: 'Learn the model',
      description:
        'Read the state grammar, build one tree, and see where optional capabilities attach.',
      route: '/start',
      action: 'Take the five-minute tour',
    },
    {
      eyebrow: 'Evaluating architecture',
      title: 'Inspect the boundaries',
      description:
        'See exactly what the kernel, framework realizations, applications, and external endpoints own.',
      route: '/architecture-overview',
      action: 'Open the architecture',
    },
    {
      eyebrow: 'Ready to build',
      title: 'Work through examples',
      description:
        'Use live state, derived values, EntityMap collections, transactions, and restoration.',
      route: '/examples/fundamentals',
      action: 'Open fundamentals',
    },
    {
      eyebrow: 'Working from existing code',
      title: 'Plan the migration',
      description:
        'Map current application responsibilities onto the v15 ownership model without recreating legacy architecture.',
      route: '/migrate',
      action: 'Open the migration guide',
    },
  ];

  readonly packages: readonly PackageEntry[] = [
    {
      name: '@signal-tree/angular',
      role: 'Angular applications',
      detail: 'Native signals, dependency injection, and injector-bound cleanup.',
      package: 'angular',
    },
    {
      name: '@signal-tree/kernel',
      role: 'Framework-neutral code',
      detail: 'State, identity, causal turns, restoration, transactions, and Link.',
      package: 'kernel',
    },
    {
      name: '@signal-tree/react',
      role: 'React applications',
      detail: 'Owner-bound observation over the same kernel authority.',
      package: 'react',
    },
  ];

  readonly stateGrammar: CodeFile[] = [
    {
      label: 'state-grammar.ts',
      language: 'typescript',
      source: `import { signalTree } from '@signal-tree/angular';

const tree = signalTree({
  count: 0,
  profile: { name: 'Ada', role: 'engineer' }
});

tree.$();                              // read root
tree.$(current => ({ ...current }));  // update root

tree.$.profile();                      // read branch
tree.$.profile(current => ({
  ...current,
  role: 'architect'
}));                                   // update branch

tree.$.count();                        // read leaf
tree.$.count.set(5);                   // replace leaf
tree.$.count.update(n => n + 1);       // update leaf`,
    },
    {
      label: 'causal-writes.ts',
      language: 'typescript',
      source: `import { external, undoable } from '@signal-tree/angular';

tree.$.count.set(1);                   // authored, undesignated

undoable(() => {
  tree.$.profile.role.set('architect');
});                                   // authored + restoration-designated

const profile = await api.loadProfile();
external(() => {
  tree.$.profile(profile);
});                                   // externally realized truth`,
    },
  ];
}
