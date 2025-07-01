
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback } from 'react';
import type { ContentItem, SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchApiContentList } from '@/lib/content-loader';
import { ContentCard } from '@/components/content/ContentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2, SearchIcon as SearchIconLucide } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

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

  // New state for the selected source in the sidebar
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

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

    for (const source of currentSources) {
      try {
        const response = await fetchApiContentList(source.url, { searchTerm: currentQuery });
        if (response.items && response.items.length > 0) {
          setSearchResultsBySource(prevResults => {
            const newResults = [...prevResults, { source, items: response.items }];
            // If this is the first group of results, select it automatically
            if (prevResults.length === 0) {
              setSelectedSourceId(source.id);
            }
            return newResults;
          });
          setTotalResultsCount(prevCount => prevCount + response.items.length);
        }
      } catch (e) {
        console.warn(`Search: Error fetching from source ${source.name} for query "${currentQuery}":`, e);
      }
    }
    
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
    <div>
      <h1 className="text-3xl font-bold mb-2 text-foreground">
        搜索 "<span className="text-primary">{decodeURIComponent(query)}</span>" 的结果
      </h1>
      <p className="text-muted-foreground mb-8">共找到 {totalResultsCount} 条相关内容。</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* Left Column: Source List */}
        <div className="md:col-span-1 sticky top-20">
          <h2 className="text-lg font-semibold mb-4 text-foreground">内容来源</h2>
          <div className="flex flex-col space-y-2">
            {searchResultsBySource.map(group => (
              <Button
                key={group.source.id}
                variant={selectedSourceId === group.source.id ? "default" : "ghost"}
                onClick={() => setSelectedSourceId(group.source.id)}
                className="justify-start w-full"
              >
                {group.source.name} ({group.items.length})
              </Button>
            ))}
          </div>
          {isLoading && (
            <div className="flex items-center justify-start py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">搜索中...</p>
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="md:col-span-3">
          {isLoading && searchResultsBySource.length === 0 && (
            // Initial loading skeleton for the right panel
            <div className="space-y-4">
              <Skeleton className="h-7 w-1/4" />
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeGroup && (
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">
                来自: {activeGroup.source.name}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {activeGroup.items.map(item => (
                  <ContentCard key={`${item.id}-search-${activeGroup.source.id}`} item={item} />
                ))}
              </div>
            </section>
          )}

          {!isLoading && totalResultsCount === 0 && (
            <div className="text-center py-12 flex flex-col items-center justify-center min-h-[300px] text-muted-foreground">
              <SearchIconLucide className="mx-auto h-16 w-16 mb-4" />
              <p className="text-xl">未找到与 "{decodeURIComponent(query)}" 相关的内容。</p>
              {sources.length === 0 && (
                  <p className="mt-2 text-sm">提示：您尚未配置任何内容源。</p>
              )}
            </div>
          )}
        </div>
      </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
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
