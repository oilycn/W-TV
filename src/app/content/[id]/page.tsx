
"use client";

import { use, useEffect, useState, Suspense } from 'react';
import type { ContentItem, PlaybackSourceGroup, SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchContentItemById, getMockContentItemById } from '@/lib/content-loader';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Star, CalendarDays, Clock, Video, AlertCircle } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import ReactPlayer from 'react-player/lazy';
// import 'dashjs'; // ReactPlayer handles DASH if dashjs is in dependencies and URL is DASH
// import 'hls.js'; // ReactPlayer handles HLS if hls.js is in dependencies and URL is HLS

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
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  useEffect(() => {
    if (resolvedParams && resolvedParams.id) {
      setPageId(resolvedParams.id);
      setCurrentPlayUrl(null); 
      setVideoPlayerError(null);
      setIsPlayerReady(false);
    } else {
      setPageId(null);
    }
  }, [resolvedParams]);

  useEffect(() => {
    if (currentPlayUrl) {
      setVideoPlayerError(null);
      setIsPlayerReady(false); 
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

      if (sources.length > 0 && pageId) {
        // Try fetching from the current active source first, if available
        const activeSource = sources.find(s => s.id === activeSourceId);
        if (activeSource) {
          console.log(`ContentDetail: Attempting to fetch item ${pageId} from active source: ${activeSource.name} (${activeSource.url})`);
          itemFound = await fetchContentItemById(activeSource.url, pageId);
        }

        // If not found in active source, or no active source was set, try all other sources
        if (!itemFound) {
          for (const source of sources) {
            // Skip if we already tried this as the active source
            if (activeSource && source.id === activeSource.id) {
              continue;
            }
            console.log(`ContentDetail: Attempting to fetch item ${pageId} from other source: ${source.name} (${source.url})`);
            itemFound = await fetchContentItemById(source.url, pageId);
            if (itemFound) {
              console.log(`ContentDetail: Found item ${pageId} in source: ${source.name}`);
              break; // Found it
            }
          }
        }
      }
      
      // If still not found (e.g., no sources or item not in any source), try mock data
      if (!itemFound && pageId) {
        console.log(`ContentDetail: Item ${pageId} not in any dynamic source, trying mock data.`);
        itemFound = getMockContentItemById(pageId); 
      }
      
      setItem(itemFound || null);
      setIsLoading(false);
    }
    
    loadContentDetail();
    
  }, [pageId, sources, activeSourceId]);


  const handlePlayVideo = (url: string, name: string) => {
    setCurrentPlayUrl(url);
    setCurrentVideoTitle(`${item?.title || '视频'} - ${name}`);
    setVideoPlayerError(null);
    setIsPlayerReady(false);
  };
  
  const handlePlayerError = (
    error: any,
    data?: any, 
    hlsInstance?: any, 
  ) => {
    console.error('ReactPlayer Error:', error, 'Data:', data, 'HLS Instance:', hlsInstance);
    let message = '视频播放时发生未知错误。';

    if (typeof error === 'string') {
      const lowerError = error.toLowerCase();
      if (lowerError.includes('hlserror') && data && data.type) {
        message = `HLS 播放错误 (${data.type}${data.details ? ': ' + data.details : ''})`;
        if (data.fatal === false) {
            if (data.type === 'networkError' && data.details === 'fragLoadError') {
                 message = '视频片段加载失败，尝试恢复中...';
            } else if (data.type === 'mediaError' && data.details === 'bufferStalledError') {
                 message = '视频缓冲卡顿，尝试恢复中...';
            } else {
                 message += ' (尝试恢复中)';
            }
        } else if (data.fatal === true) {
             message += ' (致命错误，无法恢复)';
        }
      } else if (lowerError.includes('dasherror') && data) {
        const dashErr = data.error || data; 
        message = `DASH 播放错误 (${dashErr.code || 'unknown'}${dashErr.message ? ': ' + dashErr.message : ''})`;
      } else {
        message = `播放器报告错误: ${error}`;
      }
    } else if (error && error.message) { 
      message = error.message;
    } else if (error && error.target && error.target.error && typeof error.target.error.code === 'number') { 
        const mediaError = error.target.error as MediaError;
        switch (mediaError.code) {
            case mediaError.MEDIA_ERR_ABORTED: message = '视频加载已中止。'; break;
            case mediaError.MEDIA_ERR_NETWORK: message = '网络错误导致视频加载失败。'; break;
            case mediaError.MEDIA_ERR_DECODE: message = '视频解码错误。'; break;
            case mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: message = '视频源格式不支持或无法访问。'; break;
            default: message = `发生媒体错误 (代码: ${mediaError.code})。`; break;
        }
    } else if (data && data.type) { 
        message = `播放技术性错误 (${data.type}${data.details ? ': ' + data.details : ''})`;
        if (data.fatal === false && (data.type === 'networkError' || data.type === 'mediaError')) {
          message += ' (尝试恢复中)';
        } else if (data.fatal === true) {
             message += ' (致命错误，无法恢复)';
        }
    }

    setVideoPlayerError(message);
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
        <div className="mb-8 rounded-lg overflow-hidden shadow-lg bg-card">
          <AspectRatio ratio={16 / 9} className="bg-black">
            {videoPlayerError ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black text-destructive-foreground p-4 text-center">
                <AlertCircle className="w-12 h-12 mb-2 text-destructive" />
                <p className="text-lg font-semibold">播放错误</p>
                <p className="text-sm">{videoPlayerError}</p>
              </div>
            ) : (
              <>
                {!isPlayerReady && !videoPlayerError && (
                  <div className="w-full h-full flex items-center justify-center">
                    <Skeleton className="w-full h-full" />
                     <p className="absolute text-muted-foreground">播放器准备中...</p>
                  </div>
                )}
                 <ReactPlayer
                    url={currentPlayUrl}
                    playing={true}
                    controls={true}
                    width="100%"
                    height="100%"
                    onError={handlePlayerError}
                    onReady={() => setIsPlayerReady(true)}
                    onPlay={() => setVideoPlayerError(null)} 
                    config={{
                        file: {
                          attributes: { crossOrigin: 'anonymous' },
                        }
                    }}
                    style={{ display: isPlayerReady || videoPlayerError ? 'block' : 'none' }}
                  />
              </>
            )}
          </AspectRatio>
           <p className="p-2 text-sm text-muted-foreground">正在播放: {currentVideoTitle}</p>
           <p className="p-2 text-xs text-muted-foreground">
            提示：如果播放失败或卡顿，请尝试其他播放源或检查网络连接。部分视频格式可能需要现代浏览器支持。
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
                {item.playbackSources.map((sourceGroup: PlaybackSourceGroup, index: number) => (
                  <AccordionItem value={`item-${index}`} key={`${pageId || `fallbackKey-${index}`}-source-${index}`}>
                    <AccordionTrigger className="text-lg hover:no-underline">
                      {sourceGroup.sourceName || `播放线路 ${index + 1}`}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-2">
                        {sourceGroup.urls.map((playUrl, urlIndex) => (
                          <Button 
                            key={`${pageId || `fallbackKey-${index}`}-source-${index}-url-${urlIndex}`} 
                            variant="outline" 
                            onClick={() => handlePlayVideo(playUrl.url, playUrl.name)}
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

