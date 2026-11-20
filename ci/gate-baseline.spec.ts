import { describe, expect, it } from 'vitest';
import { decide, newestMainArtifact } from './gate-baseline.mjs';

const artifact = { id: 7, created_at: '2026-11-20T00:00:00Z' };
const ok = () => ({ path: '/tmp/main-gates/aa-latest.json', recordedOn: 'self-hosted' });
const hosted = () => ({ path: '/tmp/main-gates/aa-latest.json', recordedOn: 'github-hosted' });
const unlabeled = () => ({ path: '/tmp/main-gates/aa-latest.json' });
const broken = () => ({ error: 'HTTP 403: Resource not accessible by integration' });

describe('gate baseline fetch', () => {
  it('uses main baseline when it downloads', () => {
    expect(decide({ onGateRunner: true, approved: true, listing: { artifact }, download: ok })).toMatchObject({ action: 'use', path: '/tmp/main-gates/aa-latest.json' });
  });

  it('fails when main has a baseline but fetching it fails, approved or not', () => {
    expect(decide({ onGateRunner: true, approved: false, listing: { artifact }, download: broken }).action).toBe('fail');
    expect(decide({ onGateRunner: true, approved: true, listing: { artifact }, download: broken }).action).toBe('fail');
  });

  it('fails when the artifact listing fails, for example without actions: read', () => {
    expect(decide({ onGateRunner: true, approved: false, listing: { error: 'HTTP 403' }, download: ok }).action).toBe('fail');
  });

  it('allows "no baseline yet" only while budgets.json is not approved', () => {
    expect(decide({ onGateRunner: true, approved: false, listing: { artifact: null }, download: ok }).action).toBe('none');
    expect(decide({ onGateRunner: true, approved: true, listing: { artifact: null }, download: ok }).action).toBe('fail');
  });

  it('compares only a run on the gate runner with a baseline recorded on it', () => {
    expect(decide({ onGateRunner: true, approved: true, listing: { artifact }, download: ok }).action).toBe('use');
    for (const download of [hosted, unlabeled]) {
      expect(decide({ onGateRunner: true, approved: false, listing: { artifact }, download }).action).toBe('none');
      expect(decide({ onGateRunner: true, approved: true, listing: { artifact }, download }).action).toBe('fail');
    }
    expect(decide({ onGateRunner: false, approved: false, listing: { artifact }, download: ok }).action).toBe('none');
    expect(decide({ onGateRunner: false, approved: true, listing: { artifact }, download: ok }).action).toBe('fail');
  });

  it('still fails off the gate runner when the listing fails', () => {
    expect(decide({ onGateRunner: false, approved: false, listing: { error: 'HTTP 403' }, download: ok }).action).toBe('fail');
  });

  it('picks the newest unexpired gate-results artifact from main only', () => {
    const list = [
      { id: 1, name: 'gate-results', expired: false, created_at: '2026-11-19T00:00:00Z', workflow_run: { head_branch: 'main' } },
      { id: 2, name: 'gate-results', expired: false, created_at: '2026-11-21T00:00:00Z', workflow_run: { head_branch: 'rebuild/x' } },
      { id: 3, name: 'gate-results', expired: true, created_at: '2026-11-22T00:00:00Z', workflow_run: { head_branch: 'main' } },
      { id: 4, name: 'oracle-report', expired: false, created_at: '2026-11-23T00:00:00Z', workflow_run: { head_branch: 'main' } },
      { id: 5, name: 'gate-results', expired: false, created_at: '2026-11-20T00:00:00Z', workflow_run: { head_branch: 'main' } },
    ];
    expect(newestMainArtifact(list)?.id).toBe(5);
    expect(newestMainArtifact([])).toBeNull();
  });
});
