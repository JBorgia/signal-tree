/**
 * Enhancer Lifecycle System - Modular enhancement architecture
 */

export interface EnhancerLifecycle {
  name: string;
  dependencies?: string[];

  // Lifecycle hooks
  beforeCreate?: (config: any) => any;
  afterCreate?: (tree: any) => void;
  beforeUpdate?: (tree: any, updates: any) => any;
  afterUpdate?: (tree: any) => void;
  beforeDestroy?: (tree: any) => void;

  // Enhancement function
  enhance(tree: any, config?: any): any;
}

export class EnhancerManager {
  private enhancers = new Map<string, EnhancerLifecycle>();
  private applied = new Set<string>();

  register(enhancer: EnhancerLifecycle): void {
    if (this.enhancers.has(enhancer.name)) {
      throw new Error(`Enhancer ${enhancer.name} already registered`);
    }
    this.enhancers.set(enhancer.name, enhancer);
  }

  apply(tree: any, enhancerNames: string[]): any {
    // Resolve dependencies
    const resolved = this.resolveDependencies(enhancerNames);

    // Apply in order
    let enhancedTree = tree;
    for (const name of resolved) {
      const enhancer = this.enhancers.get(name);
      if (!enhancer) {
        throw new Error(`Enhancer ${name} not found`);
      }

      // Run lifecycle hooks
      if (enhancer.beforeCreate) {
        enhancer.beforeCreate((tree as any).config);
      }

      enhancedTree = enhancer.enhance(enhancedTree);

      if (enhancer.afterCreate) {
        enhancer.afterCreate(enhancedTree);
      }

      this.applied.add(name);
    }

    return enhancedTree;
  }

  private resolveDependencies(names: string[]): string[] {
    const resolved: string[] = [];
    const visited = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const enhancer = this.enhancers.get(name);
      if (enhancer?.dependencies) {
        for (const dep of enhancer.dependencies) {
          visit(dep);
        }
      }

      resolved.push(name);
    };

    for (const name of names) {
      visit(name);
    }

    return resolved;
  }
}
