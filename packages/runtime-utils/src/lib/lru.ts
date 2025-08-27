export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private maxSize: number) {}
  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.delete(key);
    this.cache.set(key, value);
  }
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  clear(): void {
    this.cache.clear();
  }
  size(): number {
    return this.cache.size;
  }
}
