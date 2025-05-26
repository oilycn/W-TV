"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import type { ContentItem, SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchAllContent, getMockContentItems } from '@/lib/content-loader';
import { ContentCard } from '@/components/content/ContentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, SearchIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [filteredContent, setFilteredContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContent() {
      setIsLoading(true);
      setError(null);
      try {
        const items = await fetchAllContent(sources);
        setAllContent(items);
      } catch (e) {
        console.error("Failed to load content for search:", e);
        setError("无法加载内容。请检查您的网络连接或内容源配置。");
        setAllContent(getMockContentItems()); // Fallback to mock
      }
    }
    loadContent();
  }, [sources]);

  useEffect(() => {
    if (allContent.length > 0) {
      if (query) {
        const lowerCaseQuery = query.toLowerCase();
        const results = allContent.filter(item =>
          item.title.toLowerCase().includes(lowerCaseQuery) ||
          (item.description && item.description.toLowerCase().includes(lowerCaseQuery)) ||
          (item.genres && item.genres.some(genre => genre.toLowerCase().includes(lowerCaseQuery))) ||
          (item.cast && item.cast.some(actor => actor.toLowerCase().includes(lowerCaseQuery)))
        );
        setFilteredContent(results);
      } else {
        setFilteredContent([]); // No query, no results displayed on search page
      }
      setIsLoading(false);
    } else if (!isLoading) { // allContent is empty and not loading
        setIsLoading(false); 
        setFilteredContent([]);
    }
  }, [query, allContent, isLoading]);


  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-[300px] w-full rounded-lg" />
            <Skeleton className="h-6 w-3/4" />
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
        <AlertTitle>加载错误</AlertTitle>
        <AlertDescription>{error} 搜索功能可能受到影响。</AlertDescription>
      </Alert>
    );
  }

  if (!query) {
    return (
      <div className="text-center py-12">
        <SearchIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-xl text-muted-foreground">请输入搜索词以查找内容。</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6 text-foreground">
        搜索结果 "{decodeURIComponent(query)}"
      </h1>
      {filteredContent.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredContent.map(item => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-muted-foreground">未找到与 "{decodeURIComponent(query)}" 相关的内容。</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <SearchResults />
    </Suspense>
  );
}
