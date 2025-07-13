
'use client';

import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  type MediaProviderAdapter,
  type MediaPlayerElement,
  AirPlayButton,
} from '@vidstack/react';
import { AirPlayIcon } from '@vidstack/react/icons';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import Hls from 'hls.js';
import type { ContentItem } from '@/types';

function filterAdsFromM3U8(m3u8Content: string): string {
    if (!m3u8Content) return '';
    const lines = m3u8Content.split('\n');
    let outputLines = [];
    // Only use very generic and safe keywords.
    const adKeywords = ['/ads/', 'advertisement'];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#EXTINF') && i + 1 < lines.length) {
            const urlLine = lines[i + 1];
            // If the URL line contains an ad keyword, skip both the #EXTINF line and the URL line.
            if (adKeywords.some(keyword => urlLine.includes(keyword))) {
                i++; // Increment i to skip the URL line on the next iteration.
                continue;
            }
        }
        outputLines.push(line);
    }
    
    return outputLines.join('\n');
}

class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config: any) {
        super(config);
        const load = this.load.bind(this);
        this.load = function (context, config, callbacks) {
            if ((context as any).type === 'manifest' || (context as any).type === 'level') {
                const onSuccess = callbacks.onSuccess;
                callbacks.onSuccess = function (response, stats, context) {
                    if (response.data && typeof response.data === 'string') {
                        response.data = filterAdsFromM3U8(response.data as string);
                    }
                    return onSuccess(response, stats, context, null);
                };
            }
            load(context, config, callbacks);
        };
    }
}

interface VideoPlayerProps {
  item?: ContentItem | null;
  src: string;
  onEnded: () => void;
  onPlayerInit: (player: MediaPlayerElement | null) => void;
  onEnterWebFullscreen: () => void;
  onNextEpisode: () => void;
}

export default function VideoPlayer({
  item,
  src,
  onEnded,
  onPlayerInit,
  onEnterWebFullscreen,
  onNextEpisode,
}: VideoPlayerProps) {
  const onProviderChange = (provider: MediaProviderAdapter | null) => {
    if (isHLSProvider(provider)) {
      provider.library = Hls;
      provider.config = {
        // --- Start of Performance Optimizations ---

        // 1. Timeout and Retry Strategy: "Quick Fail, Many Retries"
        // This helps recover from temporary network glitches faster than waiting for a long timeout.
        manifestLoadTimeout: 60000, // Allow more time for the main playlist to load.
        levelLoadTimeout: 60000,   // More time for sub-playlists.
        fragLoadTimeout: 15000,    // Shorter timeout for individual segments (15s).
        fragLoadRetryDelay: 1000,  // Wait 1s before retrying a failed segment.
        fragLoadMaxRetry: 8,       // Retry a segment up to 8 times.

        // 2. Buffer Strategy: "Buffer Aggressively"
        // This is key to surviving slow segment loads without stuttering.
        maxBufferLength: 180,              // Aim to have 3 minutes of video buffered ahead.
        maxBufferSize: 120 * 1024 * 1024,  // Allow HLS to use up to 120MB of memory for this buffer.
        maxMaxBufferLength: 300,           // The absolute maximum buffer, even in good conditions (5 minutes).

        // --- End of Performance Optimizations ---
        
        autoStartLoad: true,
        loader: CustomHlsJsLoader,
      };
    }
  };

  return (
    <MediaPlayer
      ref={onPlayerInit}
      className={'w-full h-full bg-black'}
      src={src}
      poster={item?.posterUrl}
      playsInline
      autoPlay
      volume={0.8}
      crossOrigin="anonymous"
      onProviderChange={onProviderChange}
      onEnded={onEnded}
    >
      <MediaProvider />
      <DefaultVideoLayout
        icons={defaultLayoutIcons}
        slots={{
          googleCastButton: null,
          pipButton: null,
          settingsMenu: null,
          beforeCurrentTime: (
            <button
              className="vds-button mr-2"
              onClick={onNextEpisode}
              aria-label="Next Episode"
            >
              <svg
                className="vds-icon"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 24l12-8L6 8v16zM22 8v16h3V8h-3z"
                  fill="currentColor"
                />
              </svg>
            </button>
          ),
          beforeFullscreenButton: (
            <>
              <button
                onClick={onEnterWebFullscreen}
                className="vds-button"
                aria-label="网页全屏"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="vds-icon"
                >
                  <title>网页全屏</title>
                  <rect x="3" y="7" width="6" height="10" rx="1"></rect>
                  <rect x="11" y="4" width="10" height="6" rx="1"></rect>
                </svg>
              </button>
              <AirPlayButton className="vds-button">
                <AirPlayIcon className="vds-icon" />
              </AirPlayButton>
            </>
          ),
        }}
      />
    </MediaPlayer>
  );
}
