import { useCallback, useEffect, useMemo, useState } from 'react';

export const EPHEMERAL_NOTICE_DURATION_MS = 4_000;

export type NoticeCopy = {
  title: string;
  message: string;
};

export type EphemeralNotice = NoticeCopy & {
  dismiss: () => void;
};

export function useEphemeralNotice(
  contextKey: string,
  durationMs = EPHEMERAL_NOTICE_DURATION_MS,
) {
  const [copy, setCopy] = useState<NoticeCopy | null>(null);
  const clearNotice = useCallback(() => setCopy(null), []);
  const showNotice = useCallback((nextCopy: NoticeCopy) => setCopy(nextCopy), []);

  useEffect(() => {
    if (!copy) return undefined;
    const timeoutId = window.setTimeout(clearNotice, durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [clearNotice, copy, durationMs]);

  useEffect(() => clearNotice(), [clearNotice, contextKey]);

  const notice = useMemo<EphemeralNotice | null>(
    () => copy ? { ...copy, dismiss: clearNotice } : null,
    [clearNotice, copy],
  );

  return { notice, showNotice, clearNotice };
}
