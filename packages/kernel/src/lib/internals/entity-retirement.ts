/** Retirement candidates are delivery facts, not permission to reclaim. */
export interface EntityRetirement {
  readonly owner: number;
  readonly subjects: readonly number[];
}

type Frame = Map<number, Set<number>>;
interface Observer {
  readonly run: (events: readonly EntityRetirement[]) => void;
  readonly frames: Frame[];
}
const observers = new WeakMap<object, Observer>();

export function setEntityRetirementObserver(
  runtime: object,
  run: Observer['run']
): () => void {
  if (observers.has(runtime))
    throw new Error('Retirement observer already installed');
  const observer: Observer = { run, frames: [] };
  observers.set(runtime, observer);
  return () => {
    if (observers.get(runtime) === observer) observers.delete(runtime);
  };
}

export function notifyEntityRetirement(
  runtime: object | undefined,
  owner: number | undefined,
  subjects: readonly number[]
): void {
  const observer = runtime && observers.get(runtime);
  if (!observer || owner === undefined || !subjects.length) return;
  const frame = observer.frames.at(-1);
  if (!frame) {
    observer.run([{ owner, subjects }]);
    return;
  }
  let retired = frame.get(owner);
  if (!retired) frame.set(owner, (retired = new Set()));
  for (const subject of subjects) retired.add(subject);
}

/**
 * Finish mutation publication before offering retirement candidates. Consumers
 * must still validate sparse responsibility, restoration claims and native
 * revisions. Reclamation never replaces an earlier publication/callback error.
 */
export function withEntityRetirementScope<R>(
  runtime: object | undefined,
  run: () => R
): R {
  const observer = runtime && observers.get(runtime);
  if (!observer) return run();
  const frame: Frame = new Map();
  observer.frames.push(frame);
  let failed = false;
  let first: unknown;
  let result!: R;
  try {
    result = run();
  } catch (error) {
    failed = true;
    first = error;
  } finally {
    observer.frames.pop();
  }
  try {
    if (frame.size)
      observer.run(
        [...frame].map(([owner, subjects]) => ({
          owner,
          subjects: [...subjects],
        }))
      );
  } catch (error) {
    if (!failed) {
      failed = true;
      first = error;
    }
  }
  if (failed) throw first;
  return result;
}
