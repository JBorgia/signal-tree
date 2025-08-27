const MAX_CACHE_SIZE = 1000;
import { LRUCache } from './lru';

const pathCache = new LRUCache<string, string[]>(MAX_CACHE_SIZE);

export function parsePath(path: string): string[] {
  const cached = pathCache.get(path);
  if (cached) return cached;
  const parts = path.split('.');
  pathCache.set(path, parts);
  return parts;
}

export function clearParsePathCache(): void {
  pathCache.clear();
}
