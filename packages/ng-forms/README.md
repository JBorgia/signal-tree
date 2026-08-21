# @signaltree/ng-forms

<!-- measured: gzip of the package's own emitted chunks in dist/packages/ng-forms/dist, excluding tslib; the exact command is shown below. Not produced by a tools/ script because no per-package size generator exists — tools/size-report.mjs covers core scenarios only. -->

**Angular `FormGroup` bridge backed by SignalTree state**. Adds reactive forms integration, conditional fields, validation, persistence, and form state tracking.

**Bundle size:** the package's own code is **12.15 KB gzip** across its 19
chunks. What you actually pay is less and depends on which entry points you
import, because the package is chunked per feature — importing the root bridge
does not pull in every implementation chunk.

```sh
find dist/packages/ng-forms/dist -name '*.js' ! -name 'tslib*' \
  | xargs cat | gzip -9 -c | wc -c
```

This line previously read "3.38KB gzipped" with no statement of what was
measured. A single number here cannot be right for every import shape, so it
is stated as a ceiling with the method beside it.

## Architecture: createFormTree()

`createFormTree()` creates a SignalTree-backed Angular `FormGroup`:

```
@signaltree/core                    @signaltree/ng-forms
┌─────────────────────────┐         ┌─────────────────────────┐
│ signalTree()            │         │ createFormTree()        │
│ ─────────────────────── │   ───►  │ enhancer that:          │
│ • Tree-backed values    │         │ • Creates FormGroup     │
│ • Writable leaves       │         │ • Bidirectional sync    │
│ • JSON-shaped state     │         │ • Conditional fields    │
│                         │         │ • Angular validators    │
└─────────────────────────┘
```

(`withFormHistory()` in `@signaltree/ng-forms` still exists but is
`@deprecated` since v13 — scoped to the legacy `createFormTree()`/`FormGroup`
substrate. See "Form history snapshots" below.)

**Key insight**: `ng-forms` is the Angular adapter. It should not define core
state semantics; it connects Angular forms to SignalTree-backed values.

## Quick Start

### SignalTree-backed FormGroup pattern

```typescript
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { createFormTree, ngFormValidators } from '@signaltree/ng-forms';

@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="profile.form">
      <input formControlName="name" />
      <input formControlName="email" />
    </form>
  `,
})
class ProfileComponent {
  profile = createFormTree({ name: '', email: '' }, { fieldConfigs: { email: { validators: [ngFormValidators.email()] } } });
}
```

## When to Use Each Layer

### `createFormTree()`

```typescript
import { createFormTree, ngFormValidators } from '@signaltree/ng-forms';

const login = createFormTree({ email: '', password: '' }, { fieldConfigs: { email: { validators: [ngFormValidators.email()] } } });

login.$.email.set('user@test.com');
login.valid();
await login.validate();
```

**Use when**: Need Angular `[formGroup]` directives, Angular validators,
conditional field disabling, and bidirectional form/state sync.

### `trackHistory()` — undo/redo for a signal model

```typescript
import { signal, WritableSignal } from '@angular/core';
import { trackHistory } from '@signaltree/core';

const model: WritableSignal<{ content: string }> = signal({ content: '' });
const editor = trackHistory(model, { capacity: 50 });

editor.undo();
editor.redo();
editor.canUndo();
```

**Use when**: Complex editors or custom Angular forms where the model is already
a writable signal.

## Installation

```bash
pnpm add @signaltree/core @signaltree/ng-forms
```

> **Compatibility**: Angular 20+ with TypeScript 5.5+ for the classic package; Angular 22+ for the `@signaltree/ng-forms/signals` subpath (stable Signal Forms bridges). Works alongside Angular's native Signal Forms—use both where appropriate.

## Quick start

```typescript
import { Component } from '@angular/core';
import { createFormTree, ngFormValidators } from '@signaltree/ng-forms';

