import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { signalTree } from '@signal-tree';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  quantity: number;
}

interface ShoppingState {
  products: Product[];
  cart: Array<{ productId: string; quantity: number }>;
  filters: {
    category: string;
    priceRange: { min: number; max: number };
    inStockOnly: boolean;
    searchTerm: string;
  };
  ui: {
    showOnlyAffordable: boolean;
    budget: number;
  };
}

@Component({
  selector: 'app-computed-signals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './computed-signals.component.html',
  styleUrls: ['./computed-signals.component.scss'],
})
export class ComputedSignalsComponent {
  // Shopping cart with smart progressive enhancement
  shopTree = signalTree<ShoppingState>({
    products: [
      {
        id: '1',
        name: 'Laptop',
        price: 999,
        category: 'Electronics',
        inStock: true,
        quantity: 5,
      },
      {
        id: '2',
        name: 'Coffee Mug',
        price: 15,
        category: 'Kitchen',
        inStock: true,
        quantity: 20,
      },
      {
        id: '3',
        name: 'Wireless Headphones',
        price: 199,
        category: 'Electronics',
        inStock: false,
        quantity: 0,
      },
      {
        id: '4',
        name: 'Running Shoes',
        price: 89,
        category: 'Sports',
        inStock: true,
        quantity: 12,
      },
      {
        id: '5',
        name: 'Desk Chair',
        price: 299,
        category: 'Furniture',
        inStock: true,
        quantity: 3,
      },
      {
        id: '6',
        name: 'Water Bottle',
        price: 25,
        category: 'Sports',
        inStock: true,
        quantity: 15,
      },
    ],
    cart: [],
    filters: {
      category: '',
      priceRange: { min: 0, max: 1000 },
      inStockOnly: false,
      searchTerm: '',
    },
    ui: {
      showOnlyAffordable: false,
      budget: 500,
    },
  });

  computationLog: Array<{
    timestamp: Date;
    computation: string;
    result: unknown;
  }> = [];

  // Memoized computed values - auto-enabling feature!
  get filteredProducts() {
    return this.shopTree.memoize('filteredProducts', () => {
      this.logComputation(
        'Filtering products',
        'Starting filter computation...'
      );

      const products = this.shopTree.$.products();
      const filters = this.shopTree.$.filters();
      const ui = this.shopTree.$.ui();

      const filtered = products.filter((product) => {
        // Category filter
        if (filters.category && product.category !== filters.category)
          return false;

        // Price range filter
        if (
          product.price < filters.priceRange.min ||
          product.price > filters.priceRange.max
        )
          return false;

        // Stock filter
        if (filters.inStockOnly && !product.inStock) return false;

        // Search term filter
        if (
          filters.searchTerm &&
          !product.name.toLowerCase().includes(filters.searchTerm.toLowerCase())
        )
          return false;

        // Budget filter
        if (ui.showOnlyAffordable && product.price > ui.budget) return false;

        return true;
      });

      this.logComputation(
        'Filtering products',
        `Found ${filtered.length} matching products`
      );
      return filtered;
    });
  }

  get cartItems() {
    return this.shopTree.memoize('cartItems', () => {
      this.logComputation(
        'Computing cart items',
        'Calculating cart details...'
      );

      const cart = this.shopTree.$.cart();
      const products = this.shopTree.$.products();

      const items = cart
        .map((cartItem) => {
          const product = products.find((p) => p.id === cartItem.productId);
          return {
            ...cartItem,
            product,
            subtotal: product ? product.price * cartItem.quantity : 0,
          };
        })
        .filter((item) => item.product);

      this.logComputation(
        'Computing cart items',
        `${items.length} items in cart`
      );
      return items;
    });
  }

