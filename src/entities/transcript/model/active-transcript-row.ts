import type { TranscriptRow } from './types';

export type ActiveTranscriptRow = {
  identity: string;
  index: number;
  row: TranscriptRow;
};

export function getTranscriptRowIdentity(row: TranscriptRow, index: number): string {
  if (row.id) return `id:${row.id}`;
  if (row.segmentIndex !== null) return `segment:${row.segmentIndex}`;
  return `index:${index}`;
}

export function resolveActiveTranscriptRow(
  rows: readonly TranscriptRow[],
  positionMs: number | null,
): ActiveTranscriptRow | null {
  if (positionMs === null || !Number.isFinite(positionMs) || positionMs < 0) return null;

  let winner: ActiveTranscriptRow | null = null;

  rows.forEach((row, index) => {
    if (
      row.startMs === null ||
      row.endMs === null ||
      row.endMs <= row.startMs ||
      positionMs < row.startMs ||
      positionMs >= row.endMs
    ) {
      return;
    }

    const candidate: ActiveTranscriptRow = {
      identity: getTranscriptRowIdentity(row, index),
      index,
      row,
    };
    if (!winner || candidateWins(candidate, winner)) winner = candidate;
  });

  return winner;
}

function candidateWins(candidate: ActiveTranscriptRow, current: ActiveTranscriptRow): boolean {
  const candidateStart = candidate.row.startMs as number;
  const currentStart = current.row.startMs as number;
  if (candidateStart !== currentStart) return candidateStart > currentStart;

  const candidateSegment = candidate.row.segmentIndex ?? Number.POSITIVE_INFINITY;
  const currentSegment = current.row.segmentIndex ?? Number.POSITIVE_INFINITY;
  if (candidateSegment !== currentSegment) return candidateSegment < currentSegment;

  return candidate.index < current.index;
}
