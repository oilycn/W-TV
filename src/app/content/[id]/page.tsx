
"use client";

import { useEffect, useState } from 'react';
import type { ContentItem, PlaybackSourceGroup, SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchAllContent, getMockContentItemById } from '@/lib/content-loader';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Star, CalendarDays, Clock, Video } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

export default function ContentDetailPage({ params }: { params: { id: string } }) {
  const [pageId, setPageId] = useState<string | null>(null); // State for pageId
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [item, setItem] = useState<ContentItem | null | undefined>(undefined); // undefined for loading, null for not found
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set pageId from params when params are available or change
    if (params && params.id) {
      setPageId(params.id);
    } else {
      setPageId(null); // Explicitly set to null if params.id is not valid
    }
  }, [params]); // Depend on the params object

  useEffect(() => {
    if (!pageId) { 
      // If pageId is null, it means either params were invalid or we are in an initial render cycle
      // before the first useEffect sets pageId. Show loading or not found.
      // If params were indeed invalid from the start, item will eventually be set to null.
      if (params && params.id) {
        // params.id is available, so we are likely just waiting for pageId state to update.
        // Let the loading state handle this.
      } else {
        // params.id was not available, so no valid pageId can be derived.
        setIsLoading(false);
        setItem(null);
      }
      return;
    }

    async function loadContentDetail() {
      setIsLoading(true);
      const allItems = await fetchAllContent(sources);
      let foundItem = allItems.find(i => i.id === pageId);

      if (!foundItem) {
        foundItem = getMockContentItemById(pageId);
      }
      
      setItem(foundItem || null);
      setIsLoading(false);
    }
    
    loadContentDetail();
    
  }, [pageId, sources]); // Depend on pageId (state) and sources

  if (isLoading || item === undefined || (params && params.id && !pageId)) {
    // Show skeleton if:
    // 1. isLoading is true
    // 2. item is still undefined (initial state before any fetch attempt or if pageId was null)
    // 3. params.id exists but pageId state hasn't updated yet (covers the flicker between params arriving and pageId state setting)
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-8 w-1/2 mb-8" />
        <div className="grid md:grid-cols-3 gap-8">
          <Skeleton className="md:col-span-1 aspect-[2/3] rounded-lg" />
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-2 mt-4">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
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
      {item.backdropUrl && (
        <div className="mb-8 rounded-lg overflow-hidden shadow-lg">
          <AspectRatio ratio={16 / 9} className="bg-muted">
            <Image
              src={item.backdropUrl}
              alt={`${item.title} backdrop`}
              fill
              style={{ objectFit: "cover" }}
              className="rounded-lg"
              data-ai-hint={getAiHint(item) + " landscape"}
              unoptimized={item.backdropUrl.startsWith('https://placehold.co')}
              priority
            />
          </AspectRatio>
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
              <Accordion type="single" collapsible className="w-full">
                {item.playbackSources.map((sourceGroup: PlaybackSourceGroup, index: number) => (
                  <AccordionItem value={`item-${index}`} key={`${pageId || `fallbackKey-${index}`}-source-${index}`}>
                    <AccordionTrigger className="text-lg hover:no-underline">
                      {sourceGroup.sourceName || `播放线路 ${index + 1}`}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-2">
                        {sourceGroup.urls.map((playUrl, urlIndex) => (
                          <Button key={`${pageId || `fallbackKey-${index}`}-source-${index}-url-${urlIndex}`} variant="outline" asChild>
                            <Link href={playUrl.url} target="_blank" rel="noopener noreferrer" title={`播放 ${item.title} - ${playUrl.name}`}>
                              {playUrl.name}
                            </Link>
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
