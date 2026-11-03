import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import '../index';
import {
  EntityPublicationSource,
  type EntityPublicationPacket as Packet,
  type EntityPublicationEdit as Edit,
} from './internals/entity-publication';
import { installTerminalRecord } from './internals/intrinsic-mutation';
it.each([false, true])(
  'singleton pairing preserves endpoint and records allocation control (stepped=%s)',
  (stepped) => {
    const source = new EntityPublicationSource();
    const physical: Edit = {
      subject: 1,
      before: undefined,
      after: { x: 1 },
      fields: ['x'],
    };
    const ordinary: Edit = { ...physical };
    let reads = 0;
    const packet: Packet = {
      owner: 1,
      id: {},
      meta: undefined,
      ordinary: [ordinary],
      physical: [physical],
      ...(stepped
        ? {
            steps: [{ ordinal: 0, ordinary: [ordinary], physical: [physical] }],
          }
        : {}),
      prepareResponsibility: (selection) => {
        reads++;
        expect(selection!.proposed(1, 'x').value).toBe(1);
        return undefined;
      },
    };
    source.evidence(); // Initialize native participant outside the measured interval.
    const NativeMap = globalThis.Map;
    let allocations = 0;
    class CountedMap<K, V> extends NativeMap<K, V> {
      constructor(entries?: Iterable<readonly [K, V]> | null) {
        super(entries);
        allocations++;
      }
    }
    try {
      globalThis.Map = CountedMap;
      new Map();
      expect(allocations).toBe(1);
      allocations = 0;
      let unit;
      try {
        unit = source.prepare(packet);
      } finally {
        globalThis.Map = NativeMap;
      }
      const measured = allocations;
      expect(unit).toBeDefined();
      unit!.finalize?.();
      installTerminalRecord(unit!.record);
      source.complete(unit!.completion);
      expect(reads).toBe(1);
      expect(source.inspect().rows).toBe(1);
      expect(measured).toBeGreaterThan(0);
      const out = process.env.ST_PACKET_PAIR_OUTPUT;
      if (out) {
        mkdirSync(out, { recursive: true });
        writeFileSync(
          `${out}/singleton-${stepped}.json`,
          JSON.stringify({ stepped, allocations: measured })
        );
      }
    } finally {
      globalThis.Map = NativeMap;
      source.dispose();
    }
  }
);
