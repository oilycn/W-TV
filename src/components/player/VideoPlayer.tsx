
'use client';

import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  type MediaProviderAdapter,
  type MediaPlayerInstance,
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
    const adKeywords = ['/ads/', 'advertisement', 'promot', 'banner'];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#EXTINF') && i + 1 < lines.length) {
            const urlLine = lines[i + 1];
            if (adKeywords.some(keyword => urlLine.toLowerCase().includes(keyword))) {
                i++;
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
  onPlayerInit: (player: MediaPlayerInstance | null) => void;
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
        // --- 深度参考 Jable 与 W-TV 的 HLS 优化配置 ---
        
        // 1. 极致启动速度：优先加载极小缓冲实现秒开
        maxBufferSize: 30 * 1024 * 1024,      // 降低最大缓存限制，提高内存效率
        maxBufferLength: 300,                // 目标缓冲 5 分钟
        enableWorker: true,                  // 开启 Web Worker 多线程解码
        lowLatencyMode: true,                // 开启低延迟直播/点播模式
        
        // 2. 强效容错与纠错：应对弱源环境
        manifestLoadingTimeOut: 45000,
        manifestLoadingMaxRetry: 5,
        levelLoadingTimeOut: 30000,
        levelLoadingMaxRetry: 5,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 10,                // 高重试次数，应对源断开
        fragLoadingRetryDelay: 1000,
        
        // 3. 智能生命周期管理
        autoStartLoad: true,
        startLevel: -1,                      // 自动选择最佳初始质量
        
        loader: CustomHlsJsLoader,
      };

      // 监听 HLS 致命错误并自动尝试修复 (参考 W-TV 集成脚本)
      provider.instance?.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("网络异常，尝试快速重连...");
              provider.instance?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("解码异常，尝试修复轨道...");
              provider.instance?.recoverMediaError();
              break;
            default:
              console.error("播放器遭遇致命错误，尝试彻底重置...");
              provider.instance?.destroy();
              break;
          }
        }
      });
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
          pipButton: <AirPlayButton className="vds-button"><AirPlayIcon className="vds-icon" /></AirPlayButton>,
          settingsMenu: null,
          beforeCurrentTime: (
            <button
              className="vds-button mr-2"
              onClick={onNextEpisode}
              aria-label="下一集"
            >
              <svg className="vds-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 24l12-8L6 8v16zM22 8v16h3V8h-3z" fill="currentColor" />
              </svg>
            </button>
          ),
          beforeFullscreenButton: (
            <button
              onClick={onEnterWebFullscreen}
              className="vds-button"
              aria-label="网页全屏"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vds-icon">
                <title>网页全屏</title>
                <rect x="3" y="7" width="6" height="10" rx="1"></rect>
                <rect x="11" y="4" width="10" height="6" rx="1"></rect>
              </svg>
            </button>
          ),
        }}
      />
    </MediaPlayer>
  );
}
