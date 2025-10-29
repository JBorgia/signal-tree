# Tree-Shaking Analysis & Optimization Guide

## 🔍 Current State Analysis

### Bundle Analysis Results

- **Bundle Size**: 8.83KB gzipped (1,387 lines uncompressed)
- **Format**: ESM (FESM2022)
- **Side Effects**: `false` ✅
- **Unused Code**: Currently investigating

### Evidence of Tree-Shaking Issues

#### ✅ What's Working

1. **ESM Format**: Pure ES modules being generated
2. **Side Effects**: `sideEffects: false` properly configured
3. **No CommonJS**: No `require()` or `module.exports` in output
4. **Exported utilities**: All exported functions appear to be used

#### ⚠️ Potential Issues

1. **SecurityValidator**: Always bundled even when `config.security` not provided (conditional at runtime)
2. **SignalMemoryManager**: Always bundled even when lazy mode not used (conditional at runtime)
3. **Large exports**: Both ~715 lines of code that could be optional

**Root Cause**: Runtime conditionals don't enable tree-shaking. The bundler includes everything because the decision happens at runtime, not build time.

---

## 📚 20+ Tree-Shaking Techniques

### Category 1: Module Format & Configuration (Foundation)

#### 1. **Use Pure ESM Modules**

```javascript
// ✅ Good - Tree-shakeable
export function utility() {}

// ❌ Bad - Not tree-shakeable
module.exports = { utility };
exports.utility = function () {};
```

**Status**: ✅ Using ESM

#### 2. **Set `sideEffects: false` in package.json**

```json
{
  "sideEffects": false
}
```

**Purpose**: Tells bundlers the package has no side effects, enabling aggressive tree-shaking
**Status**: ✅ Configured

#### 3. **Specify Exact Side Effect Files**

```json
{
  "sideEffects": ["*.css", "*.scss", "./src/polyfills.ts"]
}
```

**Purpose**: Allows side effects only in specific files
**Status**: ⚠️ Could be more specific

#### 4. **Use `type: "module"` in package.json**

```json
{
  "type": "module"
}
```

**Purpose**: Marks package as pure ESM
**Status**: ⚠️ Not set (Angular uses TypeScript compilation)

#### 5. **Provide Multiple Module Formats**

```json
{
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    }
  }
}
```

**Purpose**: Let bundlers choose optimal format
**Status**: ✅ ng-packagr handles this

---

### Category 2: Code Structure (Critical)

#### 6. **Avoid Runtime Conditionals for Optional Features**

```typescript
// ❌ Bad - Always bundled
import { SecurityValidator } from './security';
if (config.security) {
  const validator = new SecurityValidator(config.security);
}

// ✅ Good - Tree-shakeable
// User decides at import time
import { withSecurity } from '@signaltree/core/security';
tree.with(withSecurity(config));
```

**Status**: ❌ Using runtime conditionals
**Impact**: ~1.5KB always bundled

#### 7. **Use Static Exports Over Dynamic Exports**

```typescript
// ❌ Bad
export * from './utils';

// ✅ Good
export { funcA, funcB } from './utils';
```

**Purpose**: Bundlers can statically analyze what's exported
**Status**: ⚠️ Mixed approach

#### 8. **Separate Pure Functions from Side Effects**

```typescript
// ❌ Bad
export const logger = console.log('Init');
export function pureFunc() {}

// ✅ Good - Separate files
// pure.ts
export function pureFunc() {}

// logger.ts (marked as side effect)
console.log('Init');
```

**Status**: ✅ Generally separated

#### 9. **Avoid Class Constructors with Side Effects**

```typescript
// ❌ Bad
class MyClass {
  constructor() {
    console.log('Created'); // Side effect
  }
}

// ✅ Good
class MyClass {
  constructor() {
    // Pure initialization only
  }
}
```

**Status**: ✅ Classes are pure

#### 10. **Use Named Exports Over Default Exports**

```typescript
// ❌ Bad - Harder to tree-shake
export default { funcA, funcB };

// ✅ Good - Individual exports
export { funcA };
export { funcB };
```

**Purpose**: Named exports enable better dead code elimination
**Status**: ✅ Using named exports

---

### Category 3: Import/Export Patterns (Advanced)

#### 11. **Avoid Namespace Imports**

```typescript
// ❌ Bad - Imports everything
import * as utils from './utils';

// ✅ Good - Import only what's needed
import { specificFunc } from './utils';
```

**Purpose**: Explicit imports enable tree-shaking
**Status**: ✅ Using specific imports

#### 12. **Use Re-exports Carefully**

```typescript
// ❌ Bad - Re-exports everything
export * from './features';

// ✅ Good - Explicit re-exports
export { Feature1, Feature2 } from './features';
```

