import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnDestroy,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  entityMap,
  type EntityMapMarker,
  signalTree,
} from '@signal-tree/angular';

type Availability = 'available' | 'reserved';
type InventoryFilter = 'all' | Availability;

interface Product {
  id: number;
  sku: string;
  name: string;
  availability: Availability;
  location: string;
}

interface InventoryState {
  products: EntityMapMarker<Product, number>;
}

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 1,
    sku: 'LMP-014',
    name: 'Desk lamp',
    availability: 'available',
    location: 'A-01',
  },
  {
    id: 2,
    sku: 'CAB-220',
    name: 'Archive cabinet',
    availability: 'reserved',
    location: 'B-12',
  },
  {
    id: 3,
    sku: 'NTB-008',
    name: 'Field notebook',
    availability: 'available',
    location: 'A-04',
  },
  {
    id: 4,
    sku: 'CBL-031',
    name: 'Cable organizer',
    availability: 'available',
    location: 'C-07',
  },
];

const createInventoryTree = () => {
  const tree = signalTree<InventoryState>({
    products: entityMap<Product, number>({
      selectId: (product) => product.id,
    }),
  });

  tree.$.products.addMany(INITIAL_PRODUCTS.map((product) => ({ ...product })));
  return tree;
};

@Component({
  selector: 'app-entities-demo',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './entities-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './entities-demo.component.scss',
})
export class EntitiesDemoComponent implements OnDestroy {
  readonly store = createInventoryTree();
  readonly filter = signal<InventoryFilter>('all');
  readonly selectedProductId = signal<number | null>(1);
  readonly blockedOperation = signal<string | null>(null);
  readonly lastEvent = signal('No committed mutations yet');

  newProductName = '';

  private readonly availableProducts = this.store.$.products.where(
    (product) => product.availability === 'available'
  );
  private readonly reservedProducts = this.store.$.products.where(
    (product) => product.availability === 'reserved'
  );

  readonly visibleProducts = computed(() => {
    switch (this.filter()) {
      case 'available':
        return this.availableProducts();
      case 'reserved':
        return this.reservedProducts();
      default:
        return this.store.$.products.all();
    }
  });

  readonly availableCount = computed(() => this.availableProducts().length);
  readonly heldProduct = this.store.$.products.byIdOrFail(1);
  readonly selectedProduct = computed(() => {
    const id = this.selectedProductId();
    return id === null ? undefined : this.store.$.products.byId(id)?.();
  });

  private nextProductId = 5;
  private readonly teardownHooks = [
    this.store.$.products.intercept({
      onAdd: (product, context) => {
        const normalizedName = product.name.trim();
        if (!normalizedName) {
          this.blockedOperation.set('Rejected before commit: blank name');
          context.block('Product name cannot be blank');
          return;
        }

        if (normalizedName !== product.name) {
          context.transform({ ...product, name: normalizedName });
        }
      },
      onUpdate: (id, changes, context) => {
        if (changes.name !== undefined && !changes.name.trim()) {
          this.blockedOperation.set(
            `Rejected before commit: product ${id} would have a blank name`
          );
          context.block('Product name cannot be blank');
        }
      },
    }),
    this.store.$.products.tap({
      onAdd: (product) => {
        this.blockedOperation.set(null);
        this.lastEvent.set(
          `Added ${product.name} after commit (${this.store.$.products.count()} total)`
        );
      },
      onUpdate: (_id, _changes, product) => {
        this.blockedOperation.set(null);
        this.lastEvent.set(`Updated ${product.name} after commit`);
      },
      onRemove: (_id, product) => {
        this.blockedOperation.set(null);
        this.lastEvent.set(`Removed ${product.name} after commit`);
      },
    }),
  ];

  setFilter(filter: InventoryFilter): void {
    this.filter.set(filter);
  }

  selectProduct(id: number): void {
    this.selectedProductId.set(id);
  }

  renameAnchorProduct(): void {
    this.store.$.products.updateOne(1, { name: 'Desk lamp, revised' });
  }

  toggleAvailability(id: number): void {
    const product = this.store.$.products.byId(id)?.();
    if (!product) return;

    this.store.$.products.updateOne(id, {
      availability:
        product.availability === 'available' ? 'reserved' : 'available',
    });
  }

  addProduct(): void {
    const added = this.tryAddProduct({
      id: this.nextProductId,
      sku: `NEW-${String(this.nextProductId).padStart(3, '0')}`,
      name: this.newProductName,
      availability: 'available',
      location: 'INBOX',
    });

    if (added) {
      this.nextProductId++;
      this.newProductName = '';
    }
  }

  tryRejectedAdd(): void {
    this.tryAddProduct({
      id: this.nextProductId,
      sku: `NEW-${String(this.nextProductId).padStart(3, '0')}`,
      name: '   ',
      availability: 'available',
      location: 'INBOX',
    });
  }

  private tryAddProduct(product: Product): boolean {
    const countBefore = this.store.$.products.count();
    try {
      this.store.$.products.addOne(product);
    } catch {
      return false;
    }
    return this.store.$.products.count() > countBefore;
  }

  removeProduct(id: number): void {
    this.store.$.products.removeOne(id);
    if (this.selectedProductId() === id) {
      this.selectedProductId.set(null);
    }
  }

  resetCatalog(): void {
    this.store.$.products.setAll(
      INITIAL_PRODUCTS.map((product) => ({ ...product }))
    );
    this.filter.set('all');
    this.selectedProductId.set(1);
    this.blockedOperation.set(null);
    this.lastEvent.set('Catalog reset to its four source records');
    this.nextProductId = 5;
  }

  ngOnDestroy(): void {
    for (const teardown of this.teardownHooks) {
      teardown();
    }
    this.store.destroy();
  }
}
