
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback, useRef, useMemo } from 'react';
import type { ContentItem, SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchApiContentList } from '@/lib/content-loader';
import { ContentCard } from '@/components/content/ContentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2, SearchIcon as SearchIconLucide, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SearchBar } from '@/components/search/SearchBar';


const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

interface SearchResultGroup {
  source: SourceConfig;
  items: ContentItem[];
}

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [searchResultsBySource, setSearchResultsBySource] = useState<SearchResultGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResultsCount, setTotalResultsCount] = useState(0);
  const [selectedSourceId, setSelectedSourceId] = useState<string | 'all'>('all');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const resultsContainerRef = useRef<HTMLElement>(null);
  
  const isMobile = useIsMobile();

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadSearchResults = useCallback(async (currentQuery: string, currentSources: SourceConfig[], signal: AbortSignal) => {
    if (!currentQuery) {
      setSearchResultsBySource([]);
      setTotalResultsCount(0);
      setIsLoading(false);
      setError(null);
      setSelectedSourceId('all');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSearchResultsBySource([]); 
    setSelectedSourceId('all');
    setTotalResultsCount(0);

    const CONCURRENCY_LIMIT = 3; // Keep slots open for Next.js navigation
    let i = 0;

    const executeNext = async () => {
      while (i < currentSources.length) {
        if (signal.aborted) return;
        const source = currentSources[i++];
        try {
          const response = await fetchApiContentList(source.url, { searchTerm: currentQuery, signal });
          if (signal.aborted) return;
          if (response.items && response.items.length > 0) {
            setSearchResultsBySource(prevResults => {
              if (prevResults.some(r => r.source.id === source.id)) return prevResults;
              const newGroup = { source, items: response.items };
              return [...prevResults, newGroup].sort((a, b) => a.source.name.localeCompare(b.source.name));
            });
            setTotalResultsCount(prevCount => prevCount + response.items.length);
          }
        } catch (e: any) {
          if (e.name === 'AbortError') return;
          console.warn(`Search: Error fetching from source ${source.name} for query "${currentQuery}":`, e);
        }
      }
    };

    const workers = [];
    for (let w = 0; w < CONCURRENCY_LIMIT; w++) {
      workers.push(executeNext());
    }

    await Promise.all(workers);
    if (!signal.aborted) {
      setIsLoading(false);
    }

  }, []);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (sources.length > 0 || !query) {
        loadSearchResults(query, sources, abortController.signal);
    } else if (query && sources.length === 0) {
        setIsLoading(false);
        setError("请先配置内容源后再进行搜索。");
        setSearchResultsBySource([]);
        setTotalResultsCount(0);
    }
    
    return () => {
      abortController.abort();
    };
  }, [query, sources, loadSearchResults]);
  
  const itemsToDisplay = useMemo(() => {
    if (selectedSourceId === 'all') {
      const allItems = searchResultsBySource.flatMap(group => 
        group.items.map(item => ({
          ...item, 
          sourceId: group.source.id,
          sourceName: group.source.name,
          renderKey: `${group.source.id}-${item.id}` 
        }))
      );
      // Simple deduplication by item.id, keeping the first one found.
      const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());
      return uniqueItems;
    }

    const group = searchResultsBySource.find(g => g.source.id === selectedSourceId);
    if (!group) return [];
    return group.items.map(item => ({
      ...item,
      sourceId: group.source.id,
      sourceName: group.source.name,
      renderKey: `${group.source.id}-${item.id}`
    }));
  }, [searchResultsBySource, selectedSourceId]);

  const activeSourceName = useMemo(() => {
    if (selectedSourceId === 'all') return '全部结果';
    return searchResultsBySource.find(g => g.source.id === selectedSourceId)?.source.name || '选择来源';
  }, [selectedSourceId, searchResultsBySource]);

  const handleSourceSelect = useCallback((sourceId: string | 'all') => {
    setSelectedSourceId(sourceId);
    if (isMobile) {
      setIsSheetOpen(false);
    }
    resultsContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [isMobile]);

  // Component definitions removed to prevent remounting issues

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)] w-full max-w-screen-3xl mx-auto px-4 md:px-8 py-6">
      {error && (
        <Alert variant="destructive" className="mb-6 shadow-sm">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>搜索提示</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!query && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in zoom-in-95 duration-700">
            <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6 shadow-inner">
                <SearchIconLucide className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">探索影视世界</h2>
            <p className="text-lg">请在顶部搜索栏输入你想观看的电影或剧集</p>
        </div>
      )}
      
      {query && (
        <div className="flex flex-col flex-1 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
                    搜索: <span className="text-primary">"{decodeURIComponent(query)}"</span>
                </h1>
                <span className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border/50 shadow-sm">
                    找到 {totalResultsCount} 个结果
                </span>
            </div>

            {/* Source Tabs (Horizontal) */}
            <div className="w-full overflow-x-auto styled-scrollbar pb-4 mb-6">
                <div className="flex w-max space-x-3 px-1">
                    {searchResultsBySource.length > 0 && (
                        <button
                            onClick={() => handleSourceSelect('all')}
                            className={cn(
                                "px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm border",
                                selectedSourceId === 'all'
                                ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/20 scale-105"
                                : "bg-background text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                            )}
                        >
                            全部结果 ({totalResultsCount})
                        </button>
                    )}
                    {searchResultsBySource.map(group => (
                        <button
                            key={group.source.id}
                            onClick={() => handleSourceSelect(group.source.id)}
                            className={cn(
                                "px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm border",
                                selectedSourceId === group.source.id
                                ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/20 scale-105"
                                : "bg-background text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                            )}
                        >
                            {group.source.name} ({group.items.length})
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Grid */}
            <main ref={resultsContainerRef} className="flex-1 w-full pb-12">
                {isLoading && itemsToDisplay.length === 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6 md:gap-8">
                      {Array.from({ length: 14 }).map((_, index) => (
                        <div key={index} className="space-y-2">
                            <Skeleton className="aspect-[3/4] w-full rounded-lg" />
                            <Skeleton className="h-4 w-4/5 rounded-md" />
                            <Skeleton className="h-3 w-3/5 rounded-md" />
                        </div>
                      ))}
                    </div>
                ) : itemsToDisplay.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6 md:gap-8">
                        {itemsToDisplay.map(item => (
                          <ContentCard 
                            key={item.renderKey} 
                            item={item} 
                            sourceId={item.sourceId}
                            sourceName={selectedSourceId === 'all' ? item.sourceName : undefined}
                          />
                        ))}
                    </div>
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
                        <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                            <SearchIconLucide className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <p className="text-xl font-semibold mb-2">未找到匹配内容</p>
                        <p className="text-muted-foreground text-sm">换个关键词试试，或者检查数据源配置。</p>
                        {sources.length === 0 && (
                            <p className="mt-4 text-sm text-destructive">提示：您尚未配置任何内容源。</p>
                        )}
                    </div>
                )}
            </main>
        </div>
      )}
    </div>
  );
}

function SearchPageSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-1/3 mb-4" />
      <Skeleton className="h-10 w-full max-w-xl mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        <div className="md:col-span-1 space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="md:col-span-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6 md:gap-8">
              {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                      <Skeleton className="aspect-[3/4] w-full rounded-lg" />
                      <Skeleton className="h-4 w-4/5 rounded-md" />
                      <Skeleton className="h-3 w-3/5 rounded-md" />
                  </div>
              ))}
            </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchResults />
    </Suspense>
  );
}
