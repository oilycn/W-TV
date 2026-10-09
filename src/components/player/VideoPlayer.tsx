'use client';

import React, { useRef, useState, useEffect } from 'react';
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
import type { ContentItem, PlaybackSourceGroup } from '@/types';
import { Loader2, X, ListVideo, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  // 选集功能支持
  playbackSources?: PlaybackSourceGroup[];
  currentSourceGroupIndex?: number | null;
  currentUrlIndex?: number | null;
  onSelectEpisode?: (sourceGroupIndex: number, urlIndex: number) => void;
  // 切集时解析状态浮层（防止卸载播放器而丢失全屏）
  isResolvingPlay?: boolean;
  currentEpisodeInfo?: { name: string; source: string } | null;
}

export default function VideoPlayer({
  item,
  src,
  onEnded,
  onPlayerInit,
  onEnterWebFullscreen,
  isWebFullscreen = false,
  onNextEpisode,
  playbackSources,
  currentSourceGroupIndex = 0,
  currentUrlIndex = 0,
  onSelectEpisode,
  isResolvingPlay = false,
  currentEpisodeInfo,
}: VideoPlayerProps) {
  const internalPlayerRef = useRef<MediaPlayerInstance | null>(null);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasFullscreenRef = useRef<boolean>(false);

  // 选集面板状态与线路选择
  const [isEpisodeDrawerOpen, setIsEpisodeDrawerOpen] = useState(false);
  const [activeGroupTab, setActiveGroupTab] = useState<number>(currentSourceGroupIndex || 0);

  // 当当前线路索引发生变化时同步高亮 Tab
  useEffect(() => {
    if (currentSourceGroupIndex !== null && currentSourceGroupIndex !== undefined) {
      setActiveGroupTab(currentSourceGroupIndex);
    }
  }, [currentSourceGroupIndex]);

  // 全屏维持机制：在媒体源变动或切集时保持全屏状态不丢失
  useEffect(() => {
    const player = internalPlayerRef.current;
    if (player && (player.state.fullscreen || document.fullscreenElement !== null)) {
      wasFullscreenRef.current = true;
    }
  }, [src]);

  // 监听全屏下 ESC 键优先关闭选集面板
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEpisodeDrawerOpen) {
        e.stopPropagation();
        setIsEpisodeDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isEpisodeDrawerOpen]);

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
    // 若之前处于原生全屏，确保播放开始时全屏状态完整
    if (wasFullscreenRef.current && internalPlayerRef.current && !internalPlayerRef.current.state.fullscreen && !isWebFullscreen) {
      try {
        internalPlayerRef.current.enterFullscreen();
      } catch (_e) {}
    }
  };

  const onProviderChange = (provider: MediaProviderAdapter | null) => {
    if (isHLSProvider(provider)) {
      provider.library = Hls;
      provider.config = {
        maxBufferLength: 45,
        maxMaxBufferLength: 90,
        maxBufferSize: 60 * 1024 * 1024,
        backBufferLength: 60,
        enableWorker: true,
        maxBufferHole: 0.8,
        nudgeOffset: 0.15,
        nudgeMaxRetry: 10,
        highBufferWatchdogPeriod: 1,
        maxFragLookUpTolerance: 0.5,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 5,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 5,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 1000,
        autoStartLoad: true,
        startLevel: -1,
        loader: CustomHlsJsLoader,
      };

      provider.instance?.on(Hls.Events.ERROR, (_event, data) => {
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

  const currentGroup = playbackSources?.[activeGroupTab] || playbackSources?.[0];
  const episodeList = currentGroup?.urls || [];

  return (
    <div className="relative w-full h-full bg-black select-none overflow-hidden">
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
                className="vds-button mr-1.5"
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
              <div className="flex items-center gap-1">
                {/* 1. 控制层选集按钮 */}
                {playbackSources && playbackSources.length > 0 && (
                  <button
                    onClick={() => setIsEpisodeDrawerOpen(prev => !prev)}
                    className={cn(
                      "vds-button px-2 flex items-center gap-1.5 text-xs font-medium rounded-md text-zinc-200 hover:text-white transition-colors",
                      isEpisodeDrawerOpen && "bg-white/20 text-white shadow-sm ring-1 ring-white/25"
                    )}
                    title="选集列表"
                    aria-label="选集列表"
                  >
                    <ListVideo className="vds-icon w-4 h-4" />
                    <span className="hidden sm:inline-block">选集</span>
                  </button>
                )}

                {/* 2. 现代 YouTube 剧场模式 / 网页全屏图标 */}
                <button
                  onClick={onEnterWebFullscreen}
                  className="vds-button"
                  title={isWebFullscreen ? "退出网页全屏 (F或Esc)" : "网页全屏 / 剧场模式 (F)"}
                  aria-label={isWebFullscreen ? "退出网页全屏" : "网页全屏"}
                >
                  {isWebFullscreen ? (
                    // 退出剧场模式 / 恢复窗口视窗图标
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vds-icon">
                      <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                      <path d="M8 9h8v6H8z" fill="currentColor" fillOpacity="0.3"></path>
                    </svg>
                  ) : (
                    // 进入剧场模式 / 宽屏网页全屏视窗图标 (YouTube 经典剧场宽屏图标)
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vds-icon">
                      <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                      <path d="M2 15h20" strokeDasharray="2 2" className="opacity-40"></path>
                      <rect x="5" y="7" width="14" height="10" rx="1" fill="currentColor" fillOpacity="0.25"></rect>
                    </svg>
                  )}
                </button>
              </div>
            ),
          }}
        />
      </MediaPlayer>

      {/* 3. 切集解析中居中微浮层（保持播放器常驻，全屏不退） */}
      {isResolvingPlay && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md text-white gap-3 p-6 pointer-events-auto">
          <Loader2 className="h-10 w-10 animate-spin text-primary drop-shadow-md" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-semibold tracking-wide text-zinc-100">正在解析视频秒播直链...</p>
            {currentEpisodeInfo && (
              <p className="text-xs text-muted-foreground font-mono">{currentEpisodeInfo.source} · {currentEpisodeInfo.name}</p>
            )}
          </div>
        </div>
      )}

      {/* 4. 播放器内部选集弹窗/抽屉（全屏与非全屏均可直接切换） */}
      {isEpisodeDrawerOpen && playbackSources && playbackSources.length > 0 && (
        <div className="absolute inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          {/* 点击背景关闭 */}
          <div
            className="flex-1 h-full cursor-pointer"
            onClick={() => setIsEpisodeDrawerOpen(false)}
          />

          {/* 右侧选集面板 */}
          <div className="relative w-72 sm:w-88 md:w-96 h-full bg-zinc-950/95 border-l border-white/10 shadow-2xl flex flex-col backdrop-blur-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 shrink-0 bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <ListVideo className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-white">选集列表</h3>
                <span className="text-xs text-zinc-400 font-mono">({episodeList.length}集)</span>
              </div>
              <button
                onClick={() => setIsEpisodeDrawerOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 线路切换 Tabs（若有多条线路） */}
            {playbackSources.length > 1 && (
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10 overflow-x-auto no-scrollbar shrink-0 bg-black/30">
                {playbackSources.map((group, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveGroupTab(idx)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-all",
                      activeGroupTab === idx
                        ? "bg-white/20 text-white shadow-sm ring-1 ring-white/30"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    )}
                  >
                    {group.sourceName}
                  </button>
                ))}
              </div>
            )}

            {/* 剧集网格/列表滚动区 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {episodeList.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  当前线路暂无可用剧集
                </div>
              ) : (
                <div className={cn(
                  episodeList.some(e => e.name.length > 6)
                    ? "flex flex-col gap-1.5"
                    : "grid grid-cols-4 sm:grid-cols-5 gap-2"
                )}>
                  {episodeList.map((ep, idx) => {
                    const isCurrent = activeGroupTab === currentSourceGroupIndex && idx === currentUrlIndex;
                    const isLongText = ep.name.length > 6;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (onSelectEpisode) {
                            onSelectEpisode(activeGroupTab, idx);
                          }
                        }}
                        className={cn(
                          "relative group flex items-center justify-center rounded-lg text-xs font-medium transition-all",
                          isLongText ? "px-3 py-2 justify-between text-left" : "h-10 px-1",
                          isCurrent
                            ? "bg-primary text-primary-foreground font-semibold shadow-md ring-1 ring-primary/50"
                            : "bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white border border-white/5 hover:border-white/20"
                        )}
                        title={ep.name}
                      >
                        <span className="truncate">{ep.name}</span>
                        {isCurrent && (
                          <span className={cn(isLongText ? "ml-2 shrink-0" : "absolute top-1 right-1")}>
                            <Play className="w-2.5 h-2.5 fill-current" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
