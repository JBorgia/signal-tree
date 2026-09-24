/** Harness falsifiers only: no production patches or whole-law claims. */
import { describe, expect, it } from 'vitest';
import { makeCurrent } from './semantics-current-adapter';
import { makeComposition } from './semantics-composition-adapter';
import { COMBINATIONS } from './semantics-composition-domain';
import { COMPOSITION_CASES } from './semantics-composition';
import { runSupplemental, type Fixture } from './semantics-supplemental';
import { UnsupportedSemantic } from './semantics-contract';

function testCase(id: string) {
  const test = COMPOSITION_CASES.find((row) => row.id === id);
  if (!test) throw new Error(`Missing frozen case ${id}`);
  return test;
}
async function run(factory: () => Promise<Fixture>, id: string) {
  return (
    await runSupplemental({ scalar: factory, occupied: factory }, [
      testCase(id),
    ])
  )[0];
}

describe('composition evidence integrity', () => {
  it('has unique frozen cases and nine distinct actual combinations', () => {
    expect(new Set(COMPOSITION_CASES.map((row) => row.id)).size).toBe(
      COMPOSITION_CASES.length
    );
    expect(new Set(COMBINATIONS.map((row) => row.id)).size).toBe(9);
  });
  it('missing batching is unsupported, not a direct-scope substitute', async () => {
    const row = await run(
      () => makeComposition(COMBINATIONS[0]),
      'CCTX2/coalesce/transaction'
    );
    expect(row.status).toBe('unsupported');
  });
  it('constructor UnsupportedSemantic is an error', async () => {
    const row = await run(async () => {
      throw new UnsupportedSemantic('construction failed');
    }, 'CCTX2/direct/transaction');
    expect(row.status).toBe('error');
  });
  for (const leak of ['immediate', 'latent'] as const) {
    it(`detects ${leak} refused-unit writes without blaming prior outer writes`, async () => {
      const factory = async (): Promise<Fixture> => {
        const f = await makeCurrent();
        const marker = new Error('mock refusal');
        let armed = false;
        return {
          ...f,
          candidate: {
            ...f.candidate,
            beginContribution() {
              armed = true;
              throw marker;
            },
          },
          write(key, value) {
            f.write(key, value);
            if (armed && leak === 'latent') f.write('y', 8);
          },
          composition: {
            group(_mode, operation) {
              operation();
              if (armed && leak === 'immediate') f.write('x', 7);
            },
            external(operation) {
              operation();
            },
            undoable(operation) {
              operation();
            },
            undo() {
              return;
            },
            readEntityState: () => [],
            outbound() {
              throw new UnsupportedSemantic('not used in this falsifier');
            },
            isCompositionRefusal: (error) => error === marker,
          },
        };
      };
      const row = await run(factory, 'CCTX4-CCTX5/coalesce/inner-transaction');
      expect(row.status).toBe('violated');
      expect(
        row.assertions.some(
          (a) =>
            a.status === 'violated' &&
            a.label.includes(leak === 'latent' ? 'latent' : 'zero writes')
        )
      ).toBe(true);
    });
  }
  it('passes a true zero-write refusal while retaining prior outer work', async () => {
    const row = await run(
      () => makeComposition(COMBINATIONS[3]),
      'CCTX4-CCTX5/coalesce/inner-transaction'
    );
    expect(row.status).toBe('held');
    expect(
      row.assertions.some(
        (a) =>
          a.label === 'zero writes from refused unit; prior outer z survives' &&
          a.status === 'held'
      )
    ).toBe(true);
  });
});
