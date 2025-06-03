
"use client";

import { use, useEffect, useState, Suspense } from 'react';
import type { ContentItem, PlaybackSourceGroup, SourceConfig, PlaybackURL } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchContentItemById, getMockContentItemById } from '@/lib/content-loader';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Star, CalendarDays, Clock, Video, AlertCircle, SkipBack, SkipForward, Loader2 } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import ReactPlayer from 'react-player/lazy';
import 'hls.js'; // Import for side-effects to make HLS.js available to ReactPlayer


const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';
const MAX_HLS_RETRIES = 3;


interface ContentDetailPageParams {
  id: string;
}

interface ContentDetailPageProps {
  params: ContentDetailPageParams;
}

function ContentDetailDisplay({ params: paramsProp }: ContentDetailPageProps) {
  const resolvedParams = use(paramsProp as any); 

  const [pageId, setPageId] = useState<string | null>(null);
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [activeSourceId] = useLocalStorage<string | null>(LOCAL_STORAGE_KEY_ACTIVE_SOURCE, null);
  const [item, setItem] = useState<ContentItem | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentPlayUrl, setCurrentPlayUrl] = useState<string | null>(null);
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>('');
  const [videoPlayerError, setVideoPlayerError] = useState<string | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const [currentSourceGroupIndex, setCurrentSourceGroupIndex] = useState<number | null>(null);
  const [currentUrlIndex, setCurrentUrlIndex] = useState<number | null>(null);

  const [playerKey, setPlayerKey] = useState(0); // Used to force ReactPlayer re-initialization
  const [hlsRetryCount, setHlsRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);


  useEffect(() => {
    if (resolvedParams && resolvedParams.id) {
      setPageId(resolvedParams.id);
      setCurrentPlayUrl(null); 
      setVideoPlayerError(null);
      setIsPlayerReady(false);
      setUseIframeFallback(false);
      setCurrentSourceGroupIndex(null);
      setCurrentUrlIndex(null);
      setHlsRetryCount(0);
      setIsRetrying(false);
      setPlayerKey(prev => prev + 1); // New page ID, new player instance
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
      let itemFound: ContentItem | null | undefined = undefined;

      const activeSourceConfig = sources.find(s => s.id === activeSourceId);

      if (activeSourceConfig) {
        console.log(`ContentDetail: Attempting to fetch item ${pageId} from active source: ${activeSourceConfig.name} (${activeSourceConfig.url})`);
        itemFound = await fetchContentItemById(activeSourceConfig.url, pageId);
      }

      if (!itemFound) {
        for (const source of sources) {
          if (activeSourceConfig && source.id === activeSourceConfig.id) {
            continue; 
          }
          console.log(`ContentDetail: Attempting to fetch item ${pageId} from other source: ${source.name} (${source.url})`);
          itemFound = await fetchContentItemById(source.url, pageId);
          if (itemFound) {
            console.log(`ContentDetail: Found item ${pageId} in source: ${source.name}`);
            break; 
          }
        }
      }
      
      if (!itemFound && pageId) {
        console.log(`ContentDetail: Item ${pageId} not in any dynamic source, trying mock data.`);
        itemFound = getMockContentItemById(pageId); 
      }
      
      setItem(itemFound || null);
      setIsLoading(false);
    }
    
    loadContentDetail();
    
  }, [pageId, sources, activeSourceId]);


  const handlePlayVideo = (url: string, name: string, sourceGroupIndex?: number, urlIndex?: number) => {
    setCurrentPlayUrl(url);
    setCurrentVideoTitle(`${item?.title || '视频'} - ${name}`);
    setVideoPlayerError(null);
    setIsPlayerReady(false); 
    setUseIframeFallback(false);
    setHlsRetryCount(0); // Reset retry count for new video/source
    setIsRetrying(false);
    setPlayerKey(prev => prev + 1); // Force new player instance for new URL

    if (sourceGroupIndex !== undefined) setCurrentSourceGroupIndex(sourceGroupIndex);
    if (urlIndex !== undefined) setCurrentUrlIndex(urlIndex);
  };
  
  const handlePlayerError = (error: any, data?: any, hlsInstance?: any) => {
    console.error('ReactPlayer Error:', error, 'Data:', typeof data === 'object' && data !== null ? JSON.stringify(data) : data, 'HLS Instance:', typeof hlsInstance === 'object' && hlsInstance !== null ? 'HLSInstancePresent' : 'NoHLSInstance');
    let message = '视频播放时发生未知错误。';
    setIsRetrying(false); // Reset retrying message if an error occurs

    if (typeof error === 'string' && error.toLowerCase().includes('hlserror') && data && typeof data === 'object') {
        const hlsErrorType = data.type; 
        const hlsErrorDetails = data.details;
        const hlsErrorFatal = data.fatal;

        message = `HLS 播放错误 (类型: ${hlsErrorType || 'N/A'}, 详情: ${hlsErrorDetails || 'N/A'})`;

        const isRetryableNetwork = hlsErrorType === 'networkError';
        const isRetryableMedia = hlsErrorType === 'mediaError' && 
                                (hlsErrorDetails === 'fragLoadError' || 
                                 hlsErrorDetails === 'fragLoadTimeout' ||
                                 hlsErrorDetails === 'bufferStalledError' ||
                                 hlsErrorDetails === 'manifestLoadError' ||
                                 hlsErrorDetails === 'levelLoadError');
        
        // Retry for fatal (or undefined fatal status) network errors or fatal retryable media errors
        if ((isRetryableNetwork || isRetryableMedia) && hlsErrorFatal !== false) { 
            if (hlsRetryCount < MAX_HLS_RETRIES) {
                const retryAttempt = hlsRetryCount + 1;
                console.warn(`HLS Error: Attempting retry ${retryAttempt}/${MAX_HLS_RETRIES} for ${hlsErrorDetails || hlsErrorType} on URL: ${currentPlayUrl}`);
                setIsRetrying(true);
                setVideoPlayerError(null); // Clear previous error message while retrying

                const delay = 1000 * Math.pow(2, hlsRetryCount); // Exponential backoff: 1s, 2s, 4s
                setTimeout(() => {
                    setPlayerKey(prev => prev + 1); 
                    // isRetrying will be reset by onReady or next onError
                }, delay);
                setHlsRetryCount(retryAttempt);
                return; 
            } else {
                message += `. 已达到最大重试次数 (${MAX_HLS_RETRIES})。尝试使用备用播放方式。`;
                console.warn(`HLS Error: Max retries (${MAX_HLS_RETRIES}) reached for ${hlsErrorDetails || hlsErrorType}. Falling back.`);
                setUseIframeFallback(true);
            }
        } else if (hlsErrorFatal) { 
            message += '. 这是一个无法自动恢复的严重错误，尝试使用备用播放方式。';
            setUseIframeFallback(true);
            // return; // Fall through to setVideoPlayerError
        } else if (hlsErrorFatal === false) { 
            message += ' (HLS.js 正在尝试恢复)';
             // No explicit action needed from our side; hls.js handles it.
        } else {
            // Generic HLS error where 'fatal' might be undefined or data fields are missing.
            // Treat as potentially serious and try fallback.
            message += '. 未知 HLS 错误，尝试使用备用播放方式。';
            setUseIframeFallback(true);
        }

    } else if (typeof error === 'object' && error !== null) {
        if (error.target && error.target.error && typeof error.target.error.code === 'number') {
            const mediaError = error.target.error;
            message = `媒体错误 (代码: ${mediaError.code})。`;
            if (mediaError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                message += ' 视频源格式不支持或无法访问。尝试使用备用播放方式。';
                setUseIframeFallback(true); 
                // return; // Fall through
            } else if (mediaError.message) {
                 message += ` ${mediaError.message}`;
            }
        } else if (error.message) { 
            message = `播放器报告: ${error.message}`;
        }
    } else if (typeof error === 'string') { 
        message = `播放器报告: ${error}`;
    }
    
    if (message.includes('MEDIA_ERR_SRC_NOT_SUPPORTED') || message.includes('视频源格式不支持')) {
      if(!useIframeFallback) { 
        message += ' 部分链接可能为网页播放器，将尝试内嵌框架播放。';
        setUseIframeFallback(true);
      }
    }

    setVideoPlayerError(message);
    setIsPlayerReady(true); // Still set to true to hide skeleton on error, error message will show
  };

  const handlePlayerReady = () => {
    setIsPlayerReady(true);
    setHlsRetryCount(0); // Reset retries on successful load/ready
    setIsRetrying(false);
    setVideoPlayerError(null); // Clear any previous error/retry messages
  };


  const getPreviousEpisode = (): PlaybackURL & { sourceGroupIndex: number; urlIndex: number } | null => {
    if (!item || !item.playbackSources || currentSourceGroupIndex === null || currentUrlIndex === null) return null;

    if (currentUrlIndex > 0) {
      return { 
        ...item.playbackSources[currentSourceGroupIndex].urls[currentUrlIndex - 1], 
        sourceGroupIndex: currentSourceGroupIndex, 
        urlIndex: currentUrlIndex - 1 
      };
    }
    let prevGroupIdx = currentSourceGroupIndex - 1;
    while(prevGroupIdx >= 0) {
        const prevGroup = item.playbackSources[prevGroupIdx];
        if (prevGroup.urls.length > 0) {
            return { 
                ...prevGroup.urls[prevGroup.urls.length - 1], 
                sourceGroupIndex: prevGroupIdx, 
                urlIndex: prevGroup.urls.length - 1 
            };
        }
        prevGroupIdx--;
    }
    return null;
  };

  const getNextEpisode = (): PlaybackURL & { sourceGroupIndex: number; urlIndex: number } | null => {
    if (!item || !item.playbackSources || currentSourceGroupIndex === null || currentUrlIndex === null) return null;

    const currentGroup = item.playbackSources[currentSourceGroupIndex];
    if (currentUrlIndex < currentGroup.urls.length - 1) {
      return { 
        ...currentGroup.urls[currentUrlIndex + 1], 
        sourceGroupIndex: currentSourceGroupIndex, 
        urlIndex: currentUrlIndex + 1 
      };
    }
    let nextGroupIdx = currentSourceGroupIndex + 1;
    while(nextGroupIdx < item.playbackSources.length) {
        const nextGroup = item.playbackSources[nextGroupIdx];
        if (nextGroup.urls.length > 0) {
            return { 
                ...nextGroup.urls[0], 
                sourceGroupIndex: nextGroupIdx, 
                urlIndex: 0 
            };
        }
        nextGroupIdx++;
    }
    return null;
  };

  const previousEpisode = getPreviousEpisode();
  const nextEpisode = getNextEpisode();

  const playPrevious = () => {
    if (previousEpisode) {
      handlePlayVideo(previousEpisode.url, previousEpisode.name, previousEpisode.sourceGroupIndex, previousEpisode.urlIndex);
    }
  };

  const playNext = () => {
    if (nextEpisode) {
      handlePlayVideo(nextEpisode.url, nextEpisode.name, nextEpisode.sourceGroupIndex, nextEpisode.urlIndex);
    }
  };


  if (isLoading || item === undefined) { 
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="w-full aspect-video mb-8 rounded-lg" />
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-8 w-1/2 mb-8" />
        <div className="grid md:grid-cols-3 gap-8">
          <Skeleton className="md:col-span-1 aspect-[2/3] rounded-lg" />
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) { 
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-semibold text-destructive">内容未找到</h1>
        <p className="text-muted-foreground">抱歉，我们找不到您请求的内容 (ID: {pageId || "无效的ID"})。</p>
      </div>
    );
  }
  
  const getAiHint = (currentItem: ContentItem) => {
    if (currentItem.genres && currentItem.genres.length > 0) {
      return currentItem.genres.slice(0, 2).join(" ").toLowerCase();
    }
    return currentItem.title.split(" ")[0].toLowerCase() || "movie poster";
  }

  return (
    <div className="container mx-auto py-8">
      {currentPlayUrl && (
        <div className="mb-4 rounded-lg overflow-hidden shadow-lg bg-card">
          <AspectRatio ratio={16 / 9} className="bg-black relative">
            {useIframeFallback ? (
              <iframe
                src={currentPlayUrl}
                width="100%"
                height="100%"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title="Video Fallback Player"
                className="border-0"
                onLoad={() => { setIsPlayerReady(true); setIsRetrying(false); }} 
              ></iframe>
            ) : videoPlayerError && !isRetrying ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black text-destructive-foreground p-4 text-center">
                <AlertCircle className="w-12 h-12 mb-2 text-destructive" />
                <p className="text-lg font-semibold">播放错误</p>
                <p className="text-sm">{videoPlayerError}</p>
              </div>
            ) : isRetrying ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-black text-muted-foreground p-4 text-center">
                    <Loader2 className="w-12 h-12 mb-4 animate-spin text-primary" />
                    <p className="text-lg font-semibold">播放器加载中...</p>
                    <p className="text-sm">正在尝试重新加载视频 (尝试 {hlsRetryCount}/{MAX_HLS_RETRIES})</p>
                </div>
            ) : (
              <>
                {!isPlayerReady && !useIframeFallback && !isRetrying && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-black text-muted-foreground">
                    <Loader2 className="w-12 h-12 mb-4 animate-spin text-primary" />
                     <p>播放器准备中...</p>
                  </div>
                )}
                 <ReactPlayer
                    key={playerKey} // Important for re-initialization on retry or URL change
                    url={currentPlayUrl}
                    playing={true}
                    controls={true}
                    width="100%"
                    height="100%"
                    onError={handlePlayerError}
                    onReady={handlePlayerReady} // Use specific onReady to reset retry state
                    style={{ display: isPlayerReady && !videoPlayerError && !isRetrying ? 'block' : 'none' }}
                    config={{
                        file: {
                          attributes: {
                            crossOrigin: 'anonymous',
                          },
                          hlsOptions: {
                            // HLS.js specific options can go here if needed
                            // Example: enableSoftwareAES: true for certain streams
                          },
                        },
                      }}
                  />
              </>
            )}
          </AspectRatio>
          <div className="flex justify-between items-center p-2">
            <p className="text-sm text-muted-foreground truncate mr-4">正在播放: {currentVideoTitle}</p>
            {item?.playbackSources && item.playbackSources.length > 0 && (
              <div className="flex gap-2">
                <Button onClick={playPrevious} disabled={!previousEpisode} variant="outline" size="sm">
                  <SkipBack className="mr-1 md:mr-2 h-4 w-4" /> 
                  <span className="hidden sm:inline">上一集</span>
                  <span className="sm:hidden">上集</span>
                </Button>
                <Button onClick={playNext} disabled={!nextEpisode} variant="outline" size="sm">
                  <span className="hidden sm:inline">下一集</span>
                  <span className="sm:hidden">下集</span>
                  <SkipForward className="ml-1 md:ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
           {currentPlayUrl && (
            <p className="px-2 pb-2 text-xs text-muted-foreground break-all">
              视频链接: {currentPlayUrl.split('?retry=')[0]} {/* Display original URL without retry param */}
            </p>
           )}
           <p className="px-2 pb-2 text-xs text-muted-foreground">
             {useIframeFallback ? "提示: 当前通过内嵌框架播放，部分功能可能受限。" : "提示：如果播放失败或卡顿，请尝试其他播放源或检查网络连接。"}
          </p>
        </div>
      )}
      
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Card className="overflow-hidden shadow-lg">
            <AspectRatio ratio={2 / 3} className="bg-muted">
              <Image
                src={item.posterUrl}
                alt={item.title}
                fill
                style={{ objectFit: "cover" }}
                className="rounded-t-lg"
                data-ai-hint={getAiHint(item)}
                unoptimized={item.posterUrl.startsWith('https://placehold.co')}
              />
            </AspectRatio>
          </Card>
        </div>
        <div className="md:col-span-2">
          <h1 className="text-4xl font-bold mb-2 text-foreground">{item.title}</h1>
          <div className="flex items-center space-x-4 text-muted-foreground mb-4">
            {item.releaseYear && (
              <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1" /> {item.releaseYear}</span>
            )}
            {item.runtime && (
              <span className="flex items-center"><Clock className="w-4 h-4 mr-1" /> {item.runtime}</span>
            )}
            <span className="flex items-center capitalize"><Video className="w-4 h-4 mr-1" /> {item.type === 'movie' ? '电影' : '电视剧'}</span>
          </div>

          {item.userRating && (
            <div className="flex items-center text-amber-400 mb-4">
              <Star className="w-5 h-5 mr-1 fill-current" />
              <span className="text-xl font-semibold">{item.userRating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground ml-1">/ 10</span>
            </div>
          )}

          <div className="mb-6">
            {item.genres && item.genres.map(genre => (
              <Badge key={genre} variant="outline" className="mr-2 mb-2 text-sm">{genre}</Badge>
            ))}
          </div>
          
          <h2 className="text-2xl font-semibold mb-2 text-foreground">简介</h2>
          <p className="text-foreground/80 leading-relaxed mb-6">{item.description}</p>

          {item.cast && item.cast.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2 text-foreground">演员</h3>
              <p className="text-foreground/80">{item.cast.join(', ')}</p>
            </div>
          )}

          {item.director && item.director.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2 text-foreground">导演</h3>
              <p className="text-foreground/80">{item.director.join(', ')}</p>
            </div>
          )}
          
          {item.availableQualities && item.availableQualities.length > 0 && (
             <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2 text-foreground">可用画质</h3>
               {item.availableQualities.map(quality => (
                 <Badge key={quality} variant="default" className="mr-2 mb-2 bg-primary text-primary-foreground">{quality}</Badge>
               ))}
             </div>
           )}

          {item.playbackSources && item.playbackSources.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-semibold mb-3 text-foreground">播放源</h2>
              <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
                {item.playbackSources.map((sourceGroup: PlaybackSourceGroup, groupIdx: number) => (
                  <AccordionItem value={`item-${groupIdx}`} key={`${pageId || `fallbackKey-${groupIdx}`}-source-${groupIdx}`}>
                    <AccordionTrigger className="text-lg hover:no-underline">
                      {sourceGroup.sourceName || `播放线路 ${groupIdx + 1}`}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-2">
                        {sourceGroup.urls.map((playUrl, urlIdx) => (
                          <Button 
                            key={`${pageId || `fallbackKey-${groupIdx}`}-source-${groupIdx}-url-${urlIdx}`} 
                            variant={(currentSourceGroupIndex === groupIdx && currentUrlIndex === urlIdx) ? "default" : "outline"}
                            onClick={() => handlePlayVideo(playUrl.url, playUrl.name, groupIdx, urlIdx)}
                            title={`播放 ${item.title} - ${playUrl.name}`}
                          >
                            {playUrl.name}
                          </Button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContentDetailPage(props: ContentDetailPageProps) {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <Skeleton className="w-full aspect-video mb-8 rounded-lg" />
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-8 w-1/2 mb-8" />
        <div className="flex items-center justify-center mt-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    }>
      <ContentDetailDisplay {...props} />
    </Suspense>
  );
}

