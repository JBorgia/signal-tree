/** Path-copy AVL index. Published nodes are never mutated. */
export interface SparseMapNode<T> {
  readonly key: string;
  readonly value: T;
  readonly left: SparseMapNode<T> | null;
  readonly right: SparseMapNode<T> | null;
  readonly height: number;
  readonly size: number;
}
export type SparseMap<T> = SparseMapNode<T> | null;
export function createMapTools(
  count: (name: "mapNodeVisits" | "mapNodeAllocations") => void
) {
  const height = <T>(n: SparseMap<T>): number => n?.height ?? 0;
  const size = <T>(n: SparseMap<T> | undefined): number => n?.size ?? 0;
  function node<T>(
    key: string,
    value: T,
    left: SparseMap<T> = null,
    right: SparseMap<T> = null
  ): SparseMapNode<T> {
    count("mapNodeAllocations");
    return {
      key,
      value,
      left,
      right,
      height: 1 + Math.max(height(left), height(right)),
      size: 1 + size(left) + size(right),
    };
  }
  function rotateLeft<T>(n: SparseMapNode<T>): SparseMapNode<T> {
    const r = n.right;
    if (!r) throw Error("Missing AVL right child");
    return node(r.key, r.value, node(n.key, n.value, n.left, r.left), r.right);
  }
  function rotateRight<T>(n: SparseMapNode<T>): SparseMapNode<T> {
    const l = n.left;
    if (!l) throw Error("Missing AVL left child");
    return node(l.key, l.value, l.left, node(n.key, n.value, l.right, n.right));
  }
  function balance<T>(n: SparseMapNode<T>): SparseMapNode<T> {
    const d = height(n.left) - height(n.right);
    if (d > 1) {
      if (!n.left) throw Error("Missing AVL left child");
      if (height(n.left.left) < height(n.left.right))
        n = node(n.key, n.value, rotateLeft(n.left), n.right);
      return rotateRight(n);
    }
    if (d < -1) {
      if (!n.right) throw Error("Missing AVL right child");
      if (height(n.right.right) < height(n.right.left))
        n = node(n.key, n.value, n.left, rotateRight(n.right));
      return rotateLeft(n);
    }
    return n;
  }
  function get<T>(n: SparseMap<T>, key: string): T | undefined {
    while (n) {
      count("mapNodeVisits");
      if (key === n.key) return n.value;
      n = key < n.key ? n.left : n.right;
    }
    return undefined;
  }
  function set<T>(n: SparseMap<T>, key: string, value: T): SparseMapNode<T> {
    if (!n) return node(key, value);
    count("mapNodeVisits");
    if (key === n.key) return node(key, value, n.left, n.right);
    return balance(
      key < n.key
        ? node(n.key, n.value, set(n.left, key, value), n.right)
        : node(n.key, n.value, n.left, set(n.right, key, value))
    );
  }
  function remove<T>(n: SparseMap<T>, key: string): SparseMap<T> {
    if (!n) return null;
    count("mapNodeVisits");
    if (key < n.key)
      return balance(node(n.key, n.value, remove(n.left, key), n.right));
    if (key > n.key)
      return balance(node(n.key, n.value, n.left, remove(n.right, key)));
    if (!n.left) return n.right;
    if (!n.right) return n.left;
    let next = n.right;
    while (next.left) {
      count("mapNodeVisits");
      next = next.left;
    }
    return balance(
      node(next.key, next.value, n.left, remove(n.right, next.key))
    );
  }
  function last<T>(n: SparseMap<T>): T | undefined {
    if (!n) return undefined;
    while (n.right) {
      count("mapNodeVisits");
      n = n.right;
    }
    count("mapNodeVisits");
    return n.value;
  }
  function* entries<T>(n: SparseMap<T>): Generator<readonly [string, T]> {
    if (!n) return;
    yield* entries(n.left);
    count("mapNodeVisits");
    yield [n.key, n.value];
    yield* entries(n.right);
  }
  function neighbor<T>(
    n: SparseMap<T>,
    key: string,
    direction: -1 | 1
  ): T | undefined {
    let found: T | undefined;
    while (n) {
      count("mapNodeVisits");
      if (direction < 0 ? n.key < key : n.key > key) {
        found = n.value;
        n = direction < 0 ? n.right : n.left;
      } else n = direction < 0 ? n.left : n.right;
    }
    return found;
  }
  function validate<T>(
    n: SparseMap<T>,
    min: string | null = null,
    max: string | null = null
  ): { height: number; size: number } {
    if (!n) return { height: 0, size: 0 };
    if ((min !== null && n.key <= min) || (max !== null && n.key >= max))
      throw Error("Invalid AVL order");
    const l = validate(n.left, min, n.key),
      r = validate(n.right, n.key, max);
    if (
      Math.abs(l.height - r.height) > 1 ||
      n.height !== 1 + Math.max(l.height, r.height) ||
      n.size !== 1 + l.size + r.size
    )
      throw Error("Invalid AVL balance/metadata");
    return { height: n.height, size: n.size };
  }
  return { get, set, remove, last, entries, size, validate, neighbor };
}
