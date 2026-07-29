import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');

function readSource(pathFromRoot: string): string {
  return readFileSync(resolve(sourceRoot, pathFromRoot), 'utf8');
}

function productionSources(directory = sourceRoot): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    if (statSync(absolutePath).isDirectory()) {
      return productionSources(absolutePath);
    }

    if (!['.ts', '.tsx'].includes(extname(entry)) || entry.includes('.test.')) {
      return [];
    }

    return [absolutePath];
  });
}

function resolveProductionImport(importer: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(importer), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find((candidate) => existsSync(candidate) && !statSync(candidate).isDirectory()) ?? null;
}

function relativeImports(sourcePath: string): string[] {
  const source = readFileSync(sourcePath, 'utf8');
  const specifiers = Array.from(source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g), (match) => match[1]);
  return specifiers.flatMap((specifier) => resolveProductionImport(sourcePath, specifier) ?? []);
}

describe('frontend import boundaries', () => {
  it('keeps AppShell free of product feature APIs and workflow endpoints', () => {
    const shell = readSource('app/AppShell.tsx');

    expect(shell).not.toMatch(/features\/(assets|upload|search|assistant)\/api/);
    expect(shell).not.toMatch(/\/api\/(assets|search|assistant)/);
    expect(shell).not.toMatch(/use(Asset|Upload|Search|Assistant|Index)/);
  });

  it('keeps shared HTTP neutral and feature APIs pointing inward to it', () => {
    const sharedHttp = readSource('shared/api/http-client.ts');
    const featureApis = [
      'features/auth/api/auth-api.ts',
      'features/workspaces/api/workspaces-api.ts',
      'features/assets/api/assets-api.ts',
      'features/upload/api/upload-api.ts',
      'features/search/api/search-api.ts',
      'features/assistant/api/assistant-api.ts',
    ];

    expect(sharedHttp).not.toMatch(/features\//);
    for (const featureApi of featureApis) {
      expect(readSource(featureApi), featureApi).toMatch(/shared\/api\/http-client/);
    }
  });

  it('contains no browser-to-FastAPI or infrastructure URL in production source', () => {
    const violations = productionSources()
      .map((absolutePath) => ({
        file: relative(sourceRoot, absolutePath),
        source: readFileSync(absolutePath, 'utf8'),
      }))
      .filter(({ source }) => /https?:\/\/[^'"\s]*(?:8000|fastapi)|kafka:\/\/|redis:\/\//i.test(source));

    expect(violations).toEqual([]);
  });

  it('keeps lifecycle independent from assistant and upload independent from polling', () => {
    const lifecycle = readSource('features/assets/hooks/use-asset-lifecycle.ts');
    const upload = readSource('features/upload/hooks/use-asset-upload.ts');

    expect(lifecycle).not.toMatch(/features\/assistant|\.\.\/\.\.\/assistant|useAssetAssistant/);
    expect(upload).not.toMatch(/use-asset-lifecycle|useAssetLifecycle|refetchInterval|setInterval/);
  });

  it('keeps transcript presentation provider-neutral and YouTube playback request-free', () => {
    const transcriptPanel = readSource('features/assets/components/selected-asset-transcript-panel.tsx');
    const activeRowResolver = readSource('entities/transcript/model/active-transcript-row.ts');
    const youtubePlayer = readSource('features/assets/player/youtube-player.tsx');
    const youtubeLoader = readSource('features/assets/player/youtube-iframe-api.ts');

    expect(transcriptPanel).not.toMatch(/window\.YT|iframe_api|youtube-nocookie/);
    expect(activeRowResolver).not.toMatch(/window\.YT|youtube|player\/|features\//i);
    for (const playerSource of [youtubePlayer, youtubeLoader]) {
      expect(playerSource).not.toMatch(/fetch\s*\(|request\s*\(|\/api\//);
    }
  });

  it('keeps the shared player contract provider-neutral with adapter-owned details', () => {
    const mediaContract = readSource('features/assets/player/media-player.ts');
    const youtubePlayer = readSource('features/assets/player/youtube-player.tsx');
    const uploadPlayer = readSource('features/assets/player/upload-media-player.tsx');

    expect(mediaContract).not.toMatch(/youtube|iframe|HTMLMediaElement|HTMLVideoElement|currentTime|timeupdate|loadedmetadata/i);
    expect(mediaContract).not.toMatch(/fetch\s*\(|request\s*\(|\/api\//);
    for (const adapter of [youtubePlayer, uploadPlayer]) {
      expect(adapter).toMatch(/from '\.\/media-player'/);
      expect(adapter).toMatch(/MediaPlayerHandle/);
    }
    expect(youtubePlayer).not.toMatch(/HTMLVideoElement|timeupdate|loadedmetadata/i);
    expect(uploadPlayer).not.toMatch(/window\.YT|iframe_api|youtube/i);
  });

  it('keeps Upload media URL construction inside the asset API boundary', () => {
    const assetsApi = readSource('features/assets/api/assets-api.ts');
    const uploadPlayer = readSource('features/assets/player/upload-media-player.tsx');

    expect(assetsApi).toMatch(/\/api\/assets\/\$\{[^}]+\}\/media/);
    expect(uploadPlayer).not.toMatch(/['"`]\/api\//);
    expect(uploadPlayer).not.toMatch(/fetch\s*\(|\brequest\s*\(|createObjectURL|IndexedDB|serviceWorker|MediaSource/);
    expect(uploadPlayer).not.toMatch(/minio|bucket|objectKey|object_key|presigned|originalFilename/i);
  });

  it('keeps playback progress on the shared HTTP boundary with feature-owned state', () => {
    const assetsApi = readSource('features/assets/api/assets-api.ts');
    const progressHook = readSource('features/assets/hooks/use-asset-playback-progress.ts');
    const queryKeys = readSource('features/assets/hooks/asset-queries.ts');
    const resumeOffer = readSource('features/assets/components/playback-resume-offer.tsx');

    expect(assetsApi).toMatch(/\/api\/assets\/\$\{[^}]+\}\/playback-progress/);
    expect(queryKeys).toMatch(/playbackProgress:/);
    expect(progressHook).toMatch(/assetKeys\.playbackProgress/);
    expect(progressHook).not.toMatch(/['"`]\/api\//);
    expect(progressHook).not.toMatch(/fetch\s*\(|localStorage|sessionStorage|sendBeacon|indexedDB/i);
    // Playback saves must never invalidate Asset, transcript or search caches.
    expect(progressHook).not.toMatch(/invalidateQueries|removeQueries|setQueryData/);
    expect(resumeOffer).not.toMatch(/fetch\s*\(|\brequest\s*\(|['"`]\/api\/|useQuery|useMutation/);
  });

  it('keeps Study playback orchestration free of provider and media-element details', () => {
    const study = readSource('features/assets/detail-screen.tsx');
    const transcriptPanel = readSource('features/assets/components/selected-asset-transcript-panel.tsx');

    expect(study).toMatch(/player\/media-player/);
    expect(study).not.toMatch(/window\.YT|iframe_api|youtube-nocookie|HTMLVideoElement|currentTime|timeupdate|loadedmetadata/);
    expect(study).not.toMatch(/['"`]\/api\//);
    expect(transcriptPanel).not.toMatch(/HTMLVideoElement|currentTime|timeupdate|loadedmetadata|player\//i);
  });

  it('keeps assistant orchestration independent from citation presentation and citations request-free', () => {
    const assistantHook = readSource('features/assistant/hooks/use-asset-assistant.ts');
    const citationList = readSource('features/assistant/components/assistant-citation-list.tsx');
    const citationItem = readSource('features/assistant/components/assistant-citation-item.tsx');
    const citationNavigation = readSource('app/navigation/use-assistant-citation-navigation.ts');

    expect(assistantHook).not.toMatch(/components\/assistant-(answer|citation)/);
    for (const citationSource of [citationList, citationItem, citationNavigation]) {
      expect(citationSource).not.toMatch(/answerAssistant|request\s*\(|fetch\s*\(|\/api\//);
    }
  });

  it('keeps Workspace moment grouping relevance-neutral and responsive presentation bounded', () => {
    const grouping = readSource('features/search/model/group-search-moments.ts');
    const searchPanel = readSource('features/search/search.tsx');
    const styles = readSource('styles.css');
    const mobileStyles = styles.slice(
      styles.indexOf('@media (max-width: 760px)'),
      styles.indexOf('@media (max-width: 430px)'),
    );

    expect(grouping).toMatch(/new Map/);
    expect(grouping).not.toMatch(/\.sort\s*\(/);
    expect(searchPanel).not.toMatch(/fetch\s*\(|\brequest\s*\(|elasticsearch|fastapi/i);
    expect(styles).toMatch(/\.search-result__excerpt[\s\S]*?overflow-wrap:\s*anywhere/);
    expect(mobileStyles).toMatch(/\.search-form\s*\{[\s\S]*?flex-direction:\s*column/);
    expect(mobileStyles).toMatch(
      /\.workspace-moment-results__heading,[\s\S]*?\.search-result-group > header[\s\S]*?flex-direction:\s*column/,
    );
  });

  it('contains no circular production imports', () => {
    const sources = productionSources();
    const sourceSet = new Set(sources);
    const graph = new Map(sources.map((source) => [source, relativeImports(source).filter((target) => sourceSet.has(target))]));
    const active = new Set<string>();
    const complete = new Set<string>();
    const stack: string[] = [];
    const cycles: string[][] = [];

    function visit(source: string) {
      if (complete.has(source)) return;
      if (active.has(source)) {
        const cycleStart = stack.indexOf(source);
        cycles.push([...stack.slice(cycleStart), source].map((path) => relative(sourceRoot, path)));
        return;
      }

      active.add(source);
      stack.push(source);
      for (const target of graph.get(source) ?? []) visit(target);
      stack.pop();
      active.delete(source);
      complete.add(source);
    }

    for (const source of sources) visit(source);
    expect(cycles).toEqual([]);
  });
});
