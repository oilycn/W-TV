
"use client";

import { use, useEffect, useState, Suspense, useRef } from 'react';
import type { ContentItem, PlaybackSourceGroup, SourceConfig, PlaybackURL } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchContentItemById, getMockContentItemById } from '@/lib/content-loader';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Star, CalendarDays, Clock, Video, AlertCircle, SkipBack, SkipForward } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import DPlayerComponent from '@/components/player/DPlayerComponent';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';


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
  const [isPlayerReady, setIsPlayerReady] = useState(false); // For DPlayer loading state

  const [currentSourceGroupIndex, setCurrentSourceGroupIndex] = useState<number | null>(null);
  const [currentUrlIndex, setCurrentUrlIndex] = useState<number | null>(null);


  useEffect(() => {
    if (resolvedParams && resolvedParams.id) {
      setPageId(resolvedParams.id);
      setCurrentPlayUrl(null); 
      setVideoPlayerError(null);
      setIsPlayerReady(false);
      setCurrentSourceGroupIndex(null);
      setCurrentUrlIndex(null);
    } else {
      setPageId(null);
    }
  }, [resolvedParams]);

  useEffect(() => {
    if (currentPlayUrl) {
      setVideoPlayerError(null);
      setIsPlayerReady(false); // Reset ready state for new URL
    }
  }, [currentPlayUrl]);

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
    if (sourceGroupIndex !== undefined) setCurrentSourceGroupIndex(sourceGroupIndex);
    if (urlIndex !== undefined) setCurrentUrlIndex(urlIndex);
  };
  
  const handleDPlayerError = (errorType: string, errorData: any) => {
    console.error(
      'DPlayer Error in Page - Type:', errorType, 
      'Raw Error Data (direct log):', errorData, 
      'Raw Error Data (stringified):', typeof errorData === 'object' && errorData !== null ? JSON.stringify(errorData, null, 2) : errorData
    );
    let message = '视频播放时发生未知错误。';

    if (errorData) {
        if (typeof errorData === 'string') {
            message = `播放器报告: ${errorData}`;
        } else if (errorData.message) {
            message = `播放器错误: ${errorData.message}`;
        } else if (errorData.type && errorData.details) { // HLS.js-like error structure within DPlayer
            message = `播放错误 (${errorData.type}${errorData.details ? ': ' + errorData.details : ''})`;
            if (errorData.fatal === false && (errorData.type === 'networkError' || errorData.type === 'mediaError')) {
                message += ' (尝试恢复中)';
            }
        } else if (errorData.code) {
            message = `播放器错误代码: ${errorData.code}`;
        }
    }
    // Add a hint for potential webpage links if error is generic
    if (message === '视频播放时发生未知错误。' || (errorData && !errorData.type && !errorData.details && !errorData.message && !errorData.code) ) {
         message += ' 部分链接可能为网页播放器，无法在此直接播放。';
    }

    setVideoPlayerError(message);
    setIsPlayerReady(true); // Still set to true to hide skeleton on error
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
    // Check previous group, last episode
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
    // Check next group, first episode
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
            {videoPlayerError ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black text-destructive-foreground p-4 text-center">
                <AlertCircle className="w-12 h-12 mb-2 text-destructive" />
                <p className="text-lg font-semibold">播放错误</p>
                <p className="text-sm">{videoPlayerError}</p>
              </div>
            ) : (
              <>
                {!isPlayerReady && (
                  <div className="w-full h-full flex items-center justify-center">
                    <Skeleton className="w-full h-full" />
                     <p className="absolute text-muted-foreground">播放器准备中...</p>
                  </div>
                )}
                 <DPlayerComponent
                    videoUrl={currentPlayUrl}
                    autoplay={true}
                    onPlayerError={handleDPlayerError}
                    onPlayerReady={() => setIsPlayerReady(true)}
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
              视频链接: {currentPlayUrl}
            </p>
           )}
           <p className="px-2 pb-2 text-xs text-muted-foreground">
            提示：如果播放失败或卡顿，请尝试其他播放源或检查网络连接。DPlayer 支持多种格式，但部分源可能仍存在兼容性问题。
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
      </div>
    }>
      <ContentDetailDisplay {...props} />
    </Suspense>
  );
}

