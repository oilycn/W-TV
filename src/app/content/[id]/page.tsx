
"use client";

import { use, useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { ContentItem, SourceConfig, HistoryEntry } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchContentItemById, getMockContentItemById } from '@/lib/content-loader';
import { Loader2, Star } from 'lucide-react';
import { useCategories } from '@/contexts/CategoryContext';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { MediaPlayerInstance } from '@vidstack/react';
import Image from 'next/image';

// ShadCN UI
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export const runtime = 'edge';

// Dynamically import the video player component to code-split its heavy libraries
const VideoPlayer = dynamic(() => import('@/components/player/VideoPlayer'), {
  ssr: false, // The player relies on browser APIs, so disable server-side rendering
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <Loader2 className="h-10 w-10 animate-spin text-white" />
    </div>
  ),
});


interface ContentDetailPageParams {
  id: string;
}

interface ContentDetailPageProps {
  params: Promise<ContentDetailPageParams>;
}

function ContentDetailDisplay({ params: paramsProp }: ContentDetailPageProps) {
    const searchParams = useSearchParams();
    const resolvedParams = use(paramsProp); 
    const isMobile = useIsMobile();

    const [pageId, setPageId] = useState<string | null>(null);
    const [sources] = useLocalStorage<SourceConfig[]>('cinemaViewSources', []);
    const { activeSourceId, setActiveSourceId } = useCategories();
    
    const [item, setItem] = useState<ContentItem | null | undefined>(undefined);
    const itemRef = useRef<ContentItem | null>();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [currentPlayUrl, setCurrentPlayUrl] = useState<string | null>(null);
    const [currentSourceGroupIndex, setCurrentSourceGroupIndex] = useState<number | null>(null);
    const [currentUrlIndex, setCurrentUrlIndex] = useState<number | null>(null);
        
    const [shortcutText, setShortcutText] = useState('');
    const shortcutHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const [player, setPlayer] = useState<MediaPlayerInstance | null>(null);
    const [useIframeFallback, setUseIframeFallback] = useState(false);
    const [history, setHistory] = useLocalStorage<HistoryEntry[]>('cinemaViewHistory', []);
    
    const [isWebFullscreen, setIsWebFullscreen] = useState(false);

    useEffect(() => {
        if (isWebFullscreen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isWebFullscreen]);

    const handleEnterWebFullscreen = useCallback(() => {
        setIsWebFullscreen(prev => !prev);
    }, []);
    
    useEffect(() => {
        itemRef.current = item;
    }, [item]);
    

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

    const handlePlayVideo = useCallback((url: string, sourceName: string, episodeName: string, sourceGroupIndex: number, urlIndex: number, overrideSourceId?: string) => {
        setCurrentPlayUrl(url);
        setCurrentSourceGroupIndex(sourceGroupIndex);
        setCurrentUrlIndex(urlIndex);
        setUseIframeFallback(false);

        const sourceIdToUse = overrideSourceId || activeSourceId;
        const currentItem = itemRef.current;

        if (currentItem && sourceIdToUse) {
            setHistory(prevHistory => {
                const otherHistory = prevHistory.filter(entry => entry.item.id !== currentItem.id);
                const newEntry: HistoryEntry = {
                    item: currentItem,
                    watchedAt: Date.now(),
                    sourceId: sourceIdToUse,
                    episodeName: episodeName,
                    sourceName: sourceName,
                    episodeUrl: url,
                };
                return [newEntry, ...otherHistory];
            });
        }
    }, [activeSourceId, setHistory]);

    useEffect(() => {
        const sourceIdFromQuery = searchParams.get('sourceId');

        if (!pageId) {
            setIsLoading(false);
            setItem(null); 
            return;
        }

        const loadContentDetail = async () => {
            setIsLoading(true);
            setError(null);
            let itemFound: ContentItem | null | undefined = undefined;
            let sourceUsedToFind: SourceConfig | null = null;
            
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
                try {
                    itemFound = await fetchContentItemById(source.url, pageId);
                    if (itemFound) {
                        sourceUsedToFind = source;
                        if (source.id !== activeSourceId) {
                           setActiveSourceId(source.id);
                        }
                        break;
                    }
                } catch (e) {
                    // silently fail and try next source
                }
            }
            
            if (!itemFound && pageId) {
                itemFound = getMockContentItemById(pageId); 
            }
            
            setItem(itemFound || null);
            
            if(itemFound && sourceUsedToFind) {
              const firstSourceGroup = itemFound.playbackSources?.[0];
              const firstUrl = firstSourceGroup?.urls?.[0];
              if (firstUrl) {
                handlePlayVideo(firstUrl.url, firstSourceGroup.sourceName, firstUrl.name, 0, 0, sourceUsedToFind.id);
              }
            } else if (!itemFound) {
              setError(`抱歉，我们找不到您请求的内容 (ID: ${pageId || "无效的ID"})。`);
            }
            setIsLoading(false);
        }
        
        loadContentDetail();
    }, [pageId, sources, searchParams, setActiveSourceId, activeSourceId, handlePlayVideo]);


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
        if (shortcutHintTimeoutRef.current) clearTimeout(shortcutHintTimeoutRef.current);
        shortcutHintTimeoutRef.current = setTimeout(() => setShortcutText(''), 2000);
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
        if (e.key === ' ' || e.key === 'f' || e.key === 'F' || e.key === 'Escape' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
        
        if (e.key === ' ') player.paused ? player.play() : player.pause();
        if (e.key === 'f' || e.key === 'F') handleEnterWebFullscreen();
        if (e.key === 'Escape' && isWebFullscreen) { handleEnterWebFullscreen(); }
        if (!e.altKey && e.key === 'ArrowLeft') { player.currentTime -= 10; displayShortcutHint('快退10秒'); }
        if (!e.altKey && e.key === 'ArrowRight') { player.currentTime += 10; displayShortcutHint('快进10秒'); }
        if (e.key === 'ArrowUp') { player.volume = Math.min(player.volume + 0.1, 1); displayShortcutHint(`音量 ${Math.round(player.volume * 100)}`);}
        if (e.key === 'ArrowDown') { player.volume = Math.max(player.volume - 0.1, 0); displayShortcutHint(`音量 ${Math.round(player.volume * 100)}`);}
    }, [player, handleNextEpisode, getNextEpisode, handleEnterWebFullscreen, isWebFullscreen]);
    
    useEffect(() => {
        document.addEventListener('keydown', handleKeyboardShortcuts);
        return () => document.removeEventListener('keydown', handleKeyboardShortcuts);
    }, [handleKeyboardShortcuts]);

    // Player error listener for iframe fallback
    useEffect(() => {
        if (!player) return;

        const onError = (event: any) => {
            setUseIframeFallback(true);
        };

        const unsubscribe = player.listen('error', onError);
        return () => unsubscribe();
    }, [player]);

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
        <div className="relative min-h-screen bg-background pb-20">
            {/* Cinematic Background */}
            {item && (item.backdropUrl || item.posterUrl) && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none h-full">
                <Image
                  src={item.backdropUrl || item.posterUrl}
                  alt=""
                  fill
                  className="object-cover blur-[80px] opacity-40 dark:opacity-20 scale-110 saturate-[1.5]"
                  unoptimized={item.backdropUrl?.startsWith('https://placehold.co') || item.posterUrl?.startsWith('https://placehold.co')}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background z-10" />
              </div>
            )}

            <div className={cn("relative container mx-auto max-w-screen-2xl px-4 md:px-8 py-6 lg:py-8 flex flex-col gap-8 md:gap-12", isWebFullscreen ? "z-[100]" : "z-20")}>
                
                {/* 1. Player Area */}
                <div className={cn(
                    "w-full rounded-2xl overflow-hidden shadow-2xl bg-black border border-border/50 ring-1 ring-white/10 transition-all duration-500",
                    isWebFullscreen && "fixed inset-0 z-[100] w-full h-full rounded-none border-none ring-0",
                    !isWebFullscreen && "aspect-video max-h-[85vh] mx-auto"
                )}>
                    <div
                        className="w-full h-full"
                        style={isWebFullscreen && isMobile ? {
                            paddingTop: 'env(safe-area-inset-top)',
                            paddingBottom: 'env(safe-area-inset-bottom)',
                            paddingLeft: 'env(safe-area-inset-left)',
                            paddingRight: 'env(safe-area-inset-right)',
                        } : {}}
                    >
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
                            <VideoPlayer
                                item={item}
                                src={currentPlayUrl}
                                onPlayerInit={setPlayer}
                                onEnded={handleNextEpisode}
                                onEnterWebFullscreen={handleEnterWebFullscreen}
                                isWebFullscreen={isWebFullscreen}
                                onNextEpisode={handleNextEpisode}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-black">
                                <p className="text-muted-foreground">请选择一集开始播放</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Content Layout */}
                <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16", { "hidden": isWebFullscreen })}>
                    
                    {/* Left: Metadata */}
                    <div className="lg:col-span-1 space-y-6">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3 text-foreground drop-shadow-sm">{item.title}</h1>
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-2 text-sm text-muted-foreground mb-4">
                                {item.releaseYear && <span className="font-medium bg-muted/50 px-2.5 py-1 rounded-md">{item.releaseYear}</span>}
                                {item.userRating && (
                                    <div className="flex items-center gap-1.5 font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md">
                                        <Star className="w-4 h-4 fill-current" />
                                        <span>{item.userRating.toFixed(1)}</span>
                                    </div>
                                )}
                                 {item.genres?.map(genre => (
                                    <Badge key={genre} variant="secondary" className="bg-muted/50 hover:bg-muted font-medium">{genre}</Badge>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                简介
                            </h3>
                            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                                {item.description}
                            </p>
                        </div>
                    </div>

                    {/* Right: Episodes Panel */}
                    <div className="lg:col-span-2">
                        <div className="bg-muted/10 backdrop-blur-md rounded-2xl border border-border/50 p-4 md:p-6 shadow-sm">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <div className="w-1 h-5 bg-primary rounded-full"></div>
                                播放列表
                            </h3>
                            {item.playbackSources && item.playbackSources.length > 0 ? (
                                <Tabs defaultValue={item.playbackSources[0].sourceName} className="w-full">
                                    <TabsList className="mb-6 flex flex-wrap h-auto bg-transparent border-b border-border/50 w-full justify-start rounded-none p-0 gap-6">
                                        {item.playbackSources.map((sourceGroup) => (
                                            <TabsTrigger 
                                                key={sourceGroup.sourceName} 
                                                value={sourceGroup.sourceName}
                                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 text-base"
                                            >
                                                {sourceGroup.sourceName}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    {item.playbackSources.map((sourceGroup, groupIdx) => (
                                        <TabsContent key={sourceGroup.sourceName} value={sourceGroup.sourceName} className="mt-0 outline-none">
                                            <ScrollArea className="h-[40vh] min-h-[300px] w-full pr-4">
                                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-6 gap-3 pb-4">
                                                    {sourceGroup.urls.map((playUrl, urlIdx) => {
                                                        const isPlaying = groupIdx === currentSourceGroupIndex && urlIdx === currentUrlIndex;
                                                        return (
                                                            <button
                                                                key={`${playUrl.url}-${urlIdx}`}
                                                                onClick={() => handlePlayVideo(playUrl.url, sourceGroup.sourceName, playUrl.name, groupIdx, urlIdx)}
                                                                className={cn(
                                                                    "px-3 py-2.5 text-sm font-medium rounded-xl transition-all truncate border",
                                                                    isPlaying 
                                                                    ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02] ring-2 ring-primary/20" 
                                                                    : "bg-background text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground hover:bg-muted/50"
                                                                )}
                                                                title={playUrl.name}
                                                            >
                                                                {playUrl.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </ScrollArea>
                                        </TabsContent>
                                    ))}
                                </Tabs>
                            ) : (
                                <div className="py-12 text-center">
                                    <p className="text-muted-foreground">暂无可用播放源，请尝试切换内容源或联系管理员。</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] transition-opacity duration-300 ${shortcutText ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                 <div className='bg-black/80 backdrop-blur-md rounded-xl px-6 py-3 flex items-center space-x-3 text-white shadow-2xl font-medium text-lg'>
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
