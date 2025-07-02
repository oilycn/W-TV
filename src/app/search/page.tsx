"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalResultsCount, setTotalResultsCount] = useState(0);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const resultsContainerRef = useRef<HTMLElement>(null);
  
  const isMobile = useIsMobile();

  const loadSearchResults = useCallback(async (currentQuery: string, currentSources: SourceConfig[]) => {
    if (!currentQuery) {
      setSearchResultsBySource([]);
      setTotalResultsCount(0);
      setIsLoading(false);
      setError(null);
      setSelectedSourceId(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSearchResultsBySource([]); 
    setSelectedSourceId(null);
    setTotalResultsCount(0);

    const searchPromises = currentSources.map(async (source) => {
      try {
        const response = await fetchApiContentList(source.url, { searchTerm: currentQuery });
        if (response.items && response.items.length > 0) {
          setSearchResultsBySource(prevResults => {
            if (prevResults.some(r => r.source.id === source.id)) return prevResults;
            const newGroup = { source, items: response.items };
            if (prevResults.length === 0) setSelectedSourceId(source.id);
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
  
  const activeGroup = searchResultsBySource.find(g => g.source.id === selectedSourceId);
  
  const handleSourceSelect = useCallback((sourceId: string) => {
    setSelectedSourceId(sourceId);
    if (isMobile) {
      setIsSheetOpen(false);
    }
    resultsContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [isMobile]);

  const SourceList = () => (
    <>
      <div className="p-4">
        <h2 className="text-lg font-semibold text-card-foreground">播放源</h2>
      </div>
      <Separator className="mx-4 w-auto bg-border/50" />
      <ScrollArea className="flex-1">
        <div className="p-2">
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
          {isLoading && (
            <div className="p-4 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span>搜索中...</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>搜索提示</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!query) {
    return (
      <div className="text-center py-12 flex flex-col items-center justify-center min-h-[300px] text-muted-foreground">
        <SearchIconLucide className="mx-auto h-16 w-16 mb-4" />
        <p className="text-xl">请输入搜索词以查找内容。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh_-_8rem)]">
      <div className="flex-shrink-0 pb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          搜索 "<span className="text-primary">{decodeURIComponent(query)}</span>"
        </h1>
        <p className="text-muted-foreground mt-1">
          {isLoading ? '正在搜索中...' : `在 ${searchResultsBySource.length} 个来源中找到 ${totalResultsCount} 条相关内容。`}
        </p>
      </div>

      {isMobile ? (
        <div className="flex flex-col flex-1 mt-2 overflow-hidden">
          {searchResultsBySource.length > 0 && (
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="mb-4 flex justify-between items-center">
                  <span>{activeGroup?.source.name || '选择播放源'}</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[60%] flex flex-col">
                 <SourceList />
              </SheetContent>
            </Sheet>
          )}
          <main ref={resultsContainerRef} className="flex-1 h-full overflow-y-auto">
            {/* Mobile results rendering */}
            {isLoading && searchResultsBySource.length === 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="aspect-video w-full rounded-lg" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : activeGroup ? (
              <div className="grid grid-cols-2 gap-4">
                {activeGroup.items.map(item => (
                  <ContentCard key={`${item.id}-search-${activeGroup.source.id}`} item={item} sourceId={activeGroup.source.id} />
                ))}
              </div>
            ) : (
              !isLoading && totalResultsCount > 0 && (
                <div className="text-center py-12 flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p className="text-lg">请选择一个来源以查看结果。</p>
                </div>
              )
            )}
          </main>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 mt-2 overflow-hidden">
          <aside className="md:col-span-1 h-full flex flex-col backdrop-blur-md rounded-lg shadow-sm bg-card/50">
            <SourceList />
          </aside>
          <main ref={resultsContainerRef} className="md:col-span-3 h-full overflow-y-auto">
            {/* Desktop results rendering */}
            {isLoading && searchResultsBySource.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="aspect-video w-full rounded-lg" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : activeGroup ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {activeGroup.items.map(item => (
                  <ContentCard key={`${item.id}-search-${activeGroup.source.id}`} item={item} sourceId={activeGroup.source.id} />
                ))}
              </div>
            ) : (
              !isLoading && totalResultsCount > 0 && (
                <div className="text-center py-12 flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p className="text-lg">请从左侧选择一个来源以查看结果。</p>
                </div>
              )
            )}
          </main>
        </div>
      )}
      {!isLoading && totalResultsCount === 0 && (
        <div className="text-center py-12 flex flex-col items-center justify-center h-full text-muted-foreground">
          <SearchIconLucide className="mx-auto h-16 w-16 mb-4" />
          <p className="text-xl">未找到与 "{decodeURIComponent(query)}" 相关的内容。</p>
          {sources.length === 0 && (
              <p className="mt-2 text-sm">提示：您尚未配置任何内容源。</p>
          )}
        </div>
      )}
    </div>
  );
}

function SearchPageSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-1/3 mb-4" />
      <Skeleton className="h-5 w-1/4 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        <div className="md:col-span-1 space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="md:col-span-3 space-y-6">
            <Skeleton className="h-7 w-1/4" />
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
