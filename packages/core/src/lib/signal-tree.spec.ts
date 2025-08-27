import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { signalTree } from './signal-tree';
import { unwrap } from './utils';

describe('signalTree', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should create a basic signal tree', () => {
    const tree = signalTree({ count: 0, user: { name: 'John' } });

    expect(tree).toBeDefined();
    expect(tree.$).toBeDefined();
    expect(tree.with).toBeDefined();
  });

  it('should access signal values directly', () => {
    const initialState = { count: 0, user: { name: 'John' } };
    const tree = signalTree(initialState);

    // Test individual property access
    expect(tree.$.count()).toBe(0);
    expect(tree.$.user.name()).toBe('John');

    // Test nested object access
    expect(tree.$.user.name()).toBe('John');
  });

  it('should provide access to individual signals', () => {
    const tree = signalTree({ count: 0, user: { name: 'John' } });

    expect(tree.$.count()).toBe(0);
    expect(tree.$.user.name()).toBe('John');
  });

  it('should update individual signals', () => {
    const tree = signalTree({ count: 0, user: { name: 'John' } });

    tree.$.count.set(5);
    tree.$.user.name.set('Jane');

    expect(tree.$.count()).toBe(5);
    expect(tree.$.user.name()).toBe('Jane');
  });

  it('should support enhancer composition with with() method', () => {
    const tree = signalTree({ count: 0 });

    // Test with method exists
    expect(tree.with).toBeDefined();
    expect(typeof tree.with).toBe('function');

    // Test with() with no arguments returns the tree
    const piped = tree.with();
    expect(piped).toBe(tree);
  });

  it('should not have advanced features in core package', () => {
    const tree = signalTree({ count: 0 });

    // The core package no longer provides advanced features directly
    // These need to be added via enhancers using the with() method
    expect('batchUpdate' in tree.$).toBe(false);
    expect('memoize' in tree).toBe(false);
    expect('pipe' in tree).toBe(false);
  });

  it('should support enhancer composition', () => {
    const tree = signalTree({ count: 0 });

    // Create a simple enhancer function
    const addCustomMethod = (inputTree: typeof tree) => {
      return {
        ...inputTree,
        customMethod: () => 'custom',
      };
    };

    const enhanced = tree.with(addCustomMethod);
    expect(enhanced.customMethod).toBeDefined();
    expect(enhanced.customMethod()).toBe('custom');
  });

  it('should support chaining multiple enhancers', () => {
    const tree = signalTree({ count: 0 });

    const addMethod1 = (inputTree: typeof tree) => ({
      ...inputTree,
      method1: () => 'method1',
    });

    const addMethod2 = (inputTree: ReturnType<typeof addMethod1>) => ({
      ...inputTree,
      method2: () => 'method2',
    });

    const enhanced = tree.with(addMethod1, addMethod2);
    expect(enhanced.method1).toBeDefined();
    expect(enhanced.method2).toBeDefined();
    expect(enhanced.method1()).toBe('method1');
    expect(enhanced.method2()).toBe('method2');
  });

  describe('complex types', () => {
    it('should handle complex nested state structures', () => {
      interface ComplexState {
        counter: number;
        user: {
          id: number;
          name: string;
          settings: {
            theme: 'dark' | 'light';
            level: 'beginner' | 'intermediate' | 'advanced';
          };
        };
        features: readonly ['auth', 'dashboard'];
        metadata: Date;
      }

      const initialState: ComplexState = {
        counter: 0,
        user: {
          id: 1,
          name: 'John',
          settings: {
            theme: 'dark',
            level: 'beginner',
          },
        },
        features: ['auth', 'dashboard'],
        metadata: new Date('2024-01-01'),
      };

      const tree = signalTree(initialState);

      // Test initial state
      expect(tree.$.counter()).toBe(0);
      expect(unwrap(tree.$.features)).toEqual(['auth', 'dashboard']);
      expect(tree.$.metadata()).toEqual(new Date('2024-01-01'));

      // Test nested access
      expect(tree.$.user.id()).toBe(1);
      expect(tree.$.user.name()).toBe('John');
      expect(tree.$.user.settings.theme()).toBe('dark');
      expect(tree.$.user.settings.level()).toBe('beginner');

      // Test updates
      tree.$.counter.set(5);
      tree.$.user.name.set('Jane');
      tree.$.user.settings.theme.set('light'); // Only 'light' | 'dark' allowed
      tree.$.user.settings.level.set('advanced'); // Only valid enum values

      // Verify updates
      expect(tree.$.counter()).toBe(5);
      expect(tree.$.user.name()).toBe('Jane');
      expect(tree.$.user.settings.theme()).toBe('light');
      expect(tree.$.user.settings.level()).toBe('advanced');
    });

    it('should support update operations on complex state', () => {
      const tree = signalTree({
        counter: 10,
        user: {
          settings: {
            theme: 'dark' as const,
          },
        },
      });

      tree.$.counter.update((current: number) => current + 5);
      tree.$.user.settings.theme.set('dark');

      expect(tree.$.counter()).toBe(15);
      expect(tree.$.user.settings.theme()).toBe('dark');
    });

    it('should maintain type safety with deeply nested structures', () => {
      interface DeepNestedConfig {
        app: {
          modules: {
            auth: {
              providers: {
                oauth: {
                  google: {
                    clientId: string;
                    scopes: readonly ['profile', 'email'];
                    config: {
                      autoLogin: boolean;
                      rememberUser: boolean;
                    };
                  };
                  github: {
                    clientId: string;
                    permissions: readonly ['user:email', 'read:user'];
                  };
                };
                local: {
                  registration: {
                    requireEmailVerification: boolean;
                    allowSelfRegistration: boolean;
                  };
                };
              };
            };
          };
        };
      }

      const deepConfig: DeepNestedConfig = {
        app: {
          modules: {
            auth: {
              providers: {
                oauth: {
                  google: {
                    clientId: 'google-client-id',
                    scopes: ['profile', 'email'],
                    config: {
                      autoLogin: false,
                      rememberUser: true,
                    },
                  },
                  github: {
                    clientId: 'github-client-id',
                    permissions: ['user:email', 'read:user'],
                  },
                },
                local: {
                  registration: {
                    requireEmailVerification: true,
                    allowSelfRegistration: false,
                  },
                },
              },
            },
          },
        },
      };

      const tree = signalTree(deepConfig);

      // Test deep nested access
      expect(tree.$.app.modules.auth.providers.oauth.google.clientId()).toBe(
        'google-client-id'
      );
      expect(tree.$.app.modules.auth.providers.oauth.google.scopes()).toEqual([
        'profile',
        'email',
      ]);
      expect(
        tree.$.app.modules.auth.providers.oauth.google.config.autoLogin()
      ).toBe(false);
      expect(
        tree.$.app.modules.auth.providers.local.registration.requireEmailVerification()
      ).toBe(true);

      // Test deep nested updates
      tree.$.app.modules.auth.providers.oauth.google.config.autoLogin.set(true);
      tree.$.app.modules.auth.providers.local.registration.allowSelfRegistration.set(
        true
      );

      expect(
        tree.$.app.modules.auth.providers.oauth.google.config.autoLogin()
      ).toBe(true);
      expect(
        tree.$.app.modules.auth.providers.local.registration.allowSelfRegistration()
      ).toBe(true);
    });
  });

  describe('signal tree creation', () => {
    it('should create a signal tree with basic properties', () => {
      const tree = signalTree({ count: 0, user: { name: 'John' } });

      expect(tree.$.count()).toBe(0);
      expect(tree.$.user.name()).toBe('John');

      // Test updates
      tree.$.count.set(10);
      tree.$.user.name.set('Jane');

      expect(tree.$.count()).toBe(10);
      expect(tree.$.user.name()).toBe('Jane');
    });
  });

  describe('edge cases and complex behaviors', () => {
    it('should handle optional properties correctly', () => {
      interface StateWithOptionals {
        requiredProp: string;
        optionalProp?: number;
        nestedOptional?: {
          value: string;
        };
      }

      const tree = signalTree<StateWithOptionals>({
        requiredProp: 'test',
      });

      expect(tree.$.requiredProp()).toBe('test');
    });

    it('should work with arrays and readonly arrays', () => {
      const tree = signalTree({
        numbers: [1, 2, 3],
        readonlyArray: ['a', 'b', 'c'] as readonly string[],
      });

      expect(unwrap(tree.$.numbers)).toEqual([1, 2, 3]);
      expect(tree.$.readonlyArray()).toEqual(['a', 'b', 'c']);

      tree.$.numbers.set([4, 5, 6]);
      expect(unwrap(tree.$.numbers)).toEqual([4, 5, 6]);
    });

    it('should handle dynamic keys', () => {
      const tree = signalTree({
        features: {
          flags: {} as Record<string, boolean>,
        },
      });

      // This should work but the exact typing depends on implementation
      expect(tree.$.features.flags()).toEqual({});

      tree.$.features.flags.set({
        feature1: true,
        feature2: false,
      });

      expect(tree.$.features.flags()).toEqual({
        feature1: true,
        feature2: false,
      });
    });

    it('should handle mixed signal and non-signal values', () => {
      const externalSignal = signal({ count: 10, label: 'external' });

      const tree = signalTree({
        internalCounter: 0,
        externalCounter: externalSignal,
        nested: {
          values: [1, 2, 3],
          config: {
            enabled: true,
            name: 'test',
          },
        },
      });

      expect(tree.$.internalCounter()).toBe(0);
      expect(tree.$.externalCounter()).toEqual({
        count: 10,
        label: 'external',
      });
      expect(tree.$.nested.values()).toEqual([1, 2, 3]);
    });
  });
});
