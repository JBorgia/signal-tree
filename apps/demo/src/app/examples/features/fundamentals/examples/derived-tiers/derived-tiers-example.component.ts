import { Component, computed, ChangeDetectionStrategy } from '@angular/core';
import { entityMap, signalTree, type TreeNode } from '@signal-tree/angular';

import { ExampleComponent } from '../../../../shared/components/example-shell';

// =============================================================================
// EXAMPLE 1: INLINE DERIVED (Simple - Types inferred automatically)
// =============================================================================

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  active: boolean;
}

/**
 * When derived functions are INLINE, TypeScript infers everything automatically.
 * No special utilities needed - this is the simplest approach for small trees.
 */
function createInlineTree() {
  return signalTree(
    {
      users: entityMap<User, number>(),
      selectedUserId: null as number | null,
    },
    {
      derived: ($) => {
        const selectedUser = computed(() => {
          const id = $.selectedUserId();
          return id != null ? $.users.byId(id)?.() ?? null : null;
        });
        return {
          selectedUser,
          isAdmin: computed(() => selectedUser()?.role === 'admin'),
          displayName: computed(() => {
            const user = selectedUser();
            return user ? `${user.name} (${user.email})` : 'No user selected';
          }),
        };
      },
    }
  );
}

// =============================================================================
// EXAMPLE 2: EXTRACTED HELPERS
// =============================================================================

/**
 * Larger applications can extract ordinary signal-producing helpers while
 * keeping one derived factory at the construction site.
 */

// Step 1: Define base state factory
function createExternalBaseState() {
  return {
    products: entityMap<Product, number>(),
    cart: {
      items: [] as CartItem[],
    },
    selectedProductId: null as number | null,
  };
}

// Step 2: Type the extracted helper from the state shape
type ExternalState = ReturnType<typeof createExternalBaseState>;

const externalDerived = ($: TreeNode<ExternalState>) => {
  const selectedProduct = computed(() => {
    const id = $.selectedProductId();
    return id != null ? $.products.byId(id)?.() ?? null : null;
  });
  const cartTotal = computed(() => {
    return $.cart
      .items()
      .reduce(
        (sum: number, item: CartItem) => sum + item.price * item.quantity,
        0
      );
  });
  return {
    selectedProduct,
    cartTotal,
    isSelectedInCart: computed(() => {
      const product = selectedProduct();
      return product
        ? $.cart.items().some((item: CartItem) => item.productId === product.id)
        : false;
    }),
    formattedTotal: computed(() => `$${cartTotal().toFixed(2)}`),
  };
};

// Step 5: Assemble the tree
function createExternalTree() {
  return signalTree(createExternalBaseState(), {
    derived: externalDerived,
  });
}

// =============================================================================
// SUPPORTING TYPES
// =============================================================================

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

// =============================================================================
// DEMO COMPONENT
// =============================================================================

