
"use client";

import { use, useEffect, useState } from 'react';
import type { ContentItem, PlaybackSourceGroup, SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchContentItemById, fetchAllContent, getMockContentItemById } from '@/lib/content-loader';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Star, CalendarDays, Clock, Video } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';

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

  useEffect(() => {
    if (resolvedParams && resolvedParams.id) {
      setPageId(resolvedParams.id);
      setCurrentPlayUrl(null); // Reset player when ID changes
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
      let foundItem: ContentItem | null | undefined = undefined;
      const primarySourceUrl = sources.length > 0 ? sources[0].url : null;

      if (primarySourceUrl) {
        console.log(`Detail page: Attempting to fetch item ID ${pageId} from primary source ${primarySourceUrl}`);
        foundItem = await fetchContentItemById(primarySourceUrl, pageId);
        if (foundItem) {
          console.log(`Detail page: Found item ID ${pageId} from primary source.`);
        } else {
          console.log(`Detail page: Item ID ${pageId} not found in primary source.`);
        }
      } else {
        console.log("Detail page: No primary source URL available.");
      }

      if (!foundItem && sources.length > 0) { // Try all sources if not found in primary
        console.log(`Detail page: Item ID ${pageId} not found by direct fetch from primary. Trying fetchAllContent from all ${sources.length} sources...`);
        const allItems = await fetchAllContent(sources);
        foundItem = allItems.find(i => i.id === pageId);
        if (foundItem) {
          console.log(`Detail page: Found item ID ${pageId} via fetchAllContent.`);
        } else {
          console.log(`Detail page: Item ID ${pageId} not found via fetchAllContent.`);
        }
      }
      
      if (!foundItem) {
        console.log(`Detail page: Item ID ${pageId} not found in any sources. Trying mock data...`);
        foundItem = getMockContentItemById(pageId);
        if (foundItem) {
          console.log(`Detail page: Found item ID ${pageId} in mock data.`);
        } else {
          console.log(`Detail page: Item ID ${pageId} not found in mock data.`);
        }
      }
      
      setItem(foundItem || null);
      setIsLoading(false);
    }
    
    loadContentDetail();
    
  }, [pageId, sources]);

  const handlePlayVideo = (url: string, name: string) => {
    setCurrentPlayUrl(url);
    setCurrentVideoTitle(`${item?.title} - ${name}`);
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
            <video
              key={currentPlayUrl} // Add key to force re-render when URL changes
              src={currentPlayUrl}
              controls
              autoPlay
              title={currentVideoTitle}
              className="w-full h-full bg-black"
              onError={(e) => {
                console.error("Video player error:", e);
                // You could show a custom error message to the user here
              }}
            >
              您的浏览器不支持视频播放。
              {/* For m3u8, you'd typically need a library like HLS.js and integrate it here */}
            </video>
          </AspectRatio>
           <p className="p-2 text-sm text-muted-foreground">正在播放: {currentVideoTitle}</p>
           <p className="p-2 text-xs text-muted-foreground">
            提示：部分m3u8链接可能需要浏览器原生支持或特定扩展。为获得最佳体验，请确保浏览器更新。
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
