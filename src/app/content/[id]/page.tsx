
"use client";

import { use, useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ContentItem, SourceConfig, HistoryEntry } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchContentItemById, getMockContentItemById } from '@/lib/content-loader';
import { Loader2, Star } from 'lucide-react';
import { useCategories } from '@/contexts/CategoryContext';

// Vidstack Imports
import { type MediaProviderAdapter, AirPlayButton, isHLSProvider, type MediaPlayerElement } from '@vidstack/react';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { AirPlayIcon } from '@vidstack/react/icons';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import Hls from 'hls.js';

// ShadCN UI
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface ContentDetailPageParams {
  id: string;
}

interface ContentDetailPageProps {
  params: ContentDetailPageParams;
}

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

function ContentDetailDisplay({ params: paramsProp }: ContentDetailPageProps) {
    const searchParams = useSearchParams();
    const resolvedParams = use(paramsProp as any); 

    const [pageId, setPageId] = useState<string | null>(null);
    const [sources] = useLocalStorage<SourceConfig[]>('cinemaViewSources', []);
    const { activeSourceId, setActiveSourceId } = useCategories();
    
    const [item, setItem] = useState<ContentItem | null | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [currentPlayUrl, setCurrentPlayUrl] = useState<string | null>(null);
    const [currentSourceGroupIndex, setCurrentSourceGroupIndex] = useState<number | null>(null);
    const [currentUrlIndex, setCurrentUrlIndex] = useState<number | null>(null);
        
    const [showShortcutHint, setShowShortcutHint] = useState(false);
    const [shortcutText, setShortcutText] = useState('');
    const shortcutHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const [player, setPlayer] = useState<MediaPlayerElement | null>(null);
    const [useIframeFallback, setUseIframeFallback] = useState(false);
    const [history, setHistory] = useLocalStorage<HistoryEntry[]>('cinemaViewHistory', []);
    
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
        const sourceIdFromQuery = searchParams.get('sourceId');

        if (!pageId) {
            setIsLoading(false);
            setItem(null); 
            return;
        }

        async function loadContentDetail() {
            setIsLoading(true);
            setError(null);
            let itemFound: ContentItem | null | undefined = undefined;
            
            // Reorder sources to try the one from query/active one first
            const sourceIdToTryFirst = sourceIdFromQuery || activeSourceId;
            const sourcesToSearch = [...sources];
            if (sourceIdToTryFirst) {
                const idx = sourcesToSearch.findIndex(s => s.id === sourceIdToTryFirst);
                if (idx > 0) {
                    const primary = sourcesToSearch.splice(idx, 1)[0];
                    sourcesToSearch.unshift(primary);
                }
            }

            for (const source of sourcesToSearch) {
                itemFound = await fetchContentItemById(source.url, pageId);
                if (itemFound) {
                    // If content is found from a source that is not active,
                    // set it as active for a better user experience (e.g., next episode).
                    if (source.id !== activeSourceId) {
                        setActiveSourceId(source.id);
                    }
                    break; 
                }
            }
            
            if (!itemFound && pageId) {
                itemFound = getMockContentItemById(pageId); 
            }
            
            setItem(itemFound || null);
            if(itemFound) {
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
    }, [pageId, sources, activeSourceId, setActiveSourceId, searchParams]);


    const handlePlayVideo = (url: string, sourceName: string, episodeName: string, sourceGroupIndex: number, urlIndex: number) => {
        setCurrentPlayUrl(url);
        setCurrentSourceGroupIndex(sourceGroupIndex);
        setCurrentUrlIndex(urlIndex);
        setUseIframeFallback(false); // Reset fallback on new video selection

        if (item && activeSourceId) {
            setHistory(prevHistory => {
                const otherHistory = prevHistory.filter(entry => entry.item.id !== item.id);
                const newEntry: HistoryEntry = {
                    item: item,
                    watchedAt: Date.now(),
                    sourceId: activeSourceId,
                    episodeName: episodeName,
                    sourceName: sourceName,
                    episodeUrl: url,
                };
                return [newEntry, ...otherHistory];
            });
        }
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
    
    const displayShortcutHint = (text: string) => {
        setShortcutText(text);
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
                displayShortcutHint('下一集');
            } else {
                displayShortcutHint('已经是最后一集了');
            }
        }
        
        if (!player) return;
        if (e.key === ' ' || e.key === 'f' || e.key === 'F' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
        
        if (e.key === ' ') player.paused ? player.play() : player.pause();
        if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? player.exitFullscreen() : player.enterFullscreen();
        if (!e.altKey && e.key === 'ArrowLeft') { player.currentTime -= 10; displayShortcutHint('快退10秒'); }
        if (!e.altKey && e.key === 'ArrowRight') { player.currentTime += 10; displayShortcutHint('快进10秒'); }
        if (e.key === 'ArrowUp') { player.volume = Math.min(player.volume + 0.1, 1); displayShortcutHint(`音量 ${Math.round(player.volume * 100)}`);}
        if (e.key === 'ArrowDown') { player.volume = Math.max(player.volume - 0.1, 0); displayShortcutHint(`音量 ${Math.round(player.volume * 100)}`);}
    }, [item, currentSourceGroupIndex, currentUrlIndex, player]);
    
    useEffect(() => {
        document.addEventListener('keydown', handleKeyboardShortcuts);
        return () => document.removeEventListener('keydown', handleKeyboardShortcuts);
    }, [handleKeyboardShortcuts]);

    // Player error listener for iframe fallback
    useEffect(() => {
        if (!player) return;

        const onError = (event: any) => {
            // Any player error will trigger a fallback to the iframe for maximum compatibility.
            setUseIframeFallback(true);
        };

        const unsubscribe = player.listen('error', onError);
        return () => unsubscribe();
    }, [player]);

    // Fullscreen event listeners
    useEffect(() => {
        if (!player) return;

        const onEnterFullscreen = async () => {
            try {
                if (screen.orientation && typeof screen.orientation.lock === 'function') {
                    await screen.orientation.lock('landscape');
                }
            } catch (e) {
                // Orientation lock can fail on some devices/browsers.
            }
        };

        const onExitFullscreen = () => {
            try {
                if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                    screen.orientation.unlock();
                }
            } catch (e) {
               // It might not be possible to unlock, which is fine.
            }
        };

        const unsubEnter = player.listen('enter-fullscreen', onEnterFullscreen);
        const unsubExit = player.listen('exit-fullscreen', onExitFullscreen);

        return () => {
            unsubEnter();
            unsubExit();
        };
    }, [player]);

    const onProviderChange = (provider: MediaProviderAdapter | null) => {
        if (isHLSProvider(provider)) {
            provider.library = Hls;
            provider.config = {
                loader: CustomHlsJsLoader,
            };
        }
    };
    
    if (isLoading) {
        return (
            <div className='min-h-screen flex items-center justify-center'>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className='min-h-screen flex items-center justify-center p-4'>
                <div className='text-center'>
                    <h2 className='text-xl font-semibold mb-4 text-destructive'>加载失败</h2>
                    <p className='text-base mb-6'>{error}</p>
                </div>
            </div>
        );
    }
    
    if (!item) {
        return (
             <div className='min-h-screen flex items-center justify-center'>
                <p>未找到内容。</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-screen-2xl px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left column: Player and Details */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
                        {currentPlayUrl && useIframeFallback ? (
                            <iframe
                                key={currentPlayUrl}
                                src={currentPlayUrl}
                                title="Playback Frame"
                                className="w-full h-full"
                                allow="autoplay; encrypted-media; picture-in-picture"
                                allowFullScreen
                                sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                            />
                        ) : currentPlayUrl ? (
                            <MediaPlayer
                                ref={setPlayer}
                                className='w-full h-full'
                                src={currentPlayUrl}
                                poster={item.posterUrl}
                                playsInline
                                autoPlay
                                volume={0.8}
                                crossOrigin='anonymous'
                                onProviderChange={onProviderChange}
                                onEnded={handleNextEpisode}
                            >
                                <MediaProvider />
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
                                            <AirPlayButton className='vds-button'><AirPlayIcon className='vds-icon' /></AirPlayButton>
                                        )
                                    }}
                                />
                            </MediaPlayer>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-black">
                                <p className="text-muted-foreground">请选择一集开始播放</p>
                            </div>
                        )}
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-semibold mb-3">简介</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {item.description}
                        </p>
                    </div>
                </div>

                {/* Right column: Episodes */}
                <div className="lg:col-span-1">
                    <div className="space-y-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight mb-2">{item.title}</h1>
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-2 text-sm text-muted-foreground">
                                {item.releaseYear && <span>{item.releaseYear}</span>}
                                {item.userRating && (
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                        <span>{item.userRating.toFixed(1)}</span>
                                    </div>
                                )}
                                 {item.genres?.map(genre => (
                                    <Badge key={genre} variant="secondary">{genre}</Badge>
                                ))}
                            </div>
                        </div>

                        {/* Episode Selector */}
                        {item.playbackSources && item.playbackSources.length > 0 ? (
                             <Tabs defaultValue={item.playbackSources[0].sourceName} className="w-full">
                                <TabsList className="grid w-full grid-flow-col auto-cols-fr">
                                    {item.playbackSources.map((sourceGroup) => (
                                        <TabsTrigger key={sourceGroup.sourceName} value={sourceGroup.sourceName}>
                                            {sourceGroup.sourceName}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                                {item.playbackSources.map((sourceGroup, groupIdx) => (
                                    <TabsContent key={sourceGroup.sourceName} value={sourceGroup.sourceName}>
                                        <ScrollArea className="h-[500px] w-full pr-4">
                                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                                {sourceGroup.urls.map((playUrl, urlIdx) => (
                                                    <button
                                                        key={`${playUrl.url}-${urlIdx}`}
                                                        onClick={() => handlePlayVideo(playUrl.url, sourceGroup.sourceName, playUrl.name, groupIdx, urlIdx)}
                                                        className={`px-3 py-2 text-xs rounded-md transition-colors truncate ${
                                                            (groupIdx === currentSourceGroupIndex && urlIdx === currentUrlIndex) 
                                                            ? 'bg-primary text-primary-foreground' 
                                                            : 'bg-muted hover:bg-primary/80 hover:text-primary-foreground'
                                                        }`}
                                                        title={playUrl.name}
                                                    >
                                                        {playUrl.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        ) : (
                            <p className="text-muted-foreground text-sm">暂无可用播放源。</p>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Shortcut Hint */}
            <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] transition-opacity duration-300 ${showShortcutHint ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                 <div className='bg-black/80 backdrop-blur-sm rounded p-4 flex items-center space-x-3 text-white'>
                     {shortcutText}
                 </div>
            </div>
        </div>
    );
}

export default function ContentDetailPage(props: ContentDetailPageProps) {
    return (
        <Suspense fallback={
            <div className='min-h-screen bg-background flex items-center justify-center'>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <ContentDetailDisplay {...props} />
        </Suspense>
    );
}