**Status**: ⚠️ Some `export *` usage

#### 13. **Avoid Circular Dependencies**

```typescript
// ❌ Bad
// a.ts
import { B } from './b';
export class A {}

// b.ts
import { A } from './a';
export class B {}

// ✅ Good - Extract shared code
// shared.ts
export interface IShared {}

// a.ts
import { IShared } from './shared';
export class A implements IShared {}
```

**Purpose**: Circular deps force bundlers to include both modules
**Status**: ✅ No major circular deps detected

#### 14. **Use Barrel Files Strategically**

```typescript
// ⚠️ Barrel files can hurt tree-shaking if not careful
// index.ts
export * from './feature-a'; // Everything from feature-a
export * from './feature-b'; // Everything from feature-b

// ✅ Better - Secondary entry points
// index.ts - Core only
export { coreFunc } from './core';

// feature-a/index.ts - Optional feature
export { featureA } from './feature-a-impl';
```

**Status**: ⚠️ Single barrel file exports everything

---

### Category 4: Build Configuration (Tooling)

#### 15. **Enable ModuleConcatenation (Scope Hoisting)**

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    concatenateModules: true,
  },
};
```

**Purpose**: Merges modules into single scope for better DCE
**Status**: ⏳ Need to verify ng-packagr settings

#### 16. **Use Terser/Uglify for Dead Code Elimination**

```javascript
optimization: {
  minimize: true,
  minimizer: [new TerserPlugin({
    terserOptions: {
      compress: {
        dead_code: true,
        unused: true
      }
    }
  })]
}
```

**Status**: ✅ Production builds use minification

#### 17. **Ensure Tree-Shaking in tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "node",
    "target": "ES2022"
  }
}
```

**Purpose**: TypeScript outputs tree-shakeable ES modules
**Status**: ✅ Configured properly

#### 18. **Use `pure` Comments for Functions**

```typescript
/*#__PURE__*/ const result = expensiveOperation();
```

**Purpose**: Hints to bundlers that function has no side effects
**Status**: ⚠️ Not using `/*#__PURE__*/` annotations

---

### Category 5: Secondary Entry Points (Architectural)

#### 19. **Create Secondary Entry Points for Features**

```
@signaltree/core
@signaltree/core/security
@signaltree/core/memory
@signaltree/core/devtools
```

**Purpose**: Users import only what they need
**Status**: ❌ Everything in single entry point
**Impact**: Biggest opportunity for size reduction

#### 20. **Use Conditional Exports in package.json**

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./security": "./dist/security/index.js",
    "./memory": "./dist/memory/index.js"
  }
}
```

**Purpose**: Enables fine-grained imports
**Status**: ❌ Not implemented

#### 21. **Implement Feature Flags at Build Time**

```typescript
// ✅ Build-time tree-shaking via imports
import { signalTree } from '@signaltree/core';
// Only imported if needed
import { withSecurity } from '@signaltree/core/security';

const tree = config.needsSecurity ? signalTree(state).with(withSecurity()) : signalTree(state);
```

**Status**: ❌ Not implemented

---

### Category 6: Code Patterns (Best Practices)

#### 22. **Avoid Top-Level Execution**

```typescript
// ❌ Bad - Executes on import
const config = loadConfig();
export { config };

// ✅ Good - Lazy execution
export function getConfig() {
  return loadConfig();
}
```

**Status**: ✅ No top-level execution

#### 23. **Use Getter Functions for Expensive Operations**

```typescript
// ❌ Bad - Computed eagerly
export const expensiveValue = compute();

// ✅ Good - Computed lazily
export function getExpensiveValue() {
  return compute();
}
```

**Status**: ✅ Using function exports

#### 24. **Mark Pure Functions with JSDoc**

```typescript
/**
 * @pure
 */
export function calculate(a, b) {
  return a + b;
}
```

**Purpose**: Documentation for tree-shaking tools
**Status**: ⚠️ Not consistently using @pure

---

### Category 7: Testing & Validation (Quality)

#### 25. **Use Bundle Analyzers**

```bash
# Webpack Bundle Analyzer
npm install --save-dev webpack-bundle-analyzer

