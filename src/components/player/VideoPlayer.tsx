
'use client';

import React, { useRef } from 'react';
import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  TimeSlider,
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
    let res = outputLines.join('\n');
    // 折叠连续的多余不连续标记，防止解复用器 PTS 错位导致进度条拖动卡顿
    res = res.replace(/(#EXT-X-DISCONTINUITY\s*)+#EXT-X-DISCONTINUITY/g, '#EXT-X-DISCONTINUITY');
    return res;
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
  const internalPlayerRef = useRef<MediaPlayerInstance | null>(null);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePlayerRef = (instance: MediaPlayerInstance | null) => {
    internalPlayerRef.current = instance;
    onPlayerInit(instance);
  };

  const handleWaiting = () => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      const media = (internalPlayerRef.current as any)?.el?.querySelector('video');
      if (media && !media.paused && media.readyState < 3) {
        console.warn("播放器缓冲超时卡顿，自动尝试推动播放...");
        media.currentTime += 0.15;
      }
    }, 2000);
  };

  const handlePlaying = () => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  };

  const onProviderChange = (provider: MediaProviderAdapter | null) => {
    if (isHLSProvider(provider)) {
      provider.library = Hls;
      provider.config = {
        // --- 影视点播 (VoD) 优化配置 ---
        
        // 1. 缓冲策略与后退秒播优化
        maxBufferLength: 45,                 // 目标缓冲 45 秒
        maxMaxBufferLength: 90,              // 最大允许缓冲 90 秒
        maxBufferSize: 60 * 1024 * 1024,     // 提高内存上限至 60MB
        backBufferLength: 60,                // 保留 60 秒回退缓冲（回拉秒播无需重新下载）
        enableWorker: true,                  // 开启 Web Worker 多线程解码
        
        // 2. 关键：跨孔与自动防卡死微调（解决移动端拖动进度条卡死核心）
        maxBufferHole: 0.8,                  // 允许跨越 0.8 秒切片空隙（默认仅 0.1 秒易卡死）
        maxSeekHole: 2.0,                    // 拖动寻址跨越空隙放宽至 2 秒
        nudgeOffset: 0.15,                   // 卡住时向前微移 150ms 越过坏帧/空帧
        nudgeMaxRetry: 10,                   // 尝试微调 10 次
        highBufferWatchdogPeriod: 1,         // 每秒检测一次播放卡死状态
        maxFragLookUpTolerance: 0.5,         // 切片寻找容差放宽至 500ms
        
        // 3. 强效容错与纠错：应对弱源环境
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 5,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 5,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 10,             // 高重试次数，应对源断开
        fragLoadingRetryDelay: 1000,
        
        // 4. 智能生命周期管理
        autoStartLoad: true,
        startLevel: -1,                      // 自动选择最佳初始质量
        loader: CustomHlsJsLoader,
      };

      // 监听 HLS 错误事件并自动尝试修复与防卡死
      provider.instance?.on(Hls.Events.ERROR, (event, data) => {
        // 捕获非致命缓冲停顿，主动微调推移
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR || data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL) {
          console.warn("HLS 检测到缓冲停顿，自动执行播放推移...");
          const media = provider.instance?.media;
          if (media && !media.paused && media.readyState >= 2) {
            media.currentTime += 0.15;
          }
          return;
        }

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
      ref={handlePlayerRef}
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
      onWaiting={handleWaiting}
      onPlaying={handlePlaying}
      onPointerEnter={(e) => {
        const target = e.currentTarget as any;
        if (target && typeof target.focus === 'function') {
           target.focus();
        }
      }}
      onPointerMove={(e) => {
        // Only wake up controls if pointer is not coarse (avoid frequent updates during mobile touches)
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
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
        noScrubGesture={true}
        slots={{
          timeSlider: (
            <TimeSlider.Root
              className="vds-time-slider vds-slider"
              pauseWhileDragging
              seekingRequestThrottle={200}
              noSwipeGesture
            >
              <TimeSlider.Track className="vds-slider-track" />
              <TimeSlider.TrackFill className="vds-slider-track-fill vds-slider-track" />
              <TimeSlider.Progress className="vds-slider-progress vds-slider-track" />
              <TimeSlider.Thumb className="vds-slider-thumb" />
              <TimeSlider.Preview className="vds-slider-preview">
                <TimeSlider.Value className="vds-slider-value" />
              </TimeSlider.Preview>
            </TimeSlider.Root>
          ),
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
