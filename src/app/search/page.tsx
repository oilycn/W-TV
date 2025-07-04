
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
  const [selectedSourceId, setSelectedSourceId] = useState<string | 'all' | null>('all');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const resultsContainerRef = useRef<HTMLElement>(null);
  
  const isMobile = useIsMobile();

  const loadSearchResults = useCallback(async (currentQuery: string, currentSources: SourceConfig[]) => {
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

    const searchPromises = currentSources.map(async (source) => {
      try {
        const response = await fetchApiContentList(source.url, { searchTerm: currentQuery });
        if (response.items && response.items.length > 0) {
          setSearchResultsBySource(prevResults => {
            if (prevResults.some(r => r.source.id === source.id)) return prevResults;
            const newGroup = { source, items: response.items };
            return [...prevResults, newGroup];
          });
          setTotalResultsCount(prevCount => prevCount + response.items.length);
        }
      } catch (e) {
        console.warn(`Search: Error fetching from source ${source.name} for query "${currentQuery}":`, e);
      }
    });

    await Promise.all(searchPromises);
    setIsLoading(false);

  }, []);

  useEffect(() => {
    if (sources.length > 0 || !query) {
        loadSearchResults(query, sources);
    } else if (query && sources.length === 0) {
        setIsLoading(false);
        setError("请先配置内容源后再进行搜索。");
        setSearchResultsBySource([]);
        setTotalResultsCount(0);
    }
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

  const SourceList = () => (
    <>
      <div className="p-4">
        <h2 className="text-lg font-semibold text-card-foreground">搜索来源</h2>
      </div>
      <Separator className="mx-4 w-auto bg-border/50" />
      <ScrollArea className="flex-1">
        <div className="p-2">
          {searchResultsBySource.length > 0 && (
              <Button
                key="all-results"
                variant={selectedSourceId === 'all' ? "secondary" : "ghost"}
                onClick={() => handleSourceSelect('all')}
                className={cn(
                  "justify-start w-full text-left h-auto py-2.5 px-3 text-base",
                  selectedSourceId === 'all' && "font-bold"
                )}
              >
                <span className="flex-1 truncate">全部结果</span>
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {totalResultsCount}
                </span>
              </Button>
          )}
          {searchResultsBySource.map(group => (
            <Button
              key={group.source.id}
              variant={selectedSourceId === group.source.id ? "secondary" : "ghost"}
              onClick={() => handleSourceSelect(group.source.id)}
              className={cn(
                "justify-start w-full text-left h-auto py-2.5 px-3 text-base",
                selectedSourceId === group.source.id && "font-bold"
              )}
            >
              <span className="flex-1 truncate">{group.source.name}</span>
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {group.items.length}
              </span>
            </Button>
          ))}
          {isLoading && searchResultsBySource.length === 0 && (
            <div className="p-4 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span>搜索中...</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );

  const ResultsGrid = ({ items }: { items: (typeof itemsToDisplay) }) => (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {items.map(item => (
          <ContentCard 
            key={item.renderKey} 
            item={item} 
            sourceId={item.sourceId}
            sourceName={selectedSourceId === 'all' ? item.sourceName : undefined}
          />
        ))}
    </div>
  );

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="space-y-2">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 pb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
          搜索
        </h1>
        <div className='max-w-xl'>
          <SearchBar />
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>搜索提示</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!query && !isLoading && (
        <div className="flex-1 text-center py-12 flex flex-col items-center justify-center text-muted-foreground">
            <SearchIconLucide className="mx-auto h-16 w-16 mb-4" />
            <p className="text-xl">通过上方的搜索框查找内容。</p>
        </div>
      )}
      
      {query && (
        <>
        <p className="text-muted-foreground mb-4 text-sm">
            {isLoading && totalResultsCount === 0 ? `正在为“${decodeURIComponent(query)}”搜索中...` : `在 ${searchResultsBySource.length} 个来源中找到 ${totalResultsCount} 条相关内容。`}
        </p>

        {isMobile ? (
            <div className="flex flex-col flex-1 mt-2 overflow-hidden">
            {searchResultsBySource.length > 0 && (
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" className="mb-4 flex justify-between items-center">
                    <span>{activeSourceName}</span>
                    <ChevronRight className="h-4 w-4" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[60%] flex flex-col">
                    <SourceList />
                </SheetContent>
                </Sheet>
            )}
            <main ref={resultsContainerRef} className="flex-1 h-full overflow-y-auto">
                 {isLoading && itemsToDisplay.length === 0 ? <LoadingSkeleton /> : <ResultsGrid items={itemsToDisplay} />}
            </main>
            </div>
        ) : (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 mt-2 overflow-hidden">
            <aside className="md:col-span-1 h-full flex flex-col backdrop-blur-md rounded-lg shadow-sm bg-card/50">
                <SourceList />
            </aside>
            <main ref={resultsContainerRef} className="md:col-span-3 h-full overflow-y-auto">
                {isLoading && itemsToDisplay.length === 0 ? <LoadingSkeleton /> : <ResultsGrid items={itemsToDisplay} />}
            </main>
            </div>
        )}
        {!isLoading && itemsToDisplay.length === 0 && (
            <div className="text-center py-12 flex flex-col items-center justify-center h-full text-muted-foreground">
            <SearchIconLucide className="mx-auto h-16 w-16 mb-4" />
            <p className="text-xl">未找到与 "{decodeURIComponent(query)}" 相关的内容。</p>
            {sources.length === 0 && (
                <p className="mt-2 text-sm">提示：您尚未配置任何内容源。</p>
            )}
            </div>
        )}
        </>
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
        <div className="md:col-span-3 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
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