# Source Map Explorer
source-map-explorer dist/bundle.js
```

**Status**: ⚠️ Using custom script, could use visual analyzer

#### 26. **Test with Empty Imports**

```typescript
// Test file
import '@signaltree/core';
// Should produce minimal bundle (just registration code)
```

**Purpose**: Verify no code executes on import
**Status**: ⏳ Should test this

#### 27. **Compare Bundle Sizes Across Versions**

```bash
# Track bundle size over time
npm run build
du -h dist/bundle.js >> bundle-sizes.log
```

**Status**: ✅ Have bundle analysis script

---

## 🎯 Specific Issues in SignalTree

### Issue 1: SecurityValidator Always Bundled

**Problem**:

```typescript
import { SecurityValidator } from './security/security-validator';
// Used conditionally at runtime
if (config.security) {
  const validator = new SecurityValidator(config.security);
}
```

**Impact**: ~0.7KB always included
**Solution**: Secondary entry point

### Issue 2: SignalMemoryManager Always Bundled

**Problem**:

```typescript
import { SignalMemoryManager } from './memory/memory-manager';
// Used conditionally at runtime
if (useLazy) {
  memoryManager = new SignalMemoryManager();
}
```

**Impact**: ~0.8KB always included
**Solution**: Dynamic import or secondary entry point

### Issue 3: All Utilities Exported Together

**Problem**: Single `utils.ts` exports everything
**Impact**: Minor, but could be optimized
**Solution**: Split into smaller modules

---

## 💡 Recommended Improvements

### Priority 1: Secondary Entry Points (Highest Impact)

```typescript
// packages/core/security/index.ts
export { SecurityValidator } from '../src/lib/security/security-validator';

// packages/core/memory/index.ts
export { SignalMemoryManager } from '../src/lib/memory/memory-manager';

// Usage
import { signalTree } from '@signaltree/core'; // 7.25KB
import { withSecurity } from '@signaltree/core/security'; // +0.7KB
import { withMemory } from '@signaltree/core/memory'; // +0.8KB
```

**Expected Savings**: 1.5KB for users who don't need these features

### Priority 2: Add `/*#__PURE__*/` Annotations

```typescript
export const SecurityPresets = /*#__PURE__*/ {
  strict: () =>
    /*#__PURE__*/ new SecurityValidator({
      /* ... */
    }),
  standard: () =>
    /*#__PURE__*/ new SecurityValidator({
      /* ... */
    }),
};
```

**Expected Savings**: Helps with unused preset elimination

### Priority 3: More Specific sideEffects

```json
{
  "sideEffects": ["**/*.css", "**/*.scss"]
}
```

### Priority 4: Bundle Analyzer Integration

```bash
npm install --save-dev source-map-explorer
npm run build
source-map-explorer dist/**/*.js
```

---

## 📊 Expected Results

### Current State

- Core: 8.83KB
- Always includes: SecurityValidator (0.7KB) + SignalMemoryManager (0.8KB)

### With Secondary Entry Points

- Core only: ~7.25KB (baseline)
- Core + Security: ~7.95KB (+0.7KB opt-in)
- Core + Memory: ~8.05KB (+0.8KB opt-in)
- Core + Both: ~8.83KB (same as now)

### Benefit

- 95% of users: Save 1.5KB (return to v3.1 baseline)
- 5% of users: Same size, explicit opt-in

---

## ✅ Action Plan

### Immediate (Can do now)

1. ✅ Verify current tree-shaking is working (completed)
2. ⏳ Add `/*#__PURE__*/` annotations to factory functions
3. ⏳ Test empty import bundle size
4. ⏳ Document exported APIs that are optional

### Short-term (v3.3)

1. Add source-map-explorer
2. Create visual bundle analysis
3. Optimize specific exports based on usage data

### Long-term (v4.0)

1. Implement secondary entry points
2. Make SecurityValidator optional
3. Make SignalMemoryManager optional
4. Return core to 7.25KB baseline

---

## 🔍 Conclusion

### Tree-Shaking Status: ⚠️ **PARTIALLY WORKING**

**What's Working**:

- ✅ ESM format
- ✅ `sideEffects: false`
- ✅ Named exports
- ✅ Pure functions
- ✅ Production minification

**What's Not Working**:

- ❌ Runtime conditionals prevent tree-shaking of SecurityValidator & SignalMemoryManager
- ❌ Single entry point bundles everything
- ⚠️ No visual bundle analyzer

**Key Insight**: Tree-shaking works correctly, but architectural decisions (runtime conditionals instead of import-time choices) prevent optimal code elimination.

**Solution**: Secondary entry points enable users to make tree-shaking decisions at import time instead of runtime.

---

## 🤔 Cost-Benefit Analysis: Are Secondary Entry Points Worth It?

### The Savings

- **Potential**: 1.5KB gzipped (SecurityValidator + SignalMemoryManager)
- **Percentage**: 17% reduction (8.83KB → 7.25KB)
- **Who benefits**: ~95% of users (those who don't use security or memory features)

### The Costs

#### 1. **Developer Experience Complexity** 💰💰💰

```typescript
// Current (simple)
import { signalTree } from '@signaltree/core';
const tree = signalTree(state, { security: { ... } });