@Component({
  selector: 'app-profile-form',
  template: `
    <form [formGroup]="profile.form" (ngSubmit)="save()">
      <input formControlName="name" placeholder="Name" />
      <span class="error" *ngIf="profile.getFieldError('name')()">
        {{ profile.getFieldError('name')() }}
      </span>

      <input formControlName="email" placeholder="Email" />
      <span class="error" *ngIf="profile.getFieldError('email')()">
        {{ profile.getFieldError('email')() }}
      </span>

      <label> <input type="checkbox" formControlName="marketing" /> Email marketing </label>

      <button type="submit" [disabled]="profile.valid() === false">
        {{ profile.submitting() ? 'Saving...' : 'Save profile' }}
      </button>
    </form>

    <pre>Signals: {{ profile.$.name() }} / {{ profile.$.email() }}</pre>
  `,
})
export class ProfileFormComponent {
  private storage = typeof window !== 'undefined' ? window.localStorage : undefined;

  // Type is inferred from initial values - no interface needed!
  profile = createFormTree(
    {
      name: '',
      email: '',
      marketing: false,
    },
    {
      persistKey: 'profile-form',
      storage: this.storage,
      fieldConfigs: {
        name: { validators: [ngFormValidators.required('Name is required')] },
        email: {
          validators: [ngFormValidators.required(), ngFormValidators.email()],
          debounceMs: 150,
        },
      },
    }
  );

  async save() {
    await this.profile.submit(async (values) => {
      // values is typed as { name: string; email: string; marketing: boolean }
      console.log('Saving profile', values);
    });
  }
}
```

The returned `FormTree` exposes:

- `form`: Angular `TypedFormGroup<T>` for templates and directives (fully typed!)
- `$` / `state`: signal-backed access to individual fields
- `errors`, `asyncErrors`, `valid`, `dirty`, `submitting`: writable signals for UI state
- Helpers such as `setValue`, `setValues`, `reset`, `validate`, and `submit`

## Type Inference

`createFormTree()` leverages recursive type inference—types flow from initial values:

```typescript
// ✅ Simple case: types inferred automatically
const form = createFormTree({
  name: '', // string
  age: 0, // number
  active: false, // boolean
});

form.$.name(); // string
form.$.age(); // number
form.form.controls.name; // FormControl<string>
```

### Union Types Need Assertions

When a field can be one of several specific values, TypeScript widens the inferred type to `string`. Use inline type assertions to preserve narrowness:

```typescript
// ❌ Without assertion: resolution is inferred as string
const form = createFormTree({
  resolution: 'PENDING', // Inferred as string, not the union
});

// ✅ With assertion: resolution is the exact union type
const form = createFormTree({
  resolution: 'PENDING' as 'PENDING' | 'APPROVED' | 'REJECTED',
  category: null as CategoryType | null,
  items: [] as string[],
});
```

### TypedFormGroup

The `form` property returns `TypedFormGroup<T>`, which recursively maps your form shape to Angular controls:

```typescript
type TypedFormGroup<T> = FormGroup<{
  [K in keyof T]: T[K] extends unknown[]
    ? FormArray<FormControl<T[K][number]>>
    : T[K] extends object
      ? FormGroup<...>  // Nested objects become nested FormGroups
      : FormControl<T[K]>
}>;

// Result: full autocomplete and type checking
const form = createFormTree({ user: { name: '', email: '' } });
form.form.controls.user.controls.name.value;  // string
```

## Core capabilities

- **Signal-synced forms**: Bidirectional sync between Angular FormControls and SignalTree signals
- **Per-field configuration**: Debounce, sync & async validators, and wildcard matcher support
- **Conditional fields**: Enable/disable controls based on dynamic predicates
- **Persistence**: Keep form state in `localStorage`, IndexedDB, or custom storage with debounced writes
- **Validation batching**: Aggregate touched/errors updates to avoid jitter in large forms
- **Legacy wizard & history helpers** (`createWizardForm`, `withFormHistory`, both `@deprecated` since v13): multi-step flows and undo/redo stacks for `createFormTree()`. For new code, prefer the `form()` marker's built-in `wizard` config and `@signaltree/core`'s `history()` — both `signalForm()`-compatible.
- **Signal ↔ Observable bridge**: Convert signals to RxJS streams for interoperability
- **Template-driven adapter**: `SignalValueDirective` bridges standalone signals with `ngModel`

## Angular 22 Interoperability

**ng-forms complements Angular 22's native Signal Forms**—use both in the same app. As of v11.5, `@signaltree/ng-forms/signals` also bridges the two directly, so you don't have to choose between them for a given field:

### Use Angular 22 `FormField<T>` for:

- ✅ Simple, flat forms (login, search)
- ✅ Single-field validation
- ✅ Maximum type safety

### Use ng-forms `createFormTree()` for:

- ✅ Nested object structures (user + address + payment)
- ✅ Forms with persistence/auto-save
- ✅ Wizard/multi-step flows
- ✅ History/undo requirements
- ✅ Complex conditional logic
- ✅ Migration from reactive forms

### Hybrid Example: Simple Fields + Complex Tree

```typescript
import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createFormTree } from '@signaltree/ng-forms';

