import { signalTree } from './signal-tree';

describe('SignalTree State Alias', () => {
  it('should support state alias for backward compatibility', () => {
    const tree = signalTree({ count: 0, user: { name: 'John' } });

    // Verify that tree.state and tree.$ are the same reference
    expect(tree.state).toBe(tree.$);

    // Verify both work the same way
    expect(tree.state.count()).toBe(0);
    expect(tree.$.count()).toBe(0);

    expect(tree.state.user.name()).toBe('John');
    expect(tree.$.user.name()).toBe('John');

    // Test updates work through both
    tree.state.count.set(5);
    expect(tree.$.count()).toBe(5);

    tree.$.user.name.set('Jane');
    expect(tree.state.user.name()).toBe('Jane');

    console.log('✅ State alias working perfectly!');
  });

  it('should maintain type safety with state alias', () => {
    interface UserState {
      id: number;
      profile: {
        name: string;
        email: string;
      };
    }

    const tree = signalTree<UserState>({
      id: 1,
      profile: {
        name: 'John',
        email: 'john@example.com',
      },
    });

    // Both should provide identical type safety
    expect(tree.state.profile.name()).toBe('John');
    expect(tree.$.profile.name()).toBe('John');

    // Updates through both should work
    tree.state.profile.email.set('john.doe@example.com');
    tree.$.id.set(123);

    expect(tree.state.profile.email()).toBe('john.doe@example.com');
    expect(tree.$.id()).toBe(123);
  });
});
