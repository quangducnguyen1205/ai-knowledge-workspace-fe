export function formatTranscriptTimestamp(timeMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1_000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return hours > 0
    ? `${padTime(hours)}:${padTime(minutes)}:${padTime(seconds)}`
    : `${padTime(minutes)}:${padTime(seconds)}`;
}

function padTime(value: number): string {
  return String(value).padStart(2, '0');
}