@Component({ imports: [FormField], ... })
class CheckoutComponent {
  // Simple field: Use Angular 22 native Signal Forms
  promoCode = form(signal(''));

  // Complex nested state: Use ng-forms
  checkout = createFormTree({
    shipping: { name: '', address: '', city: '', zip: '' },
    payment: { card: '', cvv: '', expiry: '' },
    items: [] as CartItem[]
  }, {
    persistKey: 'checkout-draft',
    fieldConfigs: {
      'shipping.zip': { validators: [(v) => /^\d{5}$/.test(String(v)) ? null : 'Invalid ZIP'] },
      'payment.card': { validators: [(v) => /^\d{13,19}$/.test(String(v)) ? null : 'Invalid card'], debounceMs: 300 }
    }
  });

  // Both work together seamlessly
}
```

Template: `<input [formField]="promoCode" />` alongside the ng-forms-driven `checkout` fields.

### Signal Forms

The previous `@signaltree/ng-forms/signals` bridge is not part of the current
published surface. Use Angular's native Signal Forms directly for signal-native
forms, or use `createFormTree()` when you need `FormGroup` interop.

```typescript
import { disabled, schema, validate } from '@angular/forms/signals';

const profileSchema = schema<Profile>((p) => {
  disabled(p.email, () => true);
  validate(p.name, (ctx) => (ctx.value() ? undefined : { kind: 'required', message: 'Required' }));
});

const fieldTree = signalForm(tree.$.profile, { injector, schema: profileSchema });
```

The `[ST2005]` guard above is about the MARKER'S OWN `asyncValidators`
specifically — a marker with no async config, paired with a schema that
declares `validateAsync`, is the supported shape: the schema is the only
async authority, so there's no disagreement to guard against.

`signalForm`'s options also forward `name`, `submission`, and
`experimentalWebMcpTool` verbatim to Angular's `form(model, schema, options)`
(v13.1+) — including exposing the form as a WebMCP AI-agent tool (pair with
Angular's `provideExperimentalWebMcpForms()`):

```typescript
const fieldTree = signalForm(tree.$.profile, {
  injector,
  name: 'profileForm',
  experimentalWebMcpTool: { name: 'profileTool', description: 'Edit the user profile' },
});
```

### StandardSchema validation: Angular's own, over published tree state

SignalTree ships **no validation API**. A plain subtree is published with
`toWritableSignal()`, Angular's own `form()` composes over it, and Angular's own
`validateStandardSchema` runs the schemas your application already owns:

```typescript
import { form, validateStandardSchema } from '@angular/forms/signals';
import { signalTree, toWritableSignal } from '@signaltree/core';
import { z } from 'zod';

const tree = signalTree({ user: { name: '', email: '' } });