@Component({
  selector: 'app-derived-tiers-example',
  standalone: true,
  imports: [ExampleComponent],
  template: `
    <st-example heading="Derived State Example">
      <div intro>
        <h4>💡 Key Point</h4>
        <p>
          Declare one derived factory in <code>signalTree</code>. Compose its
          values with local <code>computed</code> references.
        </p>
      </div>

      <section class="example-section">
        <h3>Example 1: Inline Derived (Simple)</h3>
        <p class="description">
          When derived functions are inline, TypeScript automatically infers all
          types. This is the simplest approach for smaller state trees.
        </p>

        <div class="demo-area">
          <div class="users-list">
            <h4>Users</h4>
            @for (user of users(); track user.id) {
            <button
              [class.selected]="user.id === inlineTree.$.selectedUserId()"
              (click)="selectUser(user.id)"
            >
              {{ user.name }} ({{ user.role }})
            </button>
            }
          </div>

          <div class="selection-info">
            <p><strong>Selected:</strong> {{ displayName() }}</p>
            <p><strong>Is Admin:</strong> {{ isAdmin() ? 'Yes' : 'No' }}</p>
          </div>
        </div>
      </section>

      <section class="example-section">
        <h3>Example 2: Extracted Helper</h3>
        <p class="description">
          Larger apps can extract ordinary typed helpers while keeping the
          singular derived factory at the construction site.
        </p>

        <div class="demo-area">
          <div class="products-list">
            <h4>Products</h4>
            @for (product of products(); track product.id) {
            <div class="product-item">
              <span>{{ product.name }} - \${{ product.price }}</span>
              <button (click)="selectProduct(product.id)">Select</button>
              <button (click)="addToCart(product)">Add to Cart</button>
            </div>
            }
          </div>

          <div class="cart-info">
            <p>
              <strong>Selected Product:</strong> {{ selectedProductName() }}
            </p>
            <p>
              <strong>In Cart:</strong> {{ isSelectedInCart() ? 'Yes' : 'No' }}
            </p>
            <p><strong>Cart Total:</strong> {{ formattedTotal() }}</p>
          </div>
        </div>
      </section>
    </st-example>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .example-section {
        margin: 1.5rem 0;
        padding: 1rem;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
      }

      .description {
        color: #666;
        margin-bottom: 1rem;
      }

      .demo-area {
        display: flex;
        gap: 2rem;
        flex-wrap: wrap;
      }

      .users-list button,
      .product-item button {
        display: block;
        margin: 0.25rem 0;
        padding: 0.5rem 1rem;
        cursor: pointer;
      }

      .users-list button.selected {
        background: #4a90d9;
        color: white;
      }

      .product-item {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin: 0.5rem 0;
      }

      .selection-info,
      .cart-info {
        padding: 1rem;
        background: #f5f5f5;
        border-radius: 4px;
      }

      code {
        background: #e8e8e8;
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-family: monospace;
      }
    `,
  ],
})
export class DerivedTiersExampleComponent {
  // Example 1: Inline tree
  readonly inlineTree = createInlineTree();

  // Example 2: External tree
  readonly externalTree = createExternalTree();

  // Sample data
  private readonly sampleUsers: User[] = [
    {
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      role: 'admin',
      active: true,
    },
    {
      id: 2,
      name: 'Bob',
      email: 'bob@example.com',
      role: 'user',
      active: true,
    },
    {
      id: 3,
      name: 'Charlie',
      email: 'charlie@example.com',
      role: 'guest',
      active: false,
    },
  ];

  private readonly sampleProducts: Product[] = [
    { id: 1, name: 'Laptop', price: 999.99, category: 'Electronics' },
    { id: 2, name: 'Mouse', price: 29.99, category: 'Electronics' },
    { id: 3, name: 'Keyboard', price: 79.99, category: 'Electronics' },
  ];

  constructor() {
    // Initialize data
    this.inlineTree.$.users.setAll(this.sampleUsers);
    this.externalTree.$.products.setAll(this.sampleProducts);
  }

  // Expose signals for template
  readonly users = computed(() => this.inlineTree.$.users.all());
  readonly displayName = this.inlineTree.$.displayName;
  readonly isAdmin = this.inlineTree.$.isAdmin;

  readonly products = computed(() => this.externalTree.$.products.all());
  readonly selectedProductName = computed(
    () => this.externalTree.$.selectedProduct()?.name ?? 'None'
  );
  readonly isSelectedInCart = this.externalTree.$.isSelectedInCart;
  readonly formattedTotal = this.externalTree.$.formattedTotal;

  // Actions
  selectUser(id: number) {
    this.inlineTree.$.selectedUserId.set(id);
  }

  selectProduct(id: number) {
    this.externalTree.$.selectedProductId.set(id);
  }

  addToCart(product: Product) {
    this.externalTree.$.cart.items.update((items) => [
      ...items,
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
      },
    ]);
  }
}
