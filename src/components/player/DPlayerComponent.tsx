
'use client';

import type { FC } from 'react';
import { useEffect, useRef } from 'react';
import DPlayer, { type DPlayerOptions, type DPlayerEvents } from 'dplayer';
import 'dplayer/dist/DPlayer.min.css'; // Import DPlayer CSS

interface DPlayerComponentProps {
  videoUrl: string | null;
  autoplay?: boolean;
  onPlayerError?: (errorType: DPlayerEvents | string, errorData: any) => void;
  onPlayerReady?: () => void;
}

const DPlayerComponent: FC<DPlayerComponentProps> = ({
  videoUrl,
  autoplay = true,
  onPlayerError,
  onPlayerReady,
}) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<DPlayer | null>(null);

  useEffect(() => {
    if (playerContainerRef.current && videoUrl) {
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
        theme: '#00a1d6', // A nice blue theme
        lang: 'zh-cn',
        screenshot: true,
        hotkey: true,
        preload: 'auto',
        mutex: true, // Pause other DPlayers
      };

      try {
        const dp = new DPlayer(options);
        playerRef.current = dp;

        dp.on('ready', () => {
          if (onPlayerReady) {
            onPlayerReady();
          }
        });
        
        if (onPlayerError) {
          dp.on('error', (data: any) => {
            console.warn('DPlayer Component Event: error', data);
            onPlayerError('error', data); 
          });
        }
      } catch (error) {
        console.error('Failed to initialize DPlayer:', error);
        if (onPlayerError) {
          onPlayerError('initialization_error', error);
        }
      }
    } else if (playerRef.current && !videoUrl) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoUrl, autoplay, onPlayerError, onPlayerReady]);

  return (
    <div ref={playerContainerRef} style={{ width: '100%', height: '100%' }} />
  );
};

export default DPlayerComponent;
