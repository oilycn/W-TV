
"use client";

import { use, useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { ContentItem, SourceConfig, HistoryEntry } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchContentItemById, getMockContentItemById, decodeIdIfNeeded, resolvePlayUrl } from '@/lib/content-loader';
import { Loader2, Star, AlertCircle, RefreshCw, ExternalLink, Globe, MonitorPlay, ArrowLeft, ArrowUpDown, Copy, Check, Download, Play, Keyboard } from 'lucide-react';
import { useCategories } from '@/contexts/CategoryContext';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { MediaPlayerInstance } from '@vidstack/react';
import Image from 'next/image';

// ShadCN UI
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
    const [rawEpisodeUrl, setRawEpisodeUrl] = useState<string>('');
    const [currentEpisodeInfo, setCurrentEpisodeInfo] = useState<{ name: string; source: string } | null>(null);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [isResolvingPlay, setIsResolvingPlay] = useState<boolean>(false);
        
    const [shortcutText, setShortcutText] = useState('');
    const shortcutHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const [player, setPlayer] = useState<MediaPlayerInstance | null>(null);
    const [useIframeFallback, setUseIframeFallback] = useState(false);
    const [history, setHistory] = useLocalStorage<HistoryEntry[]>('cinemaViewHistory', []);
    
    const [isWebFullscreen, setIsWebFullscreen] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("0");
    const [isDescOrder, setIsDescOrder] = useState<boolean>(false);
    const [copiedLink, setCopiedLink] = useState(false);

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
            setPageId(decodeIdIfNeeded(resolvedParams.id));
            setCurrentPlayUrl(null); 
            setError(null);
            setPlaybackError(null);
            setCurrentSourceGroupIndex(null);
            setCurrentUrlIndex(null);
        } else {
            setPageId(null);
        }
    }, [resolvedParams]);

    const handlePlayVideo = useCallback(async (url: string, sourceName: string, episodeName: string, sourceGroupIndex: number, urlIndex: number, overrideSourceId?: string) => {
        setCurrentSourceGroupIndex(sourceGroupIndex);
        setCurrentUrlIndex(urlIndex);
        setUseIframeFallback(false);
        setPlaybackError(null);
        setIsResolvingPlay(true);
        setRawEpisodeUrl(url);
        setCurrentEpisodeInfo({ name: episodeName, source: sourceName });

        const sourceIdToUse = overrideSourceId || activeSourceId;
        const currentSource = sources.find(s => s.id === sourceIdToUse);

        let finalUrl = url;
        if (currentSource) {
            try {
                const resolved = await resolvePlayUrl(currentSource.url, url, sourceName);
                if (resolved && resolved.url && resolved.url.trim().length > 0) {
                    finalUrl = resolved.url.trim();
                } else if (resolved?.error) {
                    setPlaybackError(resolved.error);
                    setCurrentPlayUrl(null);
                    setIsResolvingPlay(false);
                    return;
                }
            } catch (err: any) {
                console.warn('Play URL resolve error:', err);
                setPlaybackError(err?.message || '视频解析出错，请尝试切换线路');
                setCurrentPlayUrl(null);
                setIsResolvingPlay(false);
                return;
            }
        }

        const isDownloadProtocol = /^(magnet:|thunder:|ftp:|ed2k:)/i.test(finalUrl);
        if (isDownloadProtocol) {
            setPlaybackError('DOWNLOAD_PROTOCOL:' + finalUrl);
            setCurrentPlayUrl(null);
            setIsResolvingPlay(false);
            return;
        }

        // 严格检查：如果依然是普通网页链接（如 .html 或非直接媒体流），提示解析失败，禁止把网页传给播放器
        const isLikelyStream = /\.(m3u8|mp4|flv|webm|m4v)($|\?)/i.test(finalUrl) || (!finalUrl.endsWith('.html') && finalUrl.startsWith('http'));
        if (!finalUrl || finalUrl.endsWith('.html') || !isLikelyStream) {
            setPlaybackError('未能获取到可播放的视频直链，请尝试切换其它线路');
            setCurrentPlayUrl(null);
            setIsResolvingPlay(false);
            return;
        }

        setCurrentPlayUrl(finalUrl);
        setIsResolvingPlay(false);

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
                    episodeUrl: finalUrl,
                };
                return [newEntry, ...otherHistory];
            });
        }
    }, [activeSourceId, sources, setHistory]);

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
            
            let sourceToUse: SourceConfig | null = null;
            if (sourceIdFromQuery) {
                sourceToUse = sources.find(s => s.id === sourceIdFromQuery) || null;
                if (!sourceToUse && sourceIdFromQuery.startsWith('sub-')) {
                    const match = sourceIdFromQuery.match(/^sub-(https?:\/\/[^\s]+?\.js)/i);
                    if (match) {
                        sourceToUse = {
                            id: sourceIdFromQuery,
                            name: '规则线路',
                            url: match[1],
                            type: 'rule',
                            enabled: true
                        };
                    }
                }
            }
            if (!sourceToUse && activeSourceId) {
                sourceToUse = sources.find(s => s.id === activeSourceId) || null;
            }
            if (!sourceToUse && sources.length > 0) {
                sourceToUse = sources[0];
            }

            if (sourceToUse) {
                if (sourceToUse.id !== activeSourceId) {
                    setActiveSourceId(sourceToUse.id);
                }
                try {
                    itemFound = await fetchContentItemById(sourceToUse.url, pageId);
                    if (itemFound) {
                        sourceUsedToFind = sourceToUse;
                    }
                } catch (e) {
                    console.warn(`Failed to fetch item from ${sourceToUse.name}:`, e);
                }
            }

            // Fallback: If not found and user didn't specify sourceIdFromQuery, try other sources
            if (!itemFound && !sourceIdFromQuery) {
                for (const altSource of sources) {
                    if (altSource.id === sourceToUse?.id) continue;
                    try {
                        itemFound = await fetchContentItemById(altSource.url, pageId);
                        if (itemFound) {
                            sourceUsedToFind = altSource;
                            setActiveSourceId(altSource.id);
                            break;
                        }
                    } catch (_e) {}
                }
            }
            
            if (!itemFound && pageId) {
                itemFound = getMockContentItemById(pageId); 
            }
            
            setItem(itemFound || null);
            
            if(itemFound && sourceUsedToFind) {
              setActiveTab("0");
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
        
        if (e.key === ' ') {
            if (player.paused) {
                player.play();
            } else {
                player.pause();
            }
        }
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

    // Player error listener (do not auto fallback to iframe)
    useEffect(() => {
        if (!player) return;

        const onError = (event: any) => {
            console.warn('Player error event:', event);
            setPlaybackError('视频解码或播放出错，可能是当前线路直链已过期或限制跨域');
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
                        {useIframeFallback && rawEpisodeUrl ? (
                            <div className="relative w-full h-full flex flex-col bg-black">
                                <div className="flex items-center justify-between px-3 md:px-4 py-2 bg-zinc-900/90 backdrop-blur-sm border-b border-white/10 text-xs text-muted-foreground z-10 shrink-0">
                                    <span className="flex items-center gap-1.5 text-zinc-300 truncate max-w-[200px] sm:max-w-xs">
                                        <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                                        <span className="truncate">网页内嵌模式（如遇广告建议外部打开）</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10"
                                            onClick={() => setUseIframeFallback(false)}
                                        >
                                            <ArrowLeft className="h-3 w-3 mr-1" /> 原生播放器
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
                                            onClick={() => window.open(rawEpisodeUrl, '_blank')}
                                        >
                                            <ExternalLink className="h-3 w-3 mr-1" /> 新窗口
                                        </Button>
                                    </div>
                                </div>
                                <iframe
                                    key={rawEpisodeUrl}
                                    src={rawEpisodeUrl}
                                    title="Playback Frame"
                                    className="w-full flex-1 border-0"
                                    allow="autoplay; encrypted-media; picture-in-picture"
                                    allowFullScreen
                                    sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                                />
                            </div>
                        ) : isResolvingPlay ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white gap-3 p-6 text-center">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-zinc-200">正在解析视频秒播直链...</p>
                                    {currentEpisodeInfo && (
                                        <p className="text-xs text-muted-foreground font-mono">{currentEpisodeInfo.source} · {currentEpisodeInfo.name}</p>
                                    )}
                                </div>
                            </div>
                        ) : playbackError ? (
                            playbackError.startsWith('DOWNLOAD_PROTOCOL:') ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950/95 text-white gap-4 p-6 text-center">
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/30">
                                        <Download className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-1.5 max-w-md">
                                        <h3 className="text-base font-semibold text-foreground">外部下载 / P2P 媒体源</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            该资源为磁力/迅雷/P2P下载链接，浏览器网页无法直接在线播放。您可以点击下方按钮一键复制链接，或调用本地应用（如迅雷/夸克/PotPlayer）下载或播放。
                                        </p>
                                        {currentEpisodeInfo && (
                                            <p className="text-xs text-primary/80 pt-1 font-mono">线路：{currentEpisodeInfo.source} · {currentEpisodeInfo.name}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                                        <Button
                                            size="sm"
                                            variant="default"
                                            className="gap-1.5 text-xs shadow-md"
                                            onClick={() => {
                                                const link = playbackError.replace('DOWNLOAD_PROTOCOL:', '');
                                                navigator.clipboard.writeText(link);
                                                setCopiedLink(true);
                                                setTimeout(() => setCopiedLink(false), 2000);
                                            }}
                                        >
                                            {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                            {copiedLink ? '已复制下载链接' : '复制下载链接'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5 bg-white/5 border-white/10 hover:bg-white/10 text-xs"
                                            onClick={() => {
                                                const link = playbackError.replace('DOWNLOAD_PROTOCOL:', '');
                                                window.open(link, '_blank');
                                            }}
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" /> 调用外部客户端打开
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950/95 text-white gap-4 p-6 text-center">
                                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive ring-1 ring-destructive/30">
                                        <AlertCircle className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-1.5 max-w-md">
                                        <h3 className="text-base font-semibold text-foreground">视频加载失败</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{playbackError}</p>
                                        {currentEpisodeInfo && (
                                            <p className="text-xs text-primary/80 pt-1 font-mono">线路：{currentEpisodeInfo.source} · {currentEpisodeInfo.name}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5 bg-white/5 border-white/10 hover:bg-white/10 text-xs"
                                            onClick={() => {
                                                if (currentSourceGroupIndex !== null && currentUrlIndex !== null && item?.playbackSources) {
                                                    const group = item.playbackSources[currentSourceGroupIndex];
                                                    const ep = group?.urls?.[currentUrlIndex];
                                                    if (ep) handlePlayVideo(ep.url, group.sourceName, ep.name, currentSourceGroupIndex, currentUrlIndex);
                                                }
                                            }}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" /> 重新解析
                                        </Button>
                                        {rawEpisodeUrl && (rawEpisodeUrl.startsWith('http://') || rawEpisodeUrl.startsWith('https://')) && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 bg-white/5 border-white/10 hover:bg-white/10 text-xs"
                                                onClick={() => window.open(rawEpisodeUrl, '_blank')}
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" /> 外部打开
                                            </Button>
                                        )}
                                        {rawEpisodeUrl && (rawEpisodeUrl.startsWith('http://') || rawEpisodeUrl.startsWith('https://')) && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-xs text-muted-foreground hover:text-white"
                                                onClick={() => {
                                                    const isAntiEmbed = /4kcz|czzy|cz4k|jable|netflix/i.test(rawEpisodeUrl);
                                                    if (isAntiEmbed) {
                                                        window.open(rawEpisodeUrl, '_blank');
                                                    } else {
                                                        setUseIframeFallback(true);
                                                        setPlaybackError(null);
                                                    }
                                                }}
                                            >
                                                <Globe className="h-3.5 w-3.5 mr-1" /> 网页播放
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )
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
                                <p className="text-muted-foreground text-sm">请选择一集开始播放</p>
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
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <div className="w-1 h-5 bg-primary rounded-full"></div>
                                    <span>播放列表</span>
                                    {item.playbackSources && item.playbackSources[parseInt(activeTab, 10)] && (
                                        <span className="text-xs font-normal text-muted-foreground ml-1">
                                            (共 {item.playbackSources[parseInt(activeTab, 10)]?.urls?.length || 0} 集)
                                        </span>
                                    )}
                                </h3>
                                {item.playbackSources && item.playbackSources.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsDescOrder(prev => !prev)}
                                        className="h-8 px-2.5 text-xs gap-1.5 bg-background/50 border-border/60 hover:bg-muted/60"
                                        title={isDescOrder ? "切换为正序排列" : "切换为倒序排列"}
                                    >
                                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>{isDescOrder ? '倒序' : '正序'}</span>
                                    </Button>
                                )}
                            </div>
                            {item.playbackSources && item.playbackSources.length > 0 ? (
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="mb-5 flex flex-wrap h-auto bg-transparent border-b border-border/50 w-full justify-start rounded-none p-0 gap-3 sm:gap-6">
                                        {item.playbackSources.map((sourceGroup, groupIdx) => (
                                            <TabsTrigger 
                                                key={`tab-${groupIdx}`} 
                                                value={String(groupIdx)}
                                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2.5 py-2.5 text-sm md:text-base font-medium flex items-center gap-1.5 transition-colors"
                                            >
                                                <span>{sourceGroup.sourceName}</span>
                                                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-normal">
                                                    {sourceGroup.urls.length}
                                                </span>
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    {item.playbackSources.map((sourceGroup, groupIdx) => {
                                        const urlsToDisplay = isDescOrder ? [...sourceGroup.urls].reverse() : sourceGroup.urls;
                                        return (
                                            <TabsContent key={`content-${groupIdx}`} value={String(groupIdx)} className="mt-0 outline-none">
                                                <ScrollArea className="h-[42vh] min-h-[300px] w-full pr-3">
                                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 pb-4 pt-1">
                                                        {urlsToDisplay.map((playUrl, displayIdx) => {
                                                            const originalUrlIdx = isDescOrder ? (sourceGroup.urls.length - 1 - displayIdx) : displayIdx;
                                                            const isPlaying = groupIdx === currentSourceGroupIndex && originalUrlIdx === currentUrlIndex;
                                                            return (
                                                                <button
                                                                    key={`${playUrl.name}-${originalUrlIdx}`}
                                                                    onClick={() => handlePlayVideo(playUrl.url, sourceGroup.sourceName, playUrl.name, groupIdx, originalUrlIdx)}
                                                                    className={cn(
                                                                        "px-2.5 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all border text-center relative overflow-hidden group select-none truncate flex items-center justify-center gap-1.5",
                                                                        isPlaying 
                                                                        ? "bg-primary text-primary-foreground border-primary shadow-md font-semibold ring-2 ring-primary/20 scale-[1.02]" 
                                                                        : "bg-background/80 text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground hover:bg-muted/60"
                                                                    )}
                                                                    title={playUrl.name}
                                                                >
                                                                    {isPlaying && (
                                                                        <span className="flex h-2 w-2 shrink-0 rounded-full bg-primary-foreground animate-pulse" />
                                                                    )}
                                                                    <span className="block truncate">{playUrl.name}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </ScrollArea>
                                            </TabsContent>
                                        );
                                    })}
                                </Tabs>
                            ) : (
                                <div className="py-12 text-center">
                                    <p className="text-muted-foreground">暂无可用播放源，请尝试切换内容源或联系管理员。</p>
                                </div>
                            )}

                            {/* 快捷键操作指引卡片 */}
                            <div className="mt-5 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                                    <Keyboard className="h-3.5 w-3.5 text-primary" />
                                    <span>播放快捷键</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="bg-muted px-2 py-0.5 rounded border border-border/60 font-mono text-[11px]">空格 暂停</span>
                                    <span className="bg-muted px-2 py-0.5 rounded border border-border/60 font-mono text-[11px]">← → 快退/快进</span>
                                    <span className="bg-muted px-2 py-0.5 rounded border border-border/60 font-mono text-[11px]">↑ ↓ 音量</span>
                                    <span className="bg-muted px-2 py-0.5 rounded border border-border/60 font-mono text-[11px]">F 全屏</span>
                                    <span className="bg-muted px-2 py-0.5 rounded border border-border/60 font-mono text-[11px]">Alt+→ 下一集</span>
                                </div>
                            </div>
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
