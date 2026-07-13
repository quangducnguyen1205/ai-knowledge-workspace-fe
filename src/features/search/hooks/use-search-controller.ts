import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTranscriptContext, searchTranscript, type SearchResult } from '../api/search-api';
import { resolveTranscriptLookupId } from '../model/search-result-reference';

export type SearchParams = { query: string; workspaceId: string; assetId?: string | null };
export type TranscriptContextParams = { assetId: string; transcriptRowId: string; window: number };

export const searchKeys = {
  all: ['search'] as const,
  results: (workspaceId: string, query: string, assetId?: string | null) =>
    ['search', 'results', workspaceId, assetId ?? 'all-assets', query] as const,
  context: (assetId: string, transcriptRowId: string, window: number) =>
    ['search', 'context', assetId, transcriptRowId, window] as const,
};

export function useTranscriptContextQuery(params: TranscriptContextParams | null) {
  return useQuery({
    queryKey: params ? searchKeys.context(params.assetId, params.transcriptRowId, params.window) : ['search', 'context', 'empty'],
    queryFn: ({ signal }) => getTranscriptContext(params?.assetId ?? '', params?.transcriptRowId ?? '', params?.window ?? 2, signal),
    enabled: Boolean(params?.assetId && params?.transcriptRowId),
  });
}

export function useSearchController({
  workspaceId,
  assetId,
}: {
  workspaceId: string | null;
  assetId?: string | null;
}) {
  const [submittedSearch, setSubmittedSearch] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const selectedResultRef = useRef<SearchResult | null>(null);
  const scopeKey = `${workspaceId ?? 'no-workspace'}:${assetId ?? 'all-assets'}`;

  useEffect(() => {
    selectedResultRef.current = selectedResult;
  }, [selectedResult]);

  const reset = useCallback(() => {
    setSubmittedSearch(null);
    setSelectedResult(null);
    setResetToken((current) => current + 1);
  }, []);

  useEffect(() => reset(), [reset, scopeKey]);

  const searchQuery = useQuery({
    queryKey: submittedSearch && workspaceId
      ? searchKeys.results(workspaceId, submittedSearch, assetId)
      : ['search', 'results', 'empty', assetId ?? 'all-assets'],
    queryFn: ({ signal }) => searchTranscript(submittedSearch ?? '', workspaceId ?? '', assetId, signal),
    enabled: Boolean(submittedSearch && workspaceId),
  });

  useEffect(() => {
    const results = searchQuery.data?.results;
    if (!selectedResult || !results) return;
    const stillPresent = results.some((result) =>
      result.assetId === selectedResult.assetId &&
      result.transcriptRowId === selectedResult.transcriptRowId &&
      result.segmentIndex === selectedResult.segmentIndex,
    );
    if (!stillPresent) setSelectedResult(null);
  }, [searchQuery.data?.results, selectedResult]);

  const contextLookupId = selectedResult ? resolveTranscriptLookupId(selectedResult) : null;
  const contextQuery = useTranscriptContextQuery(
    selectedResult && contextLookupId
      ? { assetId: selectedResult.assetId, transcriptRowId: contextLookupId, window: 2 }
      : null,
  );

  const submit = useCallback((query: string) => {
    setSubmittedSearch(query.trim());
    setSelectedResult(null);
  }, []);

  const updateAssetTitle = useCallback((targetAssetId: string, title: string) => {
    setSelectedResult((current) => current?.assetId === targetAssetId ? { ...current, assetTitle: title } : current);
  }, []);
  const clearSelectedResult = useCallback(() => setSelectedResult(null), []);

  return {
    submittedSearch,
    selectedResult,
    selectedResultRef,
    resetToken,
    searchResponse: searchQuery.data,
    searchError: searchQuery.error,
    isSearching: searchQuery.isLoading || searchQuery.isFetching,
    contextResponse: contextQuery.data,
    contextError: contextQuery.error,
    isContextLoading: contextQuery.isLoading || contextQuery.isFetching,
    setSelectedResult,
    clearSelectedResult,
    submit,
    reset,
    updateAssetTitle,
  };
}
