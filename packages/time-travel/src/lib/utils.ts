/**
 * Lightweight utility functions for time-travel package
 * Replaces lodash dependencies to reduce bundle size
 */

/**
 * Deep clone function optimized for SignalTree state objects
 * Handles circular references, complex types, and maintains performance
 */
export { deepClone, deepEqual } from '@signaltree/utils';
