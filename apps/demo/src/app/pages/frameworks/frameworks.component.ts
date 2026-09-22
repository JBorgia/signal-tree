import { ChangeDetectionStrategy, Component } from '@angular/core';

interface FrameworkRealization {
  readonly id: string;
  readonly name: string;
  readonly realization: string;
  readonly primitive: string;
  readonly memory: string;
  readonly install: string;
  readonly read: string;
  readonly write: string;
}

interface RoadmapEntry {
  readonly name: string;
  readonly when: string;
  readonly note: string;
}

/**
 * The framework surface.
 *
 * The site previously presented SignalTree as kernel-and-TypeScript with the
 * framework entries collapsed into package-documentation links, which
 * understated what actually changed: each framework package is now a physical
 * realization layer, not a wrapper.
 *
 * Memory figures live HERE rather than on the landing page, and each carries
 * the qualifier that makes it honest. A released-residue number lifted out of
 * its methodology is how a benchmark becomes marketing.
 */
@Component({
  selector: 'app-frameworks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './frameworks.component.html',
  styleUrl: './frameworks.component.scss',
})
export class FrameworksComponent {
  readonly shipping: readonly FrameworkRealization[] = [
    {
      id: 'angular',
      name: 'Angular',
      realization: 'Native Angular realization',
      primitive: 'signal() — callable, tracked, writable',
      memory: '1,350 B/entity',
      install: 'npm i @signal-tree/angular',
      read: 'tree.$.count()',
      write: 'tree.$.count.set(1)',
    },
    {
      id: 'vue',
      name: 'Vue',
      realization: 'Native Vue realization',
      primitive: 'shallowRef with a reader',
      memory: '1,135 B/entity',
      install: 'npm i @signal-tree/vue',
      read: 'tree.$.count.value',
      write: 'tree.$.count.value = 1',
    },
    {
      id: 'solid',
      name: 'Solid',
      realization: 'Native Solid realization',
      primitive: 'createSignal — tracked getter and setter',
      // Deliberately not a number. Solid shipped on correctness and semantic
      // conformance; its realization cost was not characterized, and inventing
      // a figure to fill the column would be worse than an honest blank.
      memory: 'Not yet characterized',
      install: 'npm i @signal-tree/solid',
      read: 'tree.$.count()',
      write: 'tree.$.count.set(1)',
    },
    {
      id: 'react',
      name: 'React',
      realization: 'Portable / external-store realization',
      primitive: 'Subscription via useSyncExternalStore',
      memory: '~1,748 B/entity',
      install: 'npm i @signal-tree/react',
      read: 'tree.$.count()',
      write: 'tree.$.count.set(1)',
    },
  ];

  readonly roadmap: readonly RoadmapEntry[] = [
    {
      name: 'Preact',
      when: 'Next',
      note: 'Standalone signal objects with tracked, writable .value — strong technical fit, unmeasured.',
    },
    {
      name: 'Svelte',
      when: 'Later',
      note: 'Runes are compiler constructs; integration would go through createSubscriber.',
    },
    {
      name: 'Qwik · Lit',
      when: 'Demand-driven',
      note: 'Promising primitives, different system constraints.',
    },
  ];

  /** The same semantics, expressed in each framework's own idiom. */
  readonly semantics: readonly { name: string; detail: string }[] = [
    {
      name: 'Stable subject identity',
      detail:
        'A held row belongs to a subject, not a key. Remove it and re-add the same id and the old reference stays gone rather than silently pointing at a different row.',
    },
    {
      name: 'Authored vs realized',
      detail:
        'A user edit and a server reconciliation are both writes, and the tree knows which is which.',
    },
    {
      name: 'Transactions and rollback',
      detail:
        'Speculative state is visible immediately; a rollback compensates through the same references your UI already holds.',
    },
    {
      name: 'Restoration',
      detail:
        'Restoring an earlier truth revives the same subject rather than creating a lookalike.',
    },
    {
      name: 'External truth',
      detail:
        'link() binds part of the tree to a source outside it, with the tree still owning what a write means.',
    },
  ];
}
