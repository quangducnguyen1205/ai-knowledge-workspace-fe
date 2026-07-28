import { describe, expect, it } from 'vitest';
import type { TranscriptRow } from './types';
import {
  getTranscriptRowIdentity,
  resolveActiveTranscriptRow,
} from './active-transcript-row';

function row(
  id: string | null,
  segmentIndex: number | null,
  startMs: number | null,
  endMs: number | null,
): TranscriptRow {
  return {
    id,
    videoId: 'asset-1',
    segmentIndex,
    startMs,
    endMs,
    text: id ?? `segment ${segmentIndex ?? 'unknown'}`,
    createdAt: null,
  };
}

describe('active transcript row resolution', () => {
  it('uses inclusive starts, exclusive ends, and preserves startMs zero', () => {
    const rows = [row('zero', 0, 0, 1_000), row('next', 1, 1_000, 2_000)];

    expect(resolveActiveTranscriptRow(rows, 0)?.identity).toBe('id:zero');
    expect(resolveActiveTranscriptRow(rows, 999)?.identity).toBe('id:zero');
    expect(resolveActiveTranscriptRow(rows, 1_000)?.identity).toBe('id:next');
    expect(resolveActiveTranscriptRow(rows, 2_000)).toBeNull();
  });

  it('returns no row for gaps, invalid positions, or missing/partial timing', () => {
    const rows = [
      row('legacy', 0, null, null),
      row('partial', 1, 500, null),
      row('valid', 2, 2_000, 3_000),
    ];

    expect(resolveActiveTranscriptRow(rows, 1_500)).toBeNull();
    expect(resolveActiveTranscriptRow(rows, -1)).toBeNull();
    expect(resolveActiveTranscriptRow(rows, Number.NaN)).toBeNull();
    expect(resolveActiveTranscriptRow(rows, null)).toBeNull();
  });

  it('resolves backward seeks and large forward jumps directly', () => {
    const rows = [
      row('early', 0, 0, 1_000),
      row('middle', 1, 10_000, 11_000),
      row('late', 2, 100_000, 101_000),
    ];

    expect(resolveActiveTranscriptRow(rows, 100_500)?.identity).toBe('id:late');
    expect(resolveActiveTranscriptRow(rows, 500)?.identity).toBe('id:early');
  });

  it('chooses overlap winner by greatest start, then segment index, then input order', () => {
    const rows = [
      row('wide', 9, 0, 10_000),
      row('later-high', 4, 5_000, 9_000),
      row('later-low-first', 2, 5_000, 8_000),
      row('later-low-second', 2, 5_000, 7_000),
    ];

    expect(resolveActiveTranscriptRow(rows, 6_000)?.identity).toBe('id:later-low-first');
  });

  it('uses stable identity priority without mutating canonical input order', () => {
    const rows = [
      row(null, 7, 0, 2_000),
      row(null, null, 0, 2_000),
      row('canonical', 9, 0, 2_000),
    ];
    const original = [...rows];

    expect(getTranscriptRowIdentity(rows[0], 0)).toBe('segment:7');
    expect(getTranscriptRowIdentity(rows[1], 1)).toBe('index:1');
    expect(getTranscriptRowIdentity(rows[2], 2)).toBe('id:canonical');
    resolveActiveTranscriptRow(rows, 1_000);
    expect(rows).toEqual(original);
  });
});
