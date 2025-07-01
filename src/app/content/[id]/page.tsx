
"use client";

import { use, useEffect, useState, Suspense, useRef, useCallback } from 'react';
import type { ContentItem, PlaybackSourceGroup, SourceConfig, PlaybackURL } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchContentItemById, getMockContentItemById } from '@/lib/content-loader';
import { Loader2 } from 'lucide-react';

// Vidstack Imports
import { type MediaProviderAdapter, AirPlayButton, isHLSProvider, MediaPlayer, MediaProvider } from '@vidstack/react';
import { AirPlayIcon } from '@vidstack/react/icons';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import Hls from 'hls.js';

interface ContentDetailPageParams {
  id: string;
}

interface ContentDetailPageProps {
  params: ContentDetailPageParams;
}

function filterAdsFromM3U8(m3u8Content: string): string {
    if (!m3u8Content) return '';
    const lines = m3u8Content.split('\n');
    const filteredLines = lines.filter(line => !line.includes('#EXT-X-DISCONTINUITY'));
    return filteredLines.join('\n');
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

function ContentDetailDisplay({ params: paramsProp }: ContentDetailPageProps) {
    const resolvedParams = use(paramsProp as any); 

    const [pageId, setPageId] = useState<string | null>(null);
    const [sources] = useLocalStorage<SourceConfig[]>('cinemaViewSources', []);
    const [activeSourceId] = useLocalStorage<string | null>('cinemaViewActiveSourceId', null);
    
    const [item, setItem] = useState<ContentItem | null | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [videoTitle, setVideoTitle] = useState('');
    const [currentPlayUrl, setCurrentPlayUrl] = useState<string | null>(null);
    const [currentSourceGroupIndex, setCurrentSourceGroupIndex] = useState<number | null>(null);
    const [currentUrlIndex, setCurrentUrlIndex] = useState<number | null>(null);
    
    const [showEpisodePanel, setShowEpisodePanel] = useState(false);
    const [reverseEpisodeOrder, setReverseEpisodeOrder] = useState(false);
    
    const [showShortcutHint, setShowShortcutHint] = useState(false);
    const [shortcutText, setShortcutText] = useState('');
    const [shortcutDirection, setShortcutDirection] = useState('');

    const playerRef = useRef<MediaPlayer>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const shortcutHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFullscreen = playerRef.current?.state.fullscreen;
    
    const [blockAdEnabled] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const v = localStorage.getItem('enable_blockad');
            if (v !== null) return v === 'true';
        }
        return true; 
    });

    useEffect(() => {
        if (resolvedParams && resolvedParams.id) {
            setPageId(resolvedParams.id);
            setCurrentPlayUrl(null); 
            setError(null);
            setCurrentSourceGroupIndex(null);
            setCurrentUrlIndex(null);
        } else {
            setPageId(null);
        }
    }, [resolvedParams]);

    useEffect(() => {
        if (!pageId) {
            setIsLoading(false);
            setItem(null); 
            return;
        }

        async function loadContentDetail() {
            setIsLoading(true);
            setError(null);
            let itemFound: ContentItem | null | undefined = undefined;
            const activeSourceConfig = sources.find(s => s.id === activeSourceId);

            if (activeSourceConfig) {
                itemFound = await fetchContentItemById(activeSourceConfig.url, pageId);
            }
            if (!itemFound) {
                for (const source of sources) {
                    if (activeSourceConfig && source.id === activeSourceConfig.id) continue; 
                    itemFound = await fetchContentItemById(source.url, pageId);
                    if (itemFound) break; 
                }
            }
            if (!itemFound && pageId) {
                itemFound = getMockContentItemById(pageId); 
            }
            
            setItem(itemFound || null);
            if(itemFound) {
              setVideoTitle(itemFound.title);
              // Auto-play the first episode of the first source group by default
              const firstSourceGroup = itemFound.playbackSources?.[0];
              const firstUrl = firstSourceGroup?.urls?.[0];
              if (firstUrl) {
                handlePlayVideo(firstUrl.url, firstSourceGroup.sourceName, firstUrl.name, 0, 0);
              }
            } else {
              setError(`抱歉，我们找不到您请求的内容 (ID: ${pageId || "无效的ID"})。`);
            }
            setIsLoading(false);
        }
        
        loadContentDetail();
    }, [pageId, sources, activeSourceId]);

    const handlePlayVideo = (url: string, sourceName: string, episodeName: string, sourceGroupIndex: number, urlIndex: number) => {
        setCurrentPlayUrl(url);
        setVideoTitle(`${item?.title || '视频'} - ${episodeName}`);
        setCurrentSourceGroupIndex(sourceGroupIndex);
        setCurrentUrlIndex(urlIndex);
        setShowEpisodePanel(false);
        playerContainerRef.current?.focus();
    };

    const getNextEpisode = (): { url: string; sourceName: string; episodeName: string; sourceGroupIndex: number; urlIndex: number } | null => {
        if (!item?.playbackSources || currentSourceGroupIndex === null || currentUrlIndex === null) return null;
        
        const currentGroup = item.playbackSources[currentSourceGroupIndex];
        if (currentUrlIndex < currentGroup.urls.length - 1) {
            const nextUrl = currentGroup.urls[currentUrlIndex + 1];
            return { ...nextUrl, episodeName: nextUrl.name, sourceName: currentGroup.sourceName, sourceGroupIndex: currentSourceGroupIndex, urlIndex: currentUrlIndex + 1 };
        }
        let nextGroupIdx = currentSourceGroupIndex + 1;
        while(nextGroupIdx < item.playbackSources.length) {
            const nextGroup = item.playbackSources[nextGroupIdx];
            if (nextGroup.urls.length > 0) {
                const nextUrl = nextGroup.urls[0];
                return { ...nextUrl, episodeName: nextUrl.name, sourceName: nextGroup.sourceName, sourceGroupIndex: nextGroupIdx, urlIndex: 0 };
            }
            nextGroupIdx++;
        }
        return null;
    };
    
    const handleNextEpisode = () => {
        const nextEpisode = getNextEpisode();
        if (nextEpisode) {
            handlePlayVideo(nextEpisode.url, nextEpisode.sourceName, nextEpisode.episodeName, nextEpisode.sourceGroupIndex, nextEpisode.urlIndex);
        }
    };
    
    const displayShortcutHint = (text: string, direction: string) => {
        setShortcutText(text);
        setShortcutDirection(direction);
        setShowShortcutHint(true);
        if (shortcutHintTimeoutRef.current) clearTimeout(shortcutHintTimeoutRef.current);
        shortcutHintTimeoutRef.current = setTimeout(() => setShowShortcutHint(false), 2000);
    };

    const handleKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

        if (e.altKey && e.key === 'ArrowRight') {
            e.preventDefault();
            const nextEp = getNextEpisode();
            if (nextEp) {
                handleNextEpisode();
                displayShortcutHint('下一集', 'right');
            } else {
                displayShortcutHint('已经是最后一集了', 'error');
            }
        }
        
        if (!playerRef.current) return;
        const player = playerRef.current;
        if (e.key === ' ' || e.key === 'f' || e.key === 'F' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
        
        if (e.key === ' ') player.paused ? player.play() : player.pause();
        if (e.key === 'f' || e.key === 'F') isFullscreen ? player.exitFullscreen() : player.enterFullscreen();
        if (!e.altKey && e.key === 'ArrowLeft') { player.currentTime -= 10; displayShortcutHint('快退10秒', 'left'); }
        if (!e.altKey && e.key === 'ArrowRight') { player.currentTime += 10; displayShortcutHint('快进10秒', 'right'); }
        if (e.key === 'ArrowUp') { player.volume = Math.min(player.volume + 0.1, 1); displayShortcutHint(`音量 ${Math.round(player.volume * 100)}`, 'up');}
        if (e.key === 'ArrowDown') { player.volume = Math.max(player.volume - 0.1, 0); displayShortcutHint(`音量 ${Math.round(player.volume * 100)}`, 'down');}
    }, [item, currentSourceGroupIndex, currentUrlIndex, isFullscreen]);
    
    useEffect(() => {
        document.addEventListener('keydown', handleKeyboardShortcuts);
        return () => document.removeEventListener('keydown', handleKeyboardShortcuts);
    }, [handleKeyboardShortcuts]);

    const onProviderChange = (provider: MediaProviderAdapter | null) => {
        if (isHLSProvider(provider)) {
            provider.library = Hls;
            provider.config = {
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                maxBufferLength: 60,
                backBufferLength: 30,
                loader: blockAdEnabled ? CustomHlsJsLoader : Hls.DefaultConfig.loader,
            };
        }
    };
    
    if (isLoading) {
        return (
            <div className='min-h-screen bg-black flex items-center justify-center'>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className='min-h-screen bg-black flex items-center justify-center p-4'>
                <div className='text-white text-center'>
                    <h2 className='text-xl font-semibold mb-4 text-red-400'>加载失败</h2>
                    <p className='text-base mb-6'>{error}</p>
                </div>
            </div>
        );
    }
    
    if (!item) {
        return (
             <div className='min-h-screen bg-black flex items-center justify-center'>
                <p className='text-white'>未找到内容。</p>
            </div>
        );
    }

    return (
        <div ref={playerContainerRef} tabIndex={-1} className='bg-black fixed inset-0 overflow-hidden outline-none'>
            <MediaPlayer
                ref={playerRef}
                className='w-full h-full group'
                src={currentPlayUrl || ''}
                poster={item.posterUrl}
                playsInline
                autoPlay
                volume={0.8}
                crossOrigin='anonymous'
                onProviderChange={onProviderChange}
                onEnded={handleNextEpisode}
            >
                <MediaProvider />
                <PlayerUITopbar
                    videoTitle={videoTitle}
                    isFullscreen={isFullscreen}
                    onOpenEpisodePanel={() => {
                        setShowEpisodePanel(true);
                        playerContainerRef.current?.focus();
                    }}
                />
                <DefaultVideoLayout
                    icons={defaultLayoutIcons}
                    slots={{
                        googleCastButton: null,
                        pipButton: null,
                        settingsMenu: null,
                        beforeCurrentTime: (
                            <button className='vds-button mr-2' onClick={handleNextEpisode} aria-label='Next Episode'>
                                <svg className='vds-icon' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'><path d='M6 24l12-8L6 8v16zM22 8v16h3V8h-3z' fill='currentColor'/></svg>
                            </button>
                        ),
                        beforeFullscreenButton: (
                            <>
                                <AirPlayButton className='vds-button'><AirPlayIcon className='vds-icon' /></AirPlayButton>
                            </>
                        )
                    }}
                />
            </MediaPlayer>

            {/* Episode Panel */}
            {item.playbackSources && item.playbackSources.length > 0 && (
                <div>
                    {showEpisodePanel && <div className='fixed inset-0 bg-black/60 z-[110]' onClick={() => setShowEpisodePanel(false)} />}
                    <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-black/50 backdrop-blur-xl z-[120] transform transition-transform duration-300 ${showEpisodePanel ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className='p-4 h-full flex flex-col'>
                            <div className='flex items-center justify-between mb-4'>
                                <h3 className='text-white text-xl font-semibold'>选集列表</h3>
                                <button onClick={() => setReverseEpisodeOrder(prev => !prev)} className={`text-sm ${reverseEpisodeOrder ? 'text-green-500' : 'text-gray-400'}`}>倒序</button>
                            </div>
                             <div className="flex-1 overflow-y-auto space-y-4">
                                {(reverseEpisodeOrder ? [...item.playbackSources].reverse() : item.playbackSources).map((sourceGroup, groupIdx) => {
                                    const actualGroupIdx = reverseEpisodeOrder ? item.playbackSources.length - 1 - groupIdx : groupIdx;
                                    return (
                                        <div key={sourceGroup.sourceName}>
                                            <h4 className="text-gray-300 font-semibold mb-2">{sourceGroup.sourceName}</h4>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                {(reverseEpisodeOrder ? [...sourceGroup.urls].reverse() : sourceGroup.urls).map((playUrl, urlIdx) => {
                                                    const actualUrlIdx = reverseEpisodeOrder ? sourceGroup.urls.length - 1 - urlIdx : urlIdx;
                                                    return (
                                                        <button 
                                                            key={playUrl.url}
                                                            onClick={() => handlePlayVideo(playUrl.url, sourceGroup.sourceName, playUrl.name, actualGroupIdx, actualUrlIdx)}
                                                            className={`px-3 py-2 text-sm rounded-lg transition-colors truncate ${(actualGroupIdx === currentSourceGroupIndex && actualUrlIdx === currentUrlIndex) ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                                            title={playUrl.name}
                                                        >
                                                            {playUrl.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Shortcut Hint */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 transition-opacity duration-300 ${showShortcutHint ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className='bg-black/80 backdrop-blur-sm rounded p-4 flex items-center space-x-3 text-white'>
                    {shortcutText}
                </div>
            </div>
        </div>
    );
}

function PlayerUITopbar({ videoTitle, isFullscreen, onOpenEpisodePanel }: { videoTitle: string; isFullscreen: boolean | undefined; onOpenEpisodePanel: () => void; }) {
    return (
        <div className='absolute top-0 left-0 right-0 transition-opacity duration-300 z-10 opacity-0 pointer-events-none group-data-[controls]:opacity-100 group-data-[controls]:pointer-events-auto'>
            <div className='bg-gradient-to-b from-black/70 to-transparent p-4 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                    <button onClick={() => window.history.back()} className='text-white hover:text-gray-300'>
                         <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z' fill='currentColor'/></svg>
                    </button>
                    <span className='text-white font-semibold text-lg truncate max-w-xs sm:max-w-md'>{videoTitle}</span>
                </div>
                <button className='vds-button text-sm' onClick={onOpenEpisodePanel}>选集</button>
            </div>
        </div>
    );
}


export default function ContentDetailPage(props: ContentDetailPageProps) {
    useEffect(() => {
        // Fullscreen player page, hide body scrollbar
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);
    return (
        <Suspense fallback={
            <div className='min-h-screen bg-black flex items-center justify-center'>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <ContentDetailDisplay {...props} />
        </Suspense>
    );
}
