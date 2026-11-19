interface OwnerInvalidationDispatch {
  mark(ownerId: number | undefined): void;
  markFrom(owner: object): void;
  terminate(owner: object): void;
}

let dispatch: OwnerInvalidationDispatch | undefined;

export function installOwnerInvalidationDispatch(
  next: OwnerInvalidationDispatch
): void {
  dispatch = next;
}

export function markOwnerInvalidated(ownerId: number | undefined): void {
  dispatch?.mark(ownerId);
}

export function markOwnerInvalidatedFrom(owner: object): void {
  dispatch?.markFrom(owner);
}

export function terminateOwnerInvalidation(owner: object): void {
  dispatch?.terminate(owner);
}
