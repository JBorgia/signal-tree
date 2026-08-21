export {
  createFormTree,
  createVirtualFormArray,
  FormValidationError,
  SignalValueDirective,
  SIGNAL_FORM_DIRECTIVES,
  type ConditionalField,
  type EnhancedArraySignal,
  type FieldConfig,
  type FieldValidator,
  type FormTree,
  type FormTreeAsyncValidatorFn,
  type FormTreeOptions,
  type TypedFormGroup,
} from './core/ng-forms';
export { withFormHistory, type FormHistory } from './history';
export { createWizardForm, type FormStep } from './wizard';

import { debounce, unique } from './core/async-validators';
import {
  compose,
  email,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
} from './core/validators';

/**
 * Namespaced form validators — the only import surface.
 *
 * Generic names like `required`, `min`, `pattern` would collide with
 * app-local symbols and with `@signaltree/core`'s `validators.*`
 * vocabulary, so there are no bare per-function exports — import the
 * namespace:
 *
 * ```typescript
 * import { ngFormValidators as v } from '@signaltree/ng-forms';
 *
 * createFormTree(data, {
 *   validators: {
 *     email: v.compose([v.required(), v.email()]),
 *     age: v.min(18),
 *   },
 * });
 * ```
 */
export const ngFormValidators = {
  required,
  email,
  minLength,
  maxLength,
  pattern,
  min,
  max,
  compose,
  unique,
  debounce,
} as const;
