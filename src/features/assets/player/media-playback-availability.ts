import type { AssetSummary } from '../model/types';
import { supportsNativeMediaPlayback } from './upload-media-player';

export type MediaPlaybackAvailability = {
  youtubeVideoId: string | null;
  uploadMediaAssetId: string | null;
  available: boolean;
};

/**
 * Resolves which single media adapter Study may mount for an Asset, and whether a usable
 * player exists at all. Upload playback additionally depends on the authentication mode,
 * because a native media element cannot carry an in-memory bearer token.
 */
export function resolveMediaPlaybackAvailability(
  asset: AssetSummary | null | undefined,
): MediaPlaybackAvailability {
  const youtubeVideoId = asset?.sourceType === 'YOUTUBE' ? asset.youtubeVideoId : null;
  const uploadMediaAssetId = asset?.sourceType === 'UPLOAD' ? asset.assetId : null;
  const uploadPlaybackAvailable = uploadMediaAssetId !== null && supportsNativeMediaPlayback();

  return {
    youtubeVideoId,
    uploadMediaAssetId,
    available: Boolean(youtubeVideoId) || uploadPlaybackAvailable,
  };
}
