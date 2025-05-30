
'use client';

import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
// Import types statically
import type DPlayerType from 'dplayer';
import type { DPlayerOptions, DPlayerEvents } from 'dplayer';

interface DPlayerComponentProps {
  videoUrl: string | null;
  autoplay?: boolean;
  onPlayerError?: (errorType: string, errorData: any) => void;
  onPlayerReady?: () => void;
}

const DPlayerComponent: FC<DPlayerComponentProps> = ({
  videoUrl,
  autoplay = true,
  onPlayerError,
  onPlayerReady,
}) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<DPlayerType | null>(null);
  const [DPlayer, setDPlayer] = useState<typeof DPlayerType | null>(null);

  useEffect(() => {
    // Dynamically import DPlayer only on the client side
    import('dplayer').then(module => {
      setDPlayer(() => module.default);
    });
  }, []);

  useEffect(() => {
    if (!DPlayer || !playerContainerRef.current || !videoUrl) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      return;
    }

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const options: DPlayerOptions = {
      container: playerContainerRef.current,
      autoplay: autoplay,
      video: {
        url: videoUrl,
        type: 'auto', 
      },
      theme: '#00a1d6',
      lang: 'zh-cn',
      screenshot: true,
      hotkey: true,
      preload: 'auto',
      mutex: true,
    };

    try {
      const dp = new DPlayer(options);
      playerRef.current = dp;

      dp.on('loadedmetadata' as DPlayerEvents, () => {
        if (onPlayerReady) {
          onPlayerReady();
        }
      });
      
      if (onPlayerError) {
        dp.on('error' as DPlayerEvents, (dplayerEventData: any) => {
          let errorToReport = dplayerEventData; // Default to what DPlayer provides

          // Check if it's a standard DOM Event that might contain a MediaError
          // DPlayer's 'error' event might pass the original HTMLMediaElement event or its error property
          if (dplayerEventData instanceof Event && dplayerEventData.target && (dplayerEventData.target as HTMLVideoElement).error) {
            const mediaError = (dplayerEventData.target as HTMLVideoElement).error;
            if (mediaError) { 
              errorToReport = mediaError; 
              console.warn('DPlayerComponent: Extracted MediaError from DOM Event:', JSON.stringify(errorToReport, Object.getOwnPropertyNames(errorToReport)));
            } else {
              console.warn('DPlayerComponent: DOM Event received, but target.error is null. Using DPlayer event data:', dplayerEventData);
            }
          } else if (dplayerEventData && dplayerEventData.type && dplayerEventData.details) {
            // This looks like an HLS.js or DASH.js error object DPlayer might pass directly
             console.warn('DPlayerComponent: Error looks like HLS/DASH.js error object:', JSON.stringify(dplayerEventData));
             // errorToReport is already dplayerEventData
          } else if (dplayerEventData && typeof dplayerEventData.code === 'number' && typeof dplayerEventData.message === 'string') {
            // This might be a MediaError object passed directly by DPlayer
            console.warn('DPlayerComponent: Error looks like a direct MediaError object:', JSON.stringify(dplayerEventData));
            // errorToReport is already dplayerEventData
          }
          else {
             console.warn('DPlayerComponent: DPlayer "error" event payload (not a DOM event with MediaError or recognized HLS/DASH error):', 
                (typeof dplayerEventData === 'object' && dplayerEventData !== null) 
                ? JSON.stringify(dplayerEventData) 
                : dplayerEventData
            );
          }
          onPlayerError('dplayer_error', errorToReport);
        });
      }
    } catch (error) {
      console.error('Failed to initialize DPlayer:', error);
      if (onPlayerError) {
        onPlayerError('initialization_error', error);
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoUrl, autoplay, onPlayerError, onPlayerReady, DPlayer]);

  return (
    <div ref={playerContainerRef} style={{ width: '100%', height: '100%' }} />
  );
};

export default DPlayerComponent;
