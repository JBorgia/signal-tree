import { describe, it } from 'vitest';

import {
  asValue,
  type Location,
} from './tree-location';

/**
 * THE STATE TYPE DEFINES ITS OWN STRICTNESS.
 * THE MUTATION API MUST NOT WEAKEN IT.
 *
 * ⚠️ THE VALUE PARAMETER IS `T`, NEVER `Partial<T>`. Measured during
 * GREENFIELD-BRANCH-WRITE-0: weakening it to `Partial<T>` removes ALL THREE
 * strictness rejections below. The third is the sharpest — an author's own
 * `{ name: string; age?: number }` loses its `name` requirement too, so
 * `Partial<T>` does not add convenience on top of the author's model, it erases
 * a distinction the author explicitly drew.
 *
 * Every `@ts-expect-error` here is load-bearing: an UNUSED directive is itself a
 * compile error, so a rejection that silently stops firing fails this file.
 */

interface User {
  name: string;
  age: number;
}

describe('location typing — the author owns strictness', () => {
  it('compiles', () => {
    // STRICT: the author declared `User`, so a whole `User` is required.
    const strict = null as unknown as Location<User>;
    strict({ name: 'Dave', age: 42 });
    strict((current) => ({ ...current, name: 'Dave' })); // patch IS a derive
    // @ts-expect-error the author declared User strict; the API must not weaken it
    strict({ name: 'Dave' });

    // DELIBERATELY PARTIAL: a partial object IS a complete value of this type.
    const partial = null as unknown as Location<Partial<User>>;
    partial({ name: 'Dave' });
    partial({});

    // OPTIONAL MEMBER: the author's own distinction is preserved exactly.
    const optional = null as unknown as Location<{ name: string; age?: number }>;
    optional({ name: 'Dave' });
    // @ts-expect-error `name` is required by the author's type
    optional({ age: 42 });

    // ENTITY PARITY: same grammar, same meaning, no special case.
    interface Row {
      id: number;
      name: string;
      note?: string;
    }
    const row = null as unknown as Location<Row>;
    row({ id: 1, name: 'b' });
    // @ts-expect-error a partial Row is not a Row
    row({ name: 'b' });

    // CALLABLES are excluded from the ordinary-value overload.
    const handler = () => undefined;
    const cb = null as unknown as Location<null | (() => void)>;
    cb(null);
    cb(asValue(handler));
    cb((current) => current);
    // @ts-expect-error a naked callable is DERIVE, and this is not a valid updater
    cb(handler);

    // CONSTRUCTORS too — `typeof Thing` is NOT callable without `new`, so a
    // call-signature-only exclusion would let it through the value overload
    // while the runtime classifies DERIVE and throws.
    class Thing {}
    const ctor = null as unknown as Location<typeof Thing | null>;
    ctor(null);
    ctor(asValue(Thing));
    // @ts-expect-error a bare class must not typecheck as a whole-value assignment
    ctor(Thing);

    // ⚠️ AN AMBIGUITY ESCAPE MUST NOT ACCEPT VALUES THAT ARE NOT AMBIGUOUS.
    // A non-callable already has an unambiguous whole-value spelling, so the
    // escape is bounded to exactly the values the runtime would misread.
    asValue(handler);
    asValue(Thing);
    // @ts-expect-error a number is not ambiguous — `location(42)` already says this
    asValue(42);
    // @ts-expect-error a plain object is not ambiguous either
    asValue({ x: 1 });
    // @ts-expect-error nor is a string
    asValue('nope');

    // A location whose value is ITSELF updater-shaped still resolves by
    // ARGUMENT SHAPE, never by the stored value.
    const transform = null as unknown as Location<(n: number) => number>;
    transform(asValue((n: number) => n * 2));
    transform((current) => (n) => current(n) + 1);
    // @ts-expect-error `double` takes a number; an updater receives the function
    transform((n: number) => n * 2);
  });
});
