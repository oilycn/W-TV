
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
  isWebFullscreen?: boolean;
  onNextEpisode: () => void;
}

export default function VideoPlayer({
  item,
  src,
  onEnded,
  onPlayerInit,
  onEnterWebFullscreen,
  isWebFullscreen = false,
  onNextEpisode,
}: VideoPlayerProps) {
  const onProviderChange = (provider: MediaProviderAdapter | null) => {
    if (isHLSProvider(provider)) {
      provider.library = Hls;
      provider.config = {
        // --- 影视点播 (VoD) 优化配置 ---
        
        // 1. 缓冲策略优化：避免频繁小块请求 (Fixes "constant loading")
        // 移除 lowLatencyMode，因为它会强制高频拉取
        maxBufferLength: 60,                 // 目标缓冲 60 秒（足够流畅，且不会因缓冲太大触碰内存上限频繁截断）
        maxMaxBufferLength: 120,             // 最大允许缓冲 120 秒
        maxBufferSize: 60 * 1024 * 1024,     // 提高内存上限至 60MB，允许一次性下载较多片段
        enableWorker: true,                  // 开启 Web Worker 多线程解码
        
        // 2. 强效容错与纠错：应对弱源环境
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 5,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 5,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 10,             // 高重试次数，应对源断开
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

const chineseTranslations = {
  Speed: "倍速",
  Normal: "正常",
  Quality: "画质",
  Auto: "自动",
  Audio: "音频",
  Captions: "字幕",
  Settings: "设置",
  Fullscreen: "全屏",
  "Exit Fullscreen": "退出全屏",
  Mute: "静音",
  Unmute: "取消静音",
  Play: "播放",
  Pause: "暂停",
  "Picture-in-Picture": "画中画",
  "Exit Picture-in-Picture": "退出画中画",
  "Seek Forward": "快进",
  "Seek Backward": "快退",
  "AirPlay": "隔空投屏",
  "Google Cast": "投屏",
  "Volume": "音量",
};

  return (
    <MediaPlayer
      ref={onPlayerInit}
      className={'w-full h-full bg-black'}
      src={src}
      title={item?.title}
      poster={item?.posterUrl}
      playsInline
      autoPlay
      volume={0.8}
      crossOrigin="anonymous"
      onProviderChange={onProviderChange}
      onEnded={onEnded}
      onPointerEnter={(e) => {
        const target = e.currentTarget as any;
        if (target && typeof target.focus === 'function') {
           target.focus();
        }
      }}
      onPointerMove={(e) => {
        // Force the player to wake up if it's acting insensitive
        const target = e.currentTarget as any;
        if (target && target.remoteControl) {
           target.remoteControl.changeUserIdle(false);
        }
      }}
    >
      <MediaProvider />
      <DefaultVideoLayout
        icons={defaultLayoutIcons}
        translations={chineseTranslations}
        slots={{
          // googleCastButton: null, // Let Vidstack handle Cast if available
          // Remove pipButton override so native PIP shows up
          // Insert AirPlay after PIP
          afterFullscreenButton: <AirPlayButton className="vds-button" title="隔空投屏"><AirPlayIcon className="vds-icon" /></AirPlayButton>,
          beforeCurrentTime: (
            <button
              className="vds-button mr-2"
              onClick={onNextEpisode}
              title="下一集 (Alt+→)"
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
              title={isWebFullscreen ? "退出网页全屏 (F或Esc)" : "网页全屏 (F)"}
              aria-label={isWebFullscreen ? "退出网页全屏" : "网页全屏"}
            >
              {isWebFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vds-icon">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vds-icon">
                  <rect x="3" y="7" width="6" height="10" rx="1"></rect>
                  <rect x="11" y="4" width="10" height="6" rx="1"></rect>
                </svg>
              )}
            </button>
          ),
        }}
      />
    </MediaPlayer>
  );
}
