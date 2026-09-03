import { AsyncDemoComponent } from '../../features/fundamentals/examples/async/async-demo.component';
import { BatchingDemoComponent } from '../../features/fundamentals/examples/enhancers/batching-demo/batching-demo.component';
import { DevtoolsDemoComponent } from '../../features/fundamentals/examples/enhancers/devtools-demo/devtools-demo.component';
import { EntitiesDemoComponent } from '../../features/fundamentals/examples/entities/entities-demo.component';
import { EntitySortComparerDemoComponent } from '../../features/fundamentals/examples/entity-sort-comparer/entity-sort-comparer-demo.component';
import { GranularReactivityDemoComponent } from '../../features/fundamentals/examples/granular-reactivity/granular-reactivity-demo.component';
import { FormsDemoComponent } from '../../features/fundamentals/examples/forms/forms-demo.component';
import { RecommendedArchitectureComponent } from '../../features/fundamentals/examples/recommended-architecture/recommended-architecture.component';
import { SignalsExamplesComponent } from '../../features/fundamentals/examples/signals/signals-examples.component';
import { RestorationDemoComponent } from '../../features/fundamentals/examples/restoration/restoration-demo.component';
import { WhatsNewComponent } from '../../features/fundamentals/examples/whats-new/whats-new.component';

import type { ExampleMeta } from '../models';

const FUNDAMENTALS_ROUTE = '/examples/fundamentals';
const RECOMMENDED_ARCHITECTURE_ROUTE =
  '/examples/fundamentals/recommended-architecture';

// Import example components from the new features structure
/**
 * Signals Examples
 */
export const signalsExampleMeta: ExampleMeta = {
  id: 'signals-basics',
  title: 'Signals Basics',
  description:
    'Learn the fundamentals of SignalTree signals with counters and reactive inputs.',
  category: 'Signals',
  focusAreas: ['signals', 'reactivity'],
  functionalUse: ['state-management', 'ui-updates'],
  enhancers: [],
  route: FUNDAMENTALS_ROUTE,
  component: SignalsExamplesComponent,
  difficulty: 'beginner',
  tags: ['signals', 'counter', 'reactive-input', 'computed'],
};

/**
 * Entities Examples
 */
export const entitiesExampleMeta: ExampleMeta = {
  id: 'entity-management',
  title: 'Entity Management',
  description:
    'CRUD operations for managing collections of users and posts with pagination and sorting.',
  category: 'Entities',
  focusAreas: ['entities', 'crud', 'collections'],
  functionalUse: ['data-management', 'pagination', 'sorting'],
  enhancers: [],
  route: '/entities',
  component: EntitiesDemoComponent,
  difficulty: 'intermediate',
  tags: ['entities', 'crud', 'pagination', 'sorting', 'collections'],
};

export const entitySortComparerExampleMeta: ExampleMeta = {
  id: 'entity-sort-comparer',
  title: 'Auto-sorted Entities (sortComparer)',
  description:
    'entityMap({ sortComparer }) keeps a collection sorted on every read — no manual re-sort after mutations (v10.5+, @ngrx/entity parity).',
  category: 'Entities',
  focusAreas: ['entities', 'collections'],
  functionalUse: ['data-management', 'sorting'],
  enhancers: [],
  route: '/entity-sort-comparer',
  component: EntitySortComparerDemoComponent,
  difficulty: 'beginner',
  tags: ['entities', 'sorting', 'sortComparer', 'collections'],
};

export const granularReactivityExampleMeta: ExampleMeta = {
  id: 'granular-reactivity',
  title: 'Granular Reactivity (who re-renders?)',
  description:
    'Side-by-side render-counters: SignalTree entityMap re-renders only the touched row; a naive single signal(object) re-renders every row.',
  category: 'Performance',
  focusAreas: ['reactivity', 'performance'],
  functionalUse: ['performance', 'change-detection'],
  enhancers: [],
  route: '/granular-reactivity',
  component: GranularReactivityDemoComponent,
  difficulty: 'beginner',
  tags: ['reactivity', 'fan-out', 'OnPush', 'performance', 'entities'],
};

/**
 * Batching Examples
 */
export const batchingExampleMeta: ExampleMeta = {
  id: 'batching-updates',
  title: 'Coherent Publication',
  description:
    'Compare three synchronous writes across separate and grouped publication boundaries.',
  category: 'Operations',
  focusAreas: ['batching', 'publication', 'coherence'],
  functionalUse: ['multi-location-writes', 'framework-observation'],
  enhancers: ['batching'],
  route: '/batching',
  component: BatchingDemoComponent,
  difficulty: 'intermediate',
  tags: ['batching', 'publication', 'coherence', 'operations'],
};