  get cartSummary() {
    return this.shopTree.memoize('cartSummary', () => {
      this.logComputation('Computing cart summary', 'Calculating totals...');

      const items = this.cartItems();

      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);
      const averageItemPrice = totalItems > 0 ? totalPrice / totalItems : 0;

      const summary = {
        totalItems,
        totalPrice,
        averageItemPrice,
        isEmpty: totalItems === 0,
        hasDiscount: totalPrice > 100, // Example business logic
        discountAmount: totalPrice > 100 ? totalPrice * 0.1 : 0,
      };

      this.logComputation(
        'Computing cart summary',
        `Total: $${summary.totalPrice}, Items: ${summary.totalItems}`
      );
      return summary;
    });
  }

  get categories() {
    return this.shopTree.memoize('categories', () => {
      this.logComputation(
        'Computing categories',
        'Extracting unique categories...'
      );

      const products = this.shopTree.$.products();
      const categories = [...new Set(products.map((p) => p.category))].sort();

      this.logComputation(
        'Computing categories',
        `Found ${categories.length} categories`
      );
      return categories;
    });
  }

  get productStats() {
    return this.shopTree.memoize('productStats', () => {
      this.logComputation(
        'Computing product stats',
        'Analyzing product data...'
      );

      const products = this.shopTree.$.products();

      const stats = {
        total: products.length,
        inStock: products.filter((p) => p.inStock).length,
        outOfStock: products.filter((p) => !p.inStock).length,
        averagePrice:
          products.reduce((sum, p) => sum + p.price, 0) / products.length,
        totalValue: products.reduce((sum, p) => sum + p.price * p.quantity, 0),
        mostExpensive: products.reduce(
          (max, p) => (p.price > max.price ? p : max),
          products[0]
        ),
        cheapest: products.reduce(
          (min, p) => (p.price < min.price ? p : min),
          products[0]
        ),
      };

      this.logComputation(
        'Computing product stats',
        `${stats.inStock}/${stats.total} products in stock`
      );
      return stats;
    });
  }

  // Regular Angular computed signals for comparison
  nonMemoizedFiltered = computed(() => {
    this.logComputation('NON-MEMOIZED filtering', 'Computing without cache...');

    const products = this.shopTree.$.products();
    const filters = this.shopTree.$.filters();

    const filtered = products.filter((product) => {
      if (filters.category && product.category !== filters.category)
        return false;
      if (
        product.price < filters.priceRange.min ||
        product.price > filters.priceRange.max
      )
        return false;
      return true;
    });

    this.logComputation(
      'NON-MEMOIZED filtering',
      `Found ${filtered.length} products (no cache)`
    );
    return filtered;
  });

  constructor() {
    this.logComputation('Component initialized', 'Computed signals ready');
  }

  // Filter actions
  updateCategory(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.shopTree.$.filters.category.set(target.value);
  }

  updateSearchTerm(event: Event) {
    const target = event.target as HTMLInputElement;
    this.shopTree.$.filters.searchTerm.set(target.value);
  }

  updatePriceRange(min: number, max: number) {
    this.shopTree.$.filters.priceRange.set({ min, max });
  }

  toggleInStockOnly() {
    this.shopTree.$.filters.inStockOnly.update((current) => !current);
  }

  toggleAffordableOnly() {
    this.shopTree.$.ui.showOnlyAffordable.update((current) => !current);
  }

  updateBudget(event: Event) {
    const target = event.target as HTMLInputElement;
    this.shopTree.$.ui.budget.set(Number(target.value));
  }

  // Cart actions
  addToCart(productId: string, quantity = 1) {
    const cart = this.shopTree.$.cart();
    const existingItem = cart.find((item) => item.productId === productId);

    if (existingItem) {
      this.shopTree.$.cart.set(
        cart.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      );
    } else {
      this.shopTree.$.cart.set([...cart, { productId, quantity }]);
    }
  }

  removeFromCart(productId: string) {
    this.shopTree.$.cart.set(
      this.shopTree.$.cart().filter((item) => item.productId !== productId)
    );
  }

  clearCart() {
    this.shopTree.$.cart.set([]);
  }

  // Reset filters
  resetFilters() {
    this.shopTree.$.filters.set({
      category: '',
      priceRange: { min: 0, max: 1000 },
      inStockOnly: false,
      searchTerm: '',
    });
    this.shopTree.$.ui.set({
      showOnlyAffordable: false,
      budget: 500,
    });
  }

  // Force recalculation to show cache benefits
  forceRecalculation() {
    // Clear cache to force fresh computation
    this.shopTree.clearCache();

    // Trigger all computations
    this.filteredProducts();
    this.cartItems();
    this.cartSummary();
    this.categories();
    this.productStats();
  }

  // Get cache metrics
  getCacheMetrics() {
    const metrics = this.shopTree.getMetrics();
    this.logComputation(
      'Cache metrics retrieved',
      `Hits: ${metrics.cacheHits}, Misses: ${metrics.cacheMisses}, Ratio: ${(
        (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) *
        100
      ).toFixed(1)}%`
    );
    return metrics;
  }

  private logComputation(computation: string, result: any) {
    this.computationLog.unshift({
      timestamp: new Date(),
      computation,
      result,
    });

    // Keep only last 20 entries
    if (this.computationLog.length > 20) {
      this.computationLog = this.computationLog.slice(0, 20);
    }
  }

  clearLog() {
    this.computationLog = [];
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByProductId(index: number, product: Product): string {
    return product.id;
  }

  codeExample = `// Memoized computed values with smart progressive enhancement
const shopTree = signalTree<ShoppingState>({
  products: [...],
  cart: [],
  filters: { category: '', priceRange: { min: 0, max: 1000 } }
});

// Memoized filtering - auto-enabling feature!
const filteredProducts = shopTree.memoize('filteredProducts', () => {
  const products = shopTree.$.products();
  const filters = shopTree.$.filters();

  return products.filter(product => {
    if (filters.category && product.category !== filters.category) return false;
    if (product.price < filters.priceRange.min) return false;
    return true;
  });
});

// Computed cart totals with dependency tracking
const cartSummary = shopTree.memoize('cartSummary', () => {
  const cart = shopTree.$.cart();
  const products = shopTree.$.products();

  return cart.reduce((summary, item) => {
    const product = products.find(p => p.id === item.productId);
    return {
      ...summary,
      totalItems: summary.totalItems + item.quantity,
      totalPrice: summary.totalPrice + (product?.price || 0) * item.quantity
    };
  }, { totalItems: 0, totalPrice: 0 });
});

// Efficient cache management
console.log(filteredProducts()); // First computation (cache miss)
console.log(filteredProducts()); // Served from cache (cache hit)

// Automatic invalidation on dependency changes
shopTree.$.filters.category.set('Electronics'); // Invalidates filteredProducts
console.log(filteredProducts()); // Fresh computation with new filter

// Cache efficiency monitoring
const metrics = shopTree.getMetrics();
console.log(\`Cache hit ratio: \${(metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(1)}%\`);`;
}
