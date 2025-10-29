export function serialize<T>(value: T): string {
  return JSON.stringify(value);
}

export function deserialize<T>(raw: string): T {
  return JSON.parse(raw) as T;
}