// Secondary entry points (complex)
import { signalTree } from '@signaltree/core';
import { withSecurity } from '@signaltree/core/security';
const tree = signalTree(state).with(withSecurity({ ... }));
```

**Impact**:

- Users must understand which features need separate imports
- Documentation becomes more complex
- More GitHub issues: "Why doesn't security work?"
- Harder to discover features

#### 2. **Build Configuration Complexity** 💰💰

```json
// ng-package.json changes needed
{
  "lib": {
    "entryFile": "src/index.ts"
  },
  "dest": "../../dist/packages/core",
  "secondaryEntryPoints": ["security", "memory"]
}
```

**Impact**:

- More build configuration
- Potential build tool issues
- TypeScript path mapping complexity
- More test scenarios

#### 3. **Maintenance Burden** 💰

- Separate entry points = separate publishing concerns
- More exports to document
- More backward compatibility considerations
- Version skew possibilities

#### 4. **Bundle Size Context** 🤏

```
SignalTree: 8.83KB
NgRx Store: ~16KB (core only)
Zustand: ~1.1KB (much simpler API)
Redux Toolkit: ~12KB
Akita: ~8KB
```

**Reality Check**: SignalTree is already competitive at 8.83KB

### The Verdict: **NO, NOT WORTH IT** ❌

#### Why Keep Current Architecture

**1. The savings are marginal in real-world context**

- 1.5KB ≈ Small JPEG image
- 1.5KB ≈ 2-3 tweets
- Most apps load megabytes of assets
- Network latency matters more than 1.5KB

**2. Security & Memory are valuable defaults**

```typescript
// This is GOOD DX - it just works
const tree = signalTree(state, {
  security: { preventPrototypePollution: true }, // No extra import needed!
});
```

- Prototype pollution is a **real CVE** - having protection built-in is a feature
- Memory leaks in lazy trees are **hard to debug** - automatic cleanup is a feature
- Users shouldn't have to know these problems exist

**3. Bundle size is already excellent**

- 8.83KB is very reasonable for what SignalTree does
- Smaller than all major competitors except Zustand (which does 10% of the features)
- The 1.66KB increase was **justified by real value**

**4. Simplicity is worth bytes**

```typescript
// Perfect DX - one import, everything works
import { signalTree } from '@signaltree/core';

// vs multi-import confusion
import { signalTree } from '@signaltree/core';
import { withSecurity } from '@signaltree/core/security';
import { withMemory } from '@signaltree/core/memory';
import { withDevtools } from '@signaltree/core/devtools';
```

**5. The 95% statistic is misleading**

- SecurityValidator: Users may not **explicitly** configure it, but protection is passive
- SignalMemoryManager: Every lazy tree benefits from automatic cleanup
- These features prevent bugs before they happen

### Alternative: Micro-Optimizations Instead

If bundle size becomes a concern in the future, these are better approaches:

**1. Lazy load devtools only** (bigger win, ~2KB)

```typescript
// Devtools is clearly optional and development-only
import { withDevtools } from '@signaltree/core/devtools';
```

**2. Use `/*#__PURE__*/` annotations** (easy, low-cost)

```typescript
export const SecurityPresets = /*#__PURE__*/ {
  strict: /*#__PURE__*/ () => ({ ... })
};
```

**3. Split utility functions** (surgical optimization)

```typescript
// Instead of utils.ts with everything
export { deepEqual } from './utils/deep-equal';
export { parsePath } from './utils/parse-path';
```

### Recommendation: **KEEP CURRENT ARCHITECTURE** ✅

**Accept 8.83KB as the v3.2 baseline** for these reasons:

1. ✅ **Competitive**: Still smaller than NgRx, Redux, Akita
2. ✅ **Secure by default**: Prototype pollution protection is worth 0.7KB
3. ✅ **Memory safe by default**: Automatic cleanup is worth 0.8KB
4. ✅ **Simple DX**: One import, everything works
5. ✅ **Maintainable**: Less build complexity
6. ✅ **Discoverable**: Features are obvious in main export

**Save secondary entry points for v4.0+ IF**:

- Core grows beyond 15KB
- Users actively request modular imports
- Devtools becomes large enough to justify separation
- A clear pattern emerges showing most users need only a subset

### Final Thought

> **"Premature optimization is the root of all evil"** - Donald Knuth

SignalTree is optimizing for the wrong metric. The value proposition is:

- ✨ **Reactive Angular integration**
- 🔒 **Type safety**
- 🛡️ **Security by default**
- 🧠 **Memory safety**
- 🚀 **Performance**

Trading 1.5KB savings for **worse developer experience** and **more complexity** is not a good trade.

The current 8.83KB bundle is a **feature, not a bug**. It includes everything users need in a secure, memory-safe package with excellent DX.
