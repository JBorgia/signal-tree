# 🌳 SignalTree

> **⚠️ DEPRECATED - This version is no longer supported**
> 
> **This monolithic version of SignalTree has been deprecated and is no longer maintained.** 
> 
> **Please migrate to the new modular packages under the `@signaltree` scope:**
> - **Core functionality:** [`@signaltree/core`](https://www.npmjs.com/package/@signaltree/core)
> - **Additional packages:** `@signaltree/async`, `@signaltree/entities`, `@signaltree/devtools`, etc.
> 
> **Why we migrated:**
> - The smart enhancement logic didn't work as intended
> - This package became bloated despite tree-shaking attempts
> - The modular design provides better bundle size optimization
> - True pay-per-use with explicit feature imports
> 
> **Migration Guide:** See the new packages for updated documentation and migration instructions.

---

## About This Legacy Version

This was an attempt at a smart progressive enhancement approach to state management, but it had significant issues:

- **Bundle bloat**: Smart enhancement logic prevented effective tree-shaking
- **Large size**: Package remained ~50KB+ despite optimization attempts  
- **Complex architecture**: Made maintenance and optimization difficult

**Solution:** Migrated to modular `@signaltree/*` packages for true pay-per-use architecture.

## 🚀 Migration Instructions

**This package is deprecated.** Use the new modular packages instead:

```bash
# Instead of:
npm install signal-tree

# Use:
npm install @signaltree/core
# Plus any additional packages as needed:
npm install @signaltree/entities @signaltree/devtools
```

### Basic Usage Migration

```typescript
// Old (deprecated):
import { signalTree } from 'signal-tree';

// New:
import { signalTree } from '@signaltree/core';
import { withEntities } from '@signaltree/entities';
```

## 📦 Available Packages

- **[@signaltree/core](https://www.npmjs.com/package/@signaltree/core)** - Essential signal tree functionality
- **[@signaltree/entities](https://www.npmjs.com/package/@signaltree/entities)** - Entity management utilities  
- **[@signaltree/devtools](https://www.npmjs.com/package/@signaltree/devtools)** - Development and debugging tools
- **[@signaltree/async](https://www.npmjs.com/package/@signaltree/async)** - Async utilities and operators
- **[@signaltree/ng-forms](https://www.npmjs.com/package/@signaltree/ng-forms)** - Angular forms integration

## 📄 License

**MIT License with AI Training Restriction** - see the [LICENSE](LICENSE) file for details.

---

## 🔄 Migration Notice

**This package (`signal-tree`) is deprecated.** 

For new projects or when upgrading existing ones, please use the new modular packages:

- **Core:** [`@signaltree/core`](https://www.npmjs.com/package/@signaltree/core) - Essential signal tree functionality
- **Entities:** [`@signaltree/entities`](https://www.npmjs.com/package/@signaltree/entities) - Entity management utilities  
- **DevTools:** [`@signaltree/devtools`](https://www.npmjs.com/package/@signaltree/devtools) - Development and debugging tools
- **Async:** [`@signaltree/async`](https://www.npmjs.com/package/@signaltree/async) - Async utilities and operators
- **Forms:** [`@signaltree/ng-forms`](https://www.npmjs.com/package/@signaltree/ng-forms)** - Angular forms integration

The new packages provide:
- ✅ **True modular architecture** - only include what you use
- ✅ **Smaller bundle sizes** - each package is optimized independently  
- ✅ **Better tree-shaking** - no monolithic smart enhancement logic
- ✅ **Improved performance** - more focused and efficient implementations
- ✅ **Active maintenance** - ongoing development and support

**Thank you for using SignalTree!**
