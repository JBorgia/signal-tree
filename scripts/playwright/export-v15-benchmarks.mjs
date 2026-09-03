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
  await page.getByRole('button', { name: 'Run recurring spot-check' }).click();
  await page.waitForFunction(
    (expected) =>
      document.querySelectorAll('.result-row').length === expected ||
      document.querySelector('.run-error') !== null,
    expectedRows,
    { timeout: 180_000 }
  );

  const errorLocator = page.locator('.run-error');
  const error =
    (await errorLocator.count()) > 0
      ? await errorLocator.first().textContent()
      : null;
  if (error) throw new Error(error.trim());

  const report = await page.evaluate(
    ({ selectedMode, isDevelopment }) => ({
      schemaVersion: 5,
      generatedAt: new Date().toISOString(),
      source: '/benchmarks',
      mode: selectedMode,
      developmentBuild: isDevelopment,
      measurementPlan: {
        measuredRounds: Number(
          document
            .querySelector('.benchmarks-page')
            ?.getAttribute('data-measured-rounds')
        ),
        warmupRounds: Number(
          document
            .querySelector('.benchmarks-page')
            ?.getAttribute('data-warmup-rounds')
        ),
      },
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
        costContext: {
          label:
            workload
              .querySelector('.cost-context strong')
              ?.textContent?.trim() ?? '',
          body:
            workload.querySelector('.cost-context p')?.textContent?.trim() ??
            '',
        },
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
            reason:
              exclusion
                .querySelector('dd > span:first-child')
                ?.textContent?.trim() ?? '',
            sources: Array.from(exclusion.querySelectorAll('a')).map(
              (source) => ({
                label: source.textContent?.trim() ?? '',
                url: source.href,
                path:
                  source.nextElementSibling?.tagName === 'CODE'
                    ? source.nextElementSibling.textContent?.trim() ?? ''
                    : '',
              })
            ),
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
            packages: Array.from(
              row.querySelectorAll('.package-versions code')
            ).map((packageReference) => packageReference.textContent?.trim()),
            sources: Array.from(
              row.querySelectorAll('.implementation-source-links a')
            ).map((source) => ({
              label: source.textContent?.trim() ?? '',
              url: source.href,
              path:
                source.nextElementSibling?.tagName === 'CODE'
                  ? source.nextElementSibling.textContent?.trim() ?? ''
                  : '',
            })),
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
        reproduction: {
          sources: Array.from(
            workload.querySelectorAll('.evidence-line a')
          ).map((source) => ({
            label: source.textContent?.trim() ?? '',
            url: source.href,
            path:
              source.nextElementSibling?.tagName === 'CODE'
                ? source.nextElementSibling.textContent?.trim() ?? ''
                : '',
          })),
          command:
            workload.querySelector('.evidence-command')?.textContent?.trim() ??
            '',
        },
      })),
      steadyStateProfile: (() => {
        const profile = document.querySelector('.steady-state-value');
        if (!profile) return null;

        return {
          signalTreeArmId: profile.getAttribute('data-profile-arm-id'),
          normalization:
            'Measured median / measured operations * requested operation count',
          workloads: Array.from(
            profile.querySelectorAll('.steady-state-row')
          ).map((row) => ({
            workloadId: row.getAttribute('data-profile-workload'),
            title:
              row
                .querySelector('.steady-workload strong')
                ?.textContent?.trim() ?? '',
            unit:
              row
                .querySelector('.steady-workload small')
                ?.textContent?.trim() ?? '',
            measuredMedianMs: Number(
              row.getAttribute('data-measured-median-ms')
            ),
            measuredOperations: Number(
              row.getAttribute('data-measured-operations')
            ),
            perThousandMs: Number(row.getAttribute('data-per-thousand-ms')),
            perTenThousandMs: Number(
              row.getAttribute('data-per-ten-thousand-ms')
            ),
            perHundredThousandMs: Number(
              row.getAttribute('data-per-hundred-thousand-ms')
            ),
            position: Number(row.getAttribute('data-position')),
            cohortSize: Number(row.getAttribute('data-cohort-size')),
          })),
        };
      })(),
      foundations: Array.from(
        document.querySelectorAll('.foundation-grid article')
      ).map((foundation) => ({
        status:
          foundation.querySelector('.foundation-status')?.textContent?.trim() ??
          '',
        title: foundation.querySelector('h3')?.textContent?.trim() ?? '',
        evidence: Array.from(
          foundation.querySelectorAll('.foundation-evidence code')
        ).map((source) => source.textContent?.trim() ?? ''),
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
    ({ costContext, capability, calculation, results, reproduction }) =>
      !costContext.label ||
      !costContext.body ||
      !capability.title ||
      capability.requirements.length === 0 ||
      capability.exclusions.some(
        ({ label, reason, sources }) =>
          !label || !reason || sources.length === 0
      ) ||
      Object.values(calculation).some((value) => !value) ||
      !reproduction.command ||
      reproduction.sources.length !== 3 ||
      results.some(
        ({ capabilityKind, packages, sources }) =>
          !capabilityKind ||
          capabilityKind.startsWith('Harness') ||
          packages.length === 0 ||
          sources.length === 0
      )
  );
  if (invalidCapability) {
    throw new Error(
      `Invalid capability contract for ${
        invalidCapability.id ?? 'unknown workload'
      }`
    );
  }

  if (
    report.workloads.length !== 3 ||
    !Number.isInteger(report.measurementPlan.measuredRounds) ||
    report.measurementPlan.measuredRounds < 1 ||
    !Number.isInteger(report.measurementPlan.warmupRounds) ||
    report.measurementPlan.warmupRounds < 0 ||
    report.workloads.reduce(
      (total, workload) => total + workload.results.length,
      0
    ) !== expectedRows ||
    !report.steadyStateProfile ||
    !report.steadyStateProfile.signalTreeArmId ||
    !report.steadyStateProfile.normalization ||
    report.steadyStateProfile.workloads.length !== 3 ||
    report.steadyStateProfile.workloads.some(
      ({
        workloadId,
        title,
        unit,
        measuredMedianMs,
        measuredOperations,
        perThousandMs,
        perTenThousandMs,
        perHundredThousandMs,
        position,
        cohortSize,
      }) =>
        !workloadId ||
        !title ||
        !unit ||
        !Number.isFinite(measuredMedianMs) ||
        !Number.isFinite(measuredOperations) ||
        measuredOperations <= 0 ||
        !Number.isFinite(perThousandMs) ||
        !Number.isFinite(perTenThousandMs) ||
        !Number.isFinite(perHundredThousandMs) ||
        !Number.isInteger(position) ||
        position < 1 ||
        !Number.isInteger(cohortSize) ||
        position > cohortSize
    ) ||
    report.foundations.length !== 4 ||
    report.foundations.some(
      ({ status, title, evidence }) =>
        !status || !title || evidence.length === 0
    )
  ) {
    throw new Error('Invalid recurring benchmark profile');
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Exported ${expectedRows} checked rows to ${outputPath}`);
} finally {
  await browser.close();
}
