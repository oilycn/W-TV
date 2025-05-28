
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback } from 'react';
import type { ContentItem, SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchApiContentList } from '@/lib/content-loader';
import { ContentCard } from '@/components/content/ContentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, SearchIcon as SearchIconLucide } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  const loadSearchResults = useCallback(async (currentQuery: string, currentSources: SourceConfig[]) => {
    if (!currentQuery) {
      setSearchResultsBySource([]);
      setTotalResultsCount(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSearchResultsBySource([]);
    setTotalResultsCount(0);

    try {
      const results: SearchResultGroup[] = [];
      let currentTotal = 0;

      for (const source of currentSources) {
        console.log(`Search: Fetching from source ${source.name} for query "${currentQuery}"`);
        try {
          const response = await fetchApiContentList(source.url, { searchTerm: currentQuery });
          if (response.items && response.items.length > 0) {
            results.push({ source, items: response.items });
            currentTotal += response.items.length;
            console.log(`Search: Found ${response.items.length} items from ${source.name}`);
          } else {
            console.log(`Search: No items found from ${source.name} for query "${currentQuery}"`);
          }
        } catch (e) {
          console.warn(`Search: Error fetching from source ${source.name} for query "${currentQuery}":`, e);
          // Optionally, you could add an error entry per source:
          // results.push({ source, items: [], error: (e instanceof Error ? e.message : String(e)) });
        }
      }
      
      setSearchResultsBySource(results);
      setTotalResultsCount(currentTotal);

      if (currentTotal === 0 && currentSources.length > 0) {
        // No results from any source
      }

    } catch (e) {
      console.error("Search: Unexpected error during search aggregation:", e);
      setError("搜索时发生意外错误。");
    } finally {
      setIsLoading(false);
    }
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


  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-1/3 mb-6" />
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <div key={`skeleton-group-${groupIndex}`} className="space-y-4">
            <Skeleton className="h-7 w-1/4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-4 md:gap-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  
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

      {searchResultsBySource.length > 0 ? (
        <div className="space-y-10">
          {searchResultsBySource.map(group => (
            group.items.length > 0 && (
              <section key={group.source.id} className="bg-card p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold mb-1 text-foreground">
                  来自: {group.source.name}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  找到 {group.items.length} 条结果
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-4 md:gap-6">
                  {group.items.map(item => (
                    <ContentCard key={`${item.id}-search-${group.source.id}`} item={item} />
                  ))}
                </div>
              </section>
            )
          ))}
        </div>
      ) : (
        <div className="text-center py-12 flex flex-col items-center justify-center min-h-[300px] text-muted-foreground">
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

export default function SearchPage() {
  return (
    <Suspense fallback={
        <div className="space-y-8">
            <Skeleton className="h-8 w-1/3 mb-6" />
            {Array.from({ length: 2 }).map((_, groupIndex) => (
              <div key={`skeleton-group-fallback-${groupIndex}`} className="bg-card p-4 sm:p-6 rounded-lg shadow-md space-y-4">
                <Skeleton className="h-7 w-1/4" />
                <Skeleton className="h-5 w-1/5" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-4 md:gap-6">
                    {Array.from({ length: 5 }).map((_, index) => (
                    <div key={`skeleton-item-fallback-${index}`} className="space-y-2">
                        <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
    }>
      <SearchResults />
    </Suspense>
  );
}
    
