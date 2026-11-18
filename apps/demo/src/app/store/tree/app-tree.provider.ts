import {
  inject,
  Injectable,
  InjectionToken,
  Provider,
  type OnDestroy,
} from '@angular/core';

import { AppTree, createAppTree } from './app-tree';

/**
 * Injection token for the tutorial owner's tree.
 *
 * Components and ops services should inject `APP_TREE` (not the holder service)
 * so they receive the typed `AppTree` directly.
 */
export const APP_TREE = new InjectionToken<AppTree>('DemoAppTree');

/**
 * Holds one tree for the injector that owns this tutorial.
 * Constructed once via the `APP_TREE` provider factory below.
 */
@Injectable()
export class AppTreeService implements OnDestroy {
  readonly tree: AppTree = createAppTree();

  ngOnDestroy(): void {
    this.tree.destroy();
  }
}

/**
 * Provide at the feature owner, together with its facade and operations.
 *
 * @example
 * ```ts
 * // feature.component.ts
 * providers: [
 *   ...provideAppTree(),
 * ];
 * ```
 */
export function provideAppTree(): Provider[] {
  return [
    AppTreeService,
    {
      provide: APP_TREE,
      useFactory: () => inject(AppTreeService).tree,
    },
  ];
}
