import { describe, expect, it } from 'vitest';
import { formatTranscriptTimestamp } from './transcript-time';

describe('transcript timestamp formatting', () => {
  it('preserves zero and formats longer timestamps for accessible seek labels', () => {
    expect(formatTranscriptTimestamp(0)).toBe('00:00');
    expect(formatTranscriptTimestamp(4_999)).toBe('00:04');
    expect(formatTranscriptTimestamp(65_000)).toBe('01:05');
    expect(formatTranscriptTimestamp(3_661_000)).toBe('01:01:01');
  });
});