/**
 * DevTools Examples
 */
export const devtoolsExampleMeta: ExampleMeta = {
  id: 'devtools-integration',
  title: 'DevTools Integration',
  description:
    'Explore debugging and development tools for SignalTree applications.',
  category: 'Development',
  focusAreas: ['debugging', 'development', 'tools'],
  functionalUse: ['debugging', 'development'],
  enhancers: ['devtools'],
  route: '/devtools',
  component: DevtoolsDemoComponent,
  difficulty: 'intermediate',
  tags: ['devtools', 'debugging', 'development', 'logging'],
};

/**
 * Presets Examples (removed in 9.0.1)
 */

/**
 * Serialization Examples
 */
/**
 * Memoization Examples (removed in 9.0.1 — use Angular `computed()` directly)
 */

/**
 * Time Travel Examples
 */
export const restorationExampleMeta: ExampleMeta = {
  id: 'restoration-debugging',
  title: 'Restoration — Undo and Redo',
  description:
    'Reverse and reapply designated operations, and see what a restoration ' +
    'refuses to discard.',
  category: 'Development',
  focusAreas: ['restoration', 'debugging', 'undo'],
  functionalUse: ['undo-redo', 'debugging', 'state-history'],
  enhancers: ['restoration'],
  route: '/restoration',
  component: RestorationDemoComponent,
  difficulty: 'advanced',
  tags: [
    'restoration',
    'undo-redo',
    'debugging',
    'history',
    'state-management',
  ],
};

// The Effects example was removed in v12 with the effects() enhancer — use
// Angular's native effect() (see the "Reactive effects" note in the docs).

/**
 * Forms Examples
 */
export const formsExampleMeta: ExampleMeta = {
  id: 'forms-integration',
  title: 'Angular-Owned Forms',
  description:
    'Angular form validation with ordinary SignalTree state at the application boundary.',
  category: 'Signals',
  focusAreas: ['forms', 'validation', 'computed'],
  functionalUse: ['form-handling', 'validation', 'user-input'],
  enhancers: [],
  route: FUNDAMENTALS_ROUTE,
  component: FormsDemoComponent,
  difficulty: 'intermediate',
  tags: ['forms', 'validation', 'computed', 'reactive'],
};

/**
 * Async Examples
 */
export const asyncExampleMeta: ExampleMeta = {
  id: 'async-operations',
  title: 'External Truth & Link',
  description:
    'Separate one-shot external ingress, ongoing Link relationships, and application-owned request policy.',
  category: 'Authority',
  focusAreas: ['external', 'link', 'orchestration'],
  functionalUse: ['data-ingress', 'synchronization', 'data-fetching'],
  enhancers: [],
  route: '/external-truth',
  component: AsyncDemoComponent,
  difficulty: 'intermediate',
  tags: ['external', 'link', 'authority', 'synchronization'],
};

/**
 * Recommended Architecture Example
 */
export const recommendedArchitectureExampleMeta: ExampleMeta = {
  id: 'recommended-architecture',
  title: 'Recommended Architecture',
  description:
    'Global tree + selective facades pattern with clean API separation and direct component access.',
  category: 'Architecture',
  focusAreas: ['architecture', 'global-tree', 'facades', 'api-separation'],
  functionalUse: ['state-management', 'orchestration', 'data-flow'],
  enhancers: [],
  route: RECOMMENDED_ARCHITECTURE_ROUTE,
  component: RecommendedArchitectureComponent,
  difficulty: 'advanced',
  tags: [
    'architecture',
    'global-tree',
    'facades',
    'best-practices',
    'api-separation',
  ],
};

/**
 * Central registry of all examples
 */
export const EXAMPLES_REGISTRY: ExampleMeta[] = [
  {
    id: 'whats-new',
    title: "What's New",
    description:
      'SignalTree 15.0.0-rc.1 — construction-bound realization, undoable() designation, transactions(), and the @signal-tree package reset. Pre-15 history moved to the Legacy changelog page.',
    category: 'General',
    focusAreas: ['news', 'changelog'],
    functionalUse: ['release-notes'],
    enhancers: [],
    route: FUNDAMENTALS_ROUTE,
    component: WhatsNewComponent,
    difficulty: 'beginner',
    tags: ['news', 'readme', 'updates'],
  },
  signalsExampleMeta,
  entitiesExampleMeta,
  entitySortComparerExampleMeta,
  granularReactivityExampleMeta,
  batchingExampleMeta,
  devtoolsExampleMeta,
  restorationExampleMeta,
  formsExampleMeta,
  asyncExampleMeta,
  recommendedArchitectureExampleMeta,
  // Note: customExtensionsExampleMeta removed - loaded separately via route
];