const userForm = form(
  toWritableSignal(tree.$.user),
  (u) => {
    validateStandardSchema(u.name, z.string().min(2));
    validateStandardSchema(u.email, z.string().email());
  },
  { injector }
);
```

SignalTree owns the truth, Angular owns the observation, and your validator does
the judging. Use Angular's Signal Forms directly for signal-native form models,
or `createFormTree()` for classic `FormGroup` interop.

### Bridging classic Reactive Forms

Angular has **no** `FormControl.connect(signal)` API — signal↔reactive interop
is a separate, constructor-based primitive (`SignalFormControl`, Angular 21.2+).
SignalTree gives you two supported paths instead:

- **Classic `FormGroup`** backed by tree state — use `createFormTree` (or the
  lower-level `SignalValueDirective`). These build a real `FormGroup` and keep
  it in sync with the tree.
- **Angular Signal Forms `FieldTree`** — use Angular's native Signal Forms APIs
  directly.

Reach for the second unless you must interoperate with existing classic
Reactive Forms code.

## Form tree configuration

```typescript
const checkout = createFormTree(initialState, {
  validators: {
    'shipping.zip': (value) => (/^[0-9]{5}$/.test(String(value)) ? null : 'Enter a valid ZIP code'),
  },
  asyncValidators: {
    'account.email': async (value) => ((await emailService.isTaken(value)) ? 'Email already used' : null),
  },
  fieldConfigs: {
    'payment.card.number': { debounceMs: 200 },
    'preferences.*': { validators: [ngFormValidators.required()] },
  },
  conditionals: [
    {
      when: (values) => values.shipping.sameAsBilling,
      fields: ['shipping.address', 'shipping.city', 'shipping.zip'],
    },
  ],
  persistKey: 'checkout-draft',
  storage: sessionStorage,
  persistDebounceMs: 500,
  validationBatchMs: 16,
});
```

- `validators` / `asyncValidators`: Map paths (supports `*` globs) to declarative validation functions
- `fieldConfigs`: Attach validators and per-field debounce without scattering logic
- `conditionals`: Automatically disable controls when predicates fail
- `persistKey` + `storage`: Load persisted values on creation and auto-save thereafter
- `validationBatchMs`: Batch aggregate signal updates when running lots of validators at once

## Wizard flows

`createWizardForm` is retained for existing `createFormTree` users:

```typescript
import { createWizardForm, FormStep } from '@signaltree/ng-forms';

const steps: FormStep<AccountSetup>[] = [
  {
    fields: ['profile.name', 'profile.email'],
    validate: async (form) => {
      await form.validate('profile.email');
      return !form.getFieldError('profile.email')();
    },
  },
  {
    fields: ['security.password', 'security.confirm'],
  },
];

const wizard = createWizardForm(steps, initialValues, {
  conditionals: [
    {
      when: ({ marketingOptIn }) => marketingOptIn,
      fields: ['preferences.frequency'],
    },
  ],
});

await wizard.nextStep();
wizard.previousStep();
wizard.currentStep(); // readonly signal
wizard.isFieldVisible('preferences.frequency')();
```

Wizard forms reuse the same `form` instance and `FormTree` helpers, adding `currentStep`, `nextStep`, `previousStep`, `goToStep`, and `isFieldVisible` helpers for UI state.

## Form history snapshots

`withFormHistory` (below) is `@deprecated` since v13 — scoped to the legacy
`createFormTree` (`FormGroup`) substrate; it cannot attach to a `signalForm()`
field tree. **Prefer `history()` from `@signaltree/core`** on the `form()`
marker instead — see "form() + history()" above.

```typescript
import { withFormHistory } from '@signaltree/ng-forms';

const form = withFormHistory(createFormTree(initialValues), { capacity: 20 });

