
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback } from 'react';
import type { ContentItem, SourceConfig, PaginatedContentResponse } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchApiContentList, getMockContentItems } from '@/lib/content-loader';
import { ContentCard } from '@/components/content/ContentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, SearchIcon as SearchIconLucide } from 'lucide-react'; // Renamed to avoid conflict if any
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [aggregatedContent, setAggregatedContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSearchResults = useCallback(async (currentQuery: string, currentSources: SourceConfig[]) => {
    if (!currentQuery) {
      setAggregatedContent([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAggregatedContent([]);

    try {
      const allFetchPromises = currentSources.map(source =>
        fetchApiContentList(source.url, { searchTerm: currentQuery })
          .then(response => response.items) // We only need items for aggregation here
          .catch(e => {
            console.warn(`Search: Error fetching from source ${source.name} for query "${currentQuery}":`, e);
            return []; // Return empty array for this source on error
          })
      );

      const resultsFromAllSources = await Promise.all(allFetchPromises);
      const combinedContent = resultsFromAllSources.flat();

      // Deduplicate items by ID
      const uniqueContentMap = new Map<string, ContentItem>();
      combinedContent.forEach(item => {
        if (!uniqueContentMap.has(item.id)) {
          uniqueContentMap.set(item.id, item);
        }
      });
      const uniqueContentArray = Array.from(uniqueContentMap.values());
      
      setAggregatedContent(uniqueContentArray);

      if (uniqueContentArray.length === 0 && currentSources.length > 0) {
        // Optionally, set a specific "no results from any source" message
        // setError("所有配置源均未找到相关内容。"); 
      }

    } catch (e) {
      console.error("Search: Unexpected error during search aggregation:", e);
      setError("搜索时发生意外错误。");
      setAggregatedContent(getMockContentItems()); // Fallback to mock on critical error during aggregation
    } finally {
      setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    // Trigger search when query or sources change
    if (sources.length > 0 || !query) { // No need to search if sources are empty and there's a query
        loadSearchResults(query, sources);
    } else if (query && sources.length === 0) {
        setIsLoading(false);
        setError("请先配置内容源后再进行搜索。");
        setAggregatedContent([]);
    }
  }, [query, sources, loadSearchResults]);


  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-4 md:gap-6">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="aspect-[2/3] w-full rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
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
      <div className="text-center py-12 flex flex-col items-center justify-center min-h-[300px]">
        <SearchIconLucide className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-xl text-muted-foreground">请输入搜索词以查找内容。</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6 text-foreground">
        搜索结果 "{decodeURIComponent(query)}"
      </h1>
      {aggregatedContent.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-4 md:gap-6">
          {aggregatedContent.map(item => (
            <ContentCard key={`${item.id}-search`} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 flex flex-col items-center justify-center min-h-[300px]">
            <SearchIconLucide className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">未找到与 "{decodeURIComponent(query)}" 相关的内容。</p>
             {sources.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">提示：您尚未配置任何内容源。</p>
            )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
        <div className="space-y-6">
            <Skeleton className="h-8 w-1/3 mb-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-4 md:gap-6">
                {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="space-y-2">
                    <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
                ))}
            </div>
        </div>
    }>
      <SearchResults />
    </Suspense>
  );
}

