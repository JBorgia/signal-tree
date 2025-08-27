#!/usr/bin/env node
/**
 * Real SignalTree Performance Analysis
 *
 * This script provides actual performance testing using real SignalTree APIs
 * and compares against plain JavaScript objects and other solutions.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import from built packages
let signalTree;
try {
  signalTree =
    require('../../dist/packages/core/fesm2022/signaltree-core.mjs').signalTree;
} catch (e) {
  console.error('❌ SignalTree core not built. Run: pnpm run build:all');
  process.exit(1);
}

console.log('🚀 SignalTree Real Performance Analysis');
console.log('⚡ Measuring actual SignalTree performance...\n');

class RealPerformanceAnalyzer {
  constructor() {
    this.results = {
      basic: { depth: 5, operations: 0, totalTime: 0 },
      medium: { depth: 10, operations: 0, totalTime: 0 },
      extreme: { depth: 15, operations: 0, totalTime: 0 },
      unlimited: { depth: 20, operations: 0, totalTime: 0 },
    };
  }

  measureMemory() {
    const usage = process.memoryUsage();
    return Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100;
  }

  // Test actual SignalTree operations at depth
  benchmarkSignalTreeOperations(depth, iterations = 500) {
    const operations = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // Create a deep SignalTree structure
      const initialState = this.createDeepState(depth, i);
      const tree = signalTree(initialState);

      // Perform deep updates
      this.performDeepUpdates(tree, depth, i);

      // Access deep values to trigger computations
      this.accessDeepValues(tree, depth);

      operations.push(performance.now() - start);
    }

    return {
      totalTime: operations.reduce((sum, time) => sum + time, 0),
      avgTime:
        operations.reduce((sum, time) => sum + time, 0) / operations.length,
      operations: operations.length,
    };
  }

  // Compare with plain JavaScript objects
  benchmarkPlainObjects(depth, iterations = 500) {
    const operations = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // Create deep plain object
      const obj = this.createDeepState(depth, i);

      // Perform updates
      this.updatePlainObject(obj, depth, i);

      // Access values
      this.accessPlainObject(obj, depth);

      operations.push(performance.now() - start);
    }

    return {
      totalTime: operations.reduce((sum, time) => sum + time, 0),
      avgTime:
        operations.reduce((sum, time) => sum + time, 0) / operations.length,
      operations: operations.length,
    };
  }

  createDeepState(depth, seed) {
    const state = {};
    let current = state;

    for (let level = 1; level <= depth; level++) {
      current[`level${level}`] = {
        id: level,
        value: `value-${level}-${seed}`,
        counter: level * seed,
        items: Array.from({ length: 3 }, (_, i) => ({
          id: i,
          name: `item-${level}-${i}`,
          active: i % 2 === 0,
        })),
      };

      if (level < depth) {
        current[`level${level}`].nested = {};
        current = current[`level${level}`].nested;
      }
    }

    return state;
  }

  performDeepUpdates(tree, depth, seed) {
    for (let level = 1; level <= depth; level++) {
      const pathParts = this.buildPathParts(level);

      // Navigate to the nested property and update it
      let current = tree.$;
      for (let i = 0; i < pathParts.length - 1; i++) {
        current = current[pathParts[i]];
      }

      const lastPart = pathParts[pathParts.length - 1];
      const currentValue = current[lastPart]();

      current[lastPart].set({
        ...currentValue,
        value: `updated-${currentValue.value}-${seed}`,
        counter: currentValue.counter + 1,
        items: currentValue.items.map((item) => ({
          ...item,
          active: !item.active,
        })),
      });
    }
  }

  updatePlainObject(obj, depth, seed) {
    for (let level = 1; level <= depth; level++) {
      const target = this.getNestedValue(obj, level);
      if (target) {
        target.value = `updated-${target.value}-${seed}`;
        target.counter = target.counter + 1;
        target.items = target.items.map((item) => ({
          ...item,
          active: !item.active,
        }));
      }
    }
  }

  accessDeepValues(tree, depth) {
    for (let level = 1; level <= depth; level++) {
      const pathParts = this.buildPathParts(level);

      // Navigate to the nested property and read it
      let current = tree.$;
      for (const part of pathParts) {
        current = current[part];
      }
      const value = current();

      // Simulate computation
      if (value && value.items) {
        const activeCount = value.items.filter((item) => item.active).length;
        // Use the computed value
        void activeCount;
      }
    }
  }

  accessPlainObject(obj, depth) {
    for (let level = 1; level <= depth; level++) {
      const value = this.getNestedValue(obj, level);
      // Simulate computation
      if (value && value.items) {
        const activeCount = value.items.filter((item) => item.active).length;
        // Use the computed value
        void activeCount;
      }
    }
  }

  buildPath(level) {
    const parts = [];
    for (let i = 1; i <= level; i++) {
      parts.push(`level${i}`);
      if (i < level) {
        parts.push('nested');
      }
    }
    return parts.join('.');
  }

  buildPathParts(level) {
    const parts = [];
    for (let i = 1; i <= level; i++) {
      parts.push(`level${i}`);
      if (i < level) {
        parts.push('nested');
      }
    }
    return parts;
  }

  getNestedValue(obj, level) {
    let current = obj;
    for (let i = 1; i <= level; i++) {
      current = current[`level${i}`];
      if (!current) return null;
      if (i < level) {
        current = current.nested;
      }
    }
    return current;
  }

  async testBasicDepth() {
    console.log('🔬 Testing Basic Recursive Depth (5 levels)...');

    const signalTreeResult = this.benchmarkSignalTreeOperations(5, 500);
    const plainObjectResult = this.benchmarkPlainObjects(5, 500);

    this.results.basic = {
      depth: 5,
      signalTree: signalTreeResult,
      plainObject: plainObjectResult,
      improvement: (
        ((plainObjectResult.avgTime - signalTreeResult.avgTime) /
          plainObjectResult.avgTime) *
        100
      ).toFixed(1),
    };

    console.log(`✅ Basic (5 levels):`);
    console.log(`   SignalTree: ${signalTreeResult.avgTime.toFixed(3)}ms avg`);
    console.log(`   Plain JS:   ${plainObjectResult.avgTime.toFixed(3)}ms avg`);
    console.log(
      `   Difference: ${this.results.basic.improvement}% ${
        signalTreeResult.avgTime < plainObjectResult.avgTime
          ? 'faster'
          : 'slower'
      }\n`
    );
  }

  async testMediumDepth() {
    console.log('🔬 Testing Medium Recursive Depth (10 levels)...');

    const signalTreeResult = this.benchmarkSignalTreeOperations(10, 300);
    const plainObjectResult = this.benchmarkPlainObjects(10, 300);

    this.results.medium = {
      depth: 10,
      signalTree: signalTreeResult,
      plainObject: plainObjectResult,
      improvement: (
        ((plainObjectResult.avgTime - signalTreeResult.avgTime) /
          plainObjectResult.avgTime) *
        100
      ).toFixed(1),
    };

    console.log(`✅ Medium (10 levels):`);
    console.log(`   SignalTree: ${signalTreeResult.avgTime.toFixed(3)}ms avg`);
    console.log(`   Plain JS:   ${plainObjectResult.avgTime.toFixed(3)}ms avg`);
    console.log(
      `   Difference: ${this.results.medium.improvement}% ${
        signalTreeResult.avgTime < plainObjectResult.avgTime
          ? 'faster'
          : 'slower'
      }\n`
    );
  }

  async testExtremeDepth() {
    console.log('🔬 Testing Extreme Recursive Depth (15 levels)...');

    const signalTreeResult = this.benchmarkSignalTreeOperations(15, 200);
    const plainObjectResult = this.benchmarkPlainObjects(15, 200);

    this.results.extreme = {
      depth: 15,
      signalTree: signalTreeResult,
      plainObject: plainObjectResult,
      improvement: (
        ((plainObjectResult.avgTime - signalTreeResult.avgTime) /
          plainObjectResult.avgTime) *
        100
      ).toFixed(1),
    };

    console.log(`🔥 Extreme (15 levels):`);
    console.log(`   SignalTree: ${signalTreeResult.avgTime.toFixed(3)}ms avg`);
    console.log(`   Plain JS:   ${plainObjectResult.avgTime.toFixed(3)}ms avg`);
    console.log(
      `   Difference: ${this.results.extreme.improvement}% ${
        signalTreeResult.avgTime < plainObjectResult.avgTime
          ? 'faster'
          : 'slower'
      }\n`
    );
  }

  async testUnlimitedDepth() {
    console.log('🔬 Testing Unlimited Recursive Depth (20+ levels)...');

    const signalTreeResult = this.benchmarkSignalTreeOperations(20, 100);
    const plainObjectResult = this.benchmarkPlainObjects(20, 100);

    this.results.unlimited = {
      depth: 20,
      signalTree: signalTreeResult,
      plainObject: plainObjectResult,
      improvement: (
        ((plainObjectResult.avgTime - signalTreeResult.avgTime) /
          plainObjectResult.avgTime) *
        100
      ).toFixed(1),
    };

    console.log(`🚀 Unlimited (20+ levels):`);
    console.log(`   SignalTree: ${signalTreeResult.avgTime.toFixed(3)}ms avg`);
    console.log(`   Plain JS:   ${plainObjectResult.avgTime.toFixed(3)}ms avg`);
    console.log(
      `   Difference: ${this.results.unlimited.improvement}% ${
        signalTreeResult.avgTime < plainObjectResult.avgTime
          ? 'faster'
          : 'slower'
      }\n`
    );
  }

  async runAllTests() {
    console.log('📊 Running Real Performance Analysis...\n');

    await this.testBasicDepth();
    await this.testMediumDepth();
    await this.testExtremeDepth();
    await this.testUnlimitedDepth();

    this.printResults();
  }

  printResults() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 SIGNALTREE REAL PERFORMANCE ANALYSIS RESULTS');
    console.log('='.repeat(70));

    console.log('\n📊 RECURSIVE DEPTH PERFORMANCE:');
    console.log(
      `- Basic (5 levels):     ${this.results.basic.signalTree.avgTime.toFixed(
        3
      )}ms avg`
    );
    console.log(
      `- Medium (10 levels):   ${this.results.medium.signalTree.avgTime.toFixed(
        3
      )}ms avg`
    );
    console.log(
      `- Extreme (15 levels):  ${this.results.extreme.signalTree.avgTime.toFixed(
        3
      )}ms avg`
    );
    console.log(
      `- Unlimited (20+ levels): ${this.results.unlimited.signalTree.avgTime.toFixed(
        3
      )}ms avg`
    );

    console.log('\n🏆 PERFORMANCE COMPARISON VS PLAIN JAVASCRIPT:');
    console.log(`- Basic improvement:     ${this.results.basic.improvement}%`);
    console.log(`- Medium improvement:    ${this.results.medium.improvement}%`);
    console.log(
      `- Extreme improvement:   ${this.results.extreme.improvement}%`
    );
    console.log(
      `- Unlimited improvement: ${this.results.unlimited.improvement}%`
    );

    const memUsage = this.measureMemory();
    console.log(`\n📊 Memory Usage: ${memUsage}MB`);
    console.log('\n✅ Real performance analysis completed!');
  }
}

async function main() {
  try {
    const analyzer = new RealPerformanceAnalyzer();
    await analyzer.runAllTests();
  } catch (error) {
    console.error('❌ Performance analysis failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