form.setValues({ profile: { name: 'Ada' } });
form.undo();
form.redo();
form.history(); // signal with { past, present, future }
form.clearHistory();
```

History tracking works at the FormGroup level so it plays nicely with external updates and preserved snapshots. Retained for `createFormTree` users; will be removed with the legacy `FormGroup` bridge.

## Helpers and utilities

- `validators` / `asyncValidators`: Lightweight factories for common rules (required, email, minLength, unique, etc.)
- `createVirtualFormArray`: Virtualize huge `FormArray`s by only instantiating the visible window
- To convert a signal to an RxJS `Observable`, use Angular's own
  [`toObservable`](https://angular.dev/ecosystem/rxjs-interop) from
  `@angular/core/rxjs-interop`. This package used to ship its own copy; it was
  never exported from any entry point, so the import this line advertised could
  not resolve, and its no-injection-context fallback silently degraded a live
  stream to a single emission. Removed in 14.0.0.
- `SIGNAL_FORM_DIRECTIVES`: Re-export of `SignalValueDirective` for template-driven helpers
- `FormValidationError`: Error thrown from `submit` when validation fails, containing sync & async errors

## Template-driven bridge

```html
<input type="text" [(ngModel)]="userName" [signalTreeSignalValue]="formTree.$.user.name" (signalTreeSignalValueChange)="audit($event)" />
```

Use `SignalValueDirective` to keep standalone signals and `ngModel` fields aligned in legacy sections while new pages migrate to forms-first APIs.

## When to use ng-forms vs Angular 22 signal forms

| Scenario                                   | Recommendation                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Login form (2-3 fields)                    | ✅ Angular 22 `FormField`                                                                       |
| Search bar with filters                    | ✅ Angular 22 `FormField`                                                                       |
| Form state inside your store tree          | ✅ **ng-forms** (tree integration)                                                              |
| Checkout flow (shipping + payment + items) | ✅ **ng-forms** (persistence + wizard)                                                          |
| Multi-step onboarding (5+ steps)           | ✅ **ng-forms** (wizard API)                                                                    |
| Form with auto-save drafts                 | ✅ **ng-forms** (built-in persistence)                                                          |
| Complex editor with undo/redo              | ✅ **core `history()`** on the `form()` marker (v13+; ng-forms `withFormHistory` is deprecated) |
| Migrating from reactive forms              | ✅ **ng-forms** (FormGroup bridge)                                                              |
| Dynamic form with conditional fields       | ✅ **ng-forms** (conditionals config)                                                           |
| Form synced with global app state          | ✅ **ng-forms** (SignalTree integration)                                                        |

**Rule of thumb**: If your form state should live inside your SignalTree store, or needs workflow features (persistence/wizards/history), use ng-forms. For standalone forms — flat or nested — Angular 22's native Signal Forms are excellent. Need both on the same field? Use the `@signaltree/ng-forms/signals` bridges above.

## Migration from createFormTree()

`createFormTree()` is retained as the current classic `FormGroup` bridge.

### Before (deprecated)

```typescript
import { createFormTree, ngFormValidators } from '@signaltree/ng-forms';

const form = createFormTree(
  {
    name: '',
    email: '',
  },
  {
    validators: { email: ngFormValidators.email() },
    persistKey: 'profile-form',
  }
);

// Access
form.$.name.set('John');
form.form; // FormGroup
```

### After (current)

```typescript
import { createFormTree, ngFormValidators } from '@signaltree/ng-forms';

const profile = createFormTree(
  { name: '', email: '' },
  {
    persistKey: 'profile-form',
    fieldConfigs: { email: { validators: [ngFormValidators.email()] } },
  }
);

// Access
profile.$.name.set('John');
profile.form; // FormGroup
```

### Key differences

| Aspect               | createFormTree()        | Signal Forms directly        |
| -------------------- | ----------------------- | ---------------------------- |
| **Standalone**       | Always needs Angular    | form() works without Angular |
| **Tree integration** | Separate from app state | Lives in your main tree      |
| **DevTools**         | Separate                | Inherits tree DevTools       |
| **Composability**    | Limited                 | Add enhancers freely         |
| **Tree-shaking**     | All-or-nothing          | Only what you use            |

### Migration steps

1. Move form state into your SignalTree using `form()` marker
2. Use `createFormTree()` for classic Reactive Forms interop
3. Update access patterns: `form.$.field` → `tree.$.formName.$.field`
4. Update FormGroup access: `form.form` → `tree.getAngularForm('path')?.formGroup`

## Links

- [SignalTree Documentation](https://signaltree.io)
- [Migrating from createFormTree()](#migration-from-createformtree)
- [Core Package](https://www.npmjs.com/package/@signaltree/core)
- [GitHub Repository](https://github.com/JBorgia/signaltree)
- [Demo Application](https://signaltree.io/examples)

## License

Apache License 2.0 — see the [LICENSE](../../LICENSE) file. OSI-approved and permissive, with an explicit patent grant.

---

**Seamless signal-first Angular forms.**
