
"use client";

import { use, useEffect, useState, useRef } from 'react';
import type { ContentItem, PlaybackSourceGroup, SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchContentItemById, fetchAllContent, getMockContentItemById } from '@/lib/content-loader';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Star, CalendarDays, Clock, Video, AlertCircle } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

interface ContentDetailPageParams {
  id: string;
}

interface ContentDetailPageProps {
  params: ContentDetailPageParams;
}

export default function ContentDetailPage({ params: paramsProp }: ContentDetailPageProps) {
  const resolvedParams = use(paramsProp as any);

  const [pageId, setPageId] = useState<string | null>(null);
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [item, setItem] = useState<ContentItem | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPlayUrl, setCurrentPlayUrl] = useState<string | null>(null);
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>('');
  const [videoPlayerError, setVideoPlayerError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (resolvedParams && resolvedParams.id) {
      setPageId(resolvedParams.id);
      setCurrentPlayUrl(null); 
      setVideoPlayerError(null);
    } else {
      setPageId(null);
    }
  }, [resolvedParams]);

  useEffect(() => {
    if (currentPlayUrl) {
      setVideoPlayerError(null); 
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
      let foundItem: ContentItem | null | undefined = undefined;
      const primarySourceUrl = sources.length > 0 ? sources[0].url : null;

      if (primarySourceUrl) {
        foundItem = await fetchContentItemById(primarySourceUrl, pageId);
      }
      
      if (!foundItem && sources.length > 0) { 
        const allItems = await fetchAllContent(sources); 
        foundItem = allItems.find(i => i.id === pageId);
      }
      
      if (!foundItem) {
        foundItem = getMockContentItemById(pageId); 
      }
      
      setItem(foundItem || null);
      setIsLoading(false);
    }
    
    loadContentDetail();
    
  }, [pageId, sources]);


  useEffect(() => {
    if (currentPlayUrl && videoRef.current) {
      const videoElement = videoRef.current;
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (currentPlayUrl.includes('.m3u8')) {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(currentPlayUrl);
          hls.attachMedia(videoElement);

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('HLS.js FATAL error - Type:', data.type, 'Details:', data.details, 'Raw Data:', JSON.stringify(data, null, 2));
            } else {
              console.warn('HLS.js non-fatal error - Type:', data.type, 'Details:', data.details, '(retrying) Raw Data:', JSON.stringify(data, null, 2));
            }
            
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR || 
                data.type === Hls.ErrorTypes.MEDIA_ERROR ||
                data.fatal) { 
              
              let finalMessage = '';
              const isRecovering = !data.fatal && (data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR);
              const recoverySuffix = isRecovering ? ' (尝试恢复中)' : (data.fatal ? ' (严重错误)' : '');

              if (data.type === Hls.ErrorTypes.MEDIA_ERROR && data.details === 'bufferStalledError') {
                finalMessage = `视频缓冲卡顿${recoverySuffix}`;
              } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.details === 'fragLoadError') {
                 finalMessage = `视频片段加载失败${recoverySuffix}`;
              } else {
                let messagePrefix = '';
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    messagePrefix = '网络错误导致视频加载失败';
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    messagePrefix = '媒体错误导致视频加载失败';
                    break;
                  default: 
                    messagePrefix = data.fatal ? '加载视频严重错误' : '加载视频失败'; 
                    break;
                }
                const detailString = data.details ? `: ${data.details}` : '';
                finalMessage = `${messagePrefix}${detailString}${recoverySuffix}`;
              }
              setVideoPlayerError(finalMessage);
            }
          });
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          videoElement.src = currentPlayUrl;
          videoElement.play().catch(playError => console.warn("Autoplay prevented for native HLS:", playError));
        } else {
          setVideoPlayerError('您的浏览器不支持播放此M3U8视频格式。');
        }
      } else {
        videoElement.src = currentPlayUrl;
        videoElement.play().catch(playError => console.warn("Autoplay prevented for standard video:", playError));
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentPlayUrl]);


  const handlePlayVideo = (url: string, name: string) => {
    setCurrentPlayUrl(url);
    setCurrentVideoTitle(`${item?.title} - ${name}`);
    setVideoPlayerError(null); 
    // videoRef.current?.load(); // Generally not needed when HLS.js or src change handles loading
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
          <AspectRatio ratio={16 / 9}>
            {videoPlayerError ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black text-destructive-foreground p-4 text-center">
                <AlertCircle className="w-12 h-12 mb-2 text-destructive" />
                <p className="text-lg font-semibold">播放错误</p>
                <p className="text-sm">{videoPlayerError}</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                controls
                autoPlay
                title={currentVideoTitle}
                className="w-full h-full bg-black"
                onCanPlay={() => setVideoPlayerError(null)} 
                onError={(e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
                  if (!currentPlayUrl?.includes('.m3u8')) { 
                    const videoElement = e.target as HTMLVideoElement;
                    let message = '视频播放时发生未知错误。';
                    if (videoElement.error) {
                      console.error("Video player error code:", videoElement.error.code);
                      console.error("Video player error message:", videoElement.error.message);
                      switch (videoElement.error.code) {
                        case MediaError.MEDIA_ERR_ABORTED:
                          message = '视频加载被中止。';
                          break;
                        case MediaError.MEDIA_ERR_NETWORK:
                          message = '网络错误导致视频加载失败。';
                          break;
                        case MediaError.MEDIA_ERR_DECODE:
                          message = '视频解码错误。文件可能已损坏或格式不受支持。';
                          break;
                        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                          message = '视频格式不受支持或无法找到视频源。请尝试其他播放源或检查网络连接。';
                          break;
                        default:
                          message = `发生未知媒体错误 (代码: ${videoElement.error.code})。`;
                      }
                    } else {
                      console.error("Video player error: An unknown error occurred.", e);
                    }
                    setVideoPlayerError(message);
                  }
                }}
              >
                您的浏览器不支持视频播放。
              </video>
            )}
          </AspectRatio>
           <p className="p-2 text-sm text-muted-foreground">正在播放: {currentVideoTitle}</p>
           <p className="p-2 text-xs text-muted-foreground">
            提示：部分m3u8链接可能需要浏览器原生支持或特定扩展。为获得最佳体验，请确保浏览器更新。如果播放失败，请尝试其他播放源。
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
    

    
