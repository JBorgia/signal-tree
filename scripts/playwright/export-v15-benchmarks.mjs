#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { chromium } from 'playwright';

const baseUrl = process.env.DEMO_URL ?? 'http://127.0.0.1:4200';
const mode = process.env.BENCHMARK_MODE === 'steady' ? 'steady' : 'quick';
const allowDevelopment = process.env.ALLOW_DEV_BENCHMARKS === '1';
const outputPath = resolve(
  process.cwd(),
  process.env.BENCHMARK_OUTPUT ?? 'artifacts/benchmark-results-automated.json'
);
const benchmarkUrl = new URL('/benchmarks', baseUrl).toString();

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto(benchmarkUrl, { waitUntil: 'networkidle' });

  const developmentBuild = await page.locator('.build-notice').isVisible();
  if (developmentBuild && !allowDevelopment) {
    throw new Error(
      'Refusing to export development-mode timings. Use a production build or set ALLOW_DEV_BENCHMARKS=1 for diagnostic output.'
    );
  }

  if (mode === 'steady') {
    await page.getByRole('button', { name: /Steady/ }).click();
  }

  const expectedRows = await page.locator('.planned-arms > span').count();
  await page.getByRole('button', { name: 'Run browser spot-check' }).click();
  await page.waitForFunction(
    (expected) =>
      document.querySelectorAll('.result-row').length === expected ||
      document.querySelector('.run-error') !== null,
    expectedRows,
    { timeout: 60_000 }
  );

  const errorLocator = page.locator('.run-error');
  const error =
    (await errorLocator.count()) > 0
      ? await errorLocator.first().textContent()
      : null;
  if (error) throw new Error(error.trim());

  const report = await page.evaluate(
    ({ selectedMode, isDevelopment }) => ({
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      source: '/benchmarks',
      mode: selectedMode,
      developmentBuild: isDevelopment,
      environment: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
      },
      workloads: Array.from(
        document.querySelectorAll('[data-workload-id]')
      ).map((workload) => ({
        id: workload.getAttribute('data-workload-id'),
        title:
          workload.querySelector('.workload-heading h2')?.textContent?.trim() ??
          '',
        costContext:
          workload
            .querySelector('.cost-context')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim() ?? '',
        capability: {
          title:
            workload
              .querySelector('.capability-admission h3')
              ?.textContent?.trim() ?? '',
          requirements: Array.from(
            workload.querySelectorAll('.capability-columns ul li')
          ).map((requirement) => requirement.textContent?.trim() ?? ''),
          exclusions: Array.from(
            workload.querySelectorAll('.capability-columns dl > div')
          ).map((exclusion) => ({
            label: exclusion.querySelector('dt')?.textContent?.trim() ?? '',
            reason: exclusion.querySelector('dd')?.textContent?.trim() ?? '',
          })),
        },
        calculation: Object.fromEntries(
          Array.from(workload.querySelectorAll('[data-calculation-field]')).map(
            (field) => [
              field.getAttribute('data-calculation-field'),
              field.querySelector('p')?.textContent?.trim() ?? '',
            ]
          )
        ),
        results: Array.from(workload.querySelectorAll('[data-arm-id]')).map(
          (row) => ({
            armId: row.getAttribute('data-arm-id'),
            label:
              row
                .querySelector('.implementation strong')
                ?.textContent?.trim() ?? '',
            implementation:
              row.querySelector('.implementation span')?.textContent?.trim() ??
              '',
            capabilityKind:
              row.querySelector('.comparison-kind')?.textContent?.trim() ?? '',
            medianMs: Number(row.getAttribute('data-median-ms')),
            minMs: Number(row.getAttribute('data-min-ms')),
            maxMs: Number(row.getAttribute('data-max-ms')),
            interpretation:
              row.querySelector('.interpretation')?.textContent?.trim() ?? '',
            phases: Array.from(row.querySelectorAll('[data-phase-id]')).map(
              (phase) => ({
                id: phase.getAttribute('data-phase-id'),
                medianMs: Number(phase.getAttribute('data-phase-median-ms')),
                minMs: Number(phase.getAttribute('data-phase-min-ms')),
                maxMs: Number(phase.getAttribute('data-phase-max-ms')),
              })
            ),
          })
        ),
      })),
    }),
    { selectedMode: mode, isDevelopment: developmentBuild }
  );

  const invalidResult = report.workloads
    .flatMap(({ results }) => results)
    .find(
      ({ medianMs, minMs, maxMs }) =>
        !Number.isFinite(medianMs) ||
        !Number.isFinite(minMs) ||
        !Number.isFinite(maxMs)
    );
  if (invalidResult) {
    throw new Error(`Invalid exported timing for ${invalidResult.armId}`);
  }

  const invalidCapability = report.workloads.find(
    ({ capability, calculation, results }) =>
      !capability.title ||
      capability.requirements.length === 0 ||
      capability.exclusions.some(({ label, reason }) => !label || !reason) ||
      Object.values(calculation).some((value) => !value) ||
      results.some(
        ({ capabilityKind }) =>
          !capabilityKind || capabilityKind.startsWith('Harness')
      )
  );
  if (invalidCapability) {
    throw new Error(
      `Invalid capability contract for ${
        invalidCapability.id ?? 'unknown workload'
      }`
    );
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Exported ${expectedRows} checked rows to ${outputPath}`);
} finally {
  await browser.close();
}
