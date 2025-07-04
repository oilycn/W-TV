
"use client";

import { useEffect, useState, useMemo, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { ContentItem, SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchApiContentList, getMockPaginatedResponse } from '@/lib/content-loader';
import { ContentCard } from '@/components/content/ContentCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Search as SearchIconTv, Tv2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCategories } from '@/contexts/CategoryContext';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

function HomePageContent() {
  const searchParamsHook = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { categories: globalCategories, setPageTitle, activeSourceId, setActiveSourceId } = useCategories();
  const isMobile = useIsMobile();

  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Memoized values from URL search parameters
  const selectedCategoryId = useMemo(() => searchParamsHook.get('category') || 'all', [searchParamsHook]);
  const activeSourceTrigger = useMemo(() => searchParamsHook.get('activeSourceTrigger'), [searchParamsHook]);
  const currentSearchTermQuery = useMemo(() => searchParamsHook.get('q') || '', [searchParamsHook]);
  const searchTrigger = useMemo(() => searchParamsHook.get('searchTrigger'), [searchParamsHook]);
  
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const categoryName = useMemo(() => globalCategories.find(c => c.id === selectedCategoryId)?.name || (selectedCategoryId === 'all' ? '全部' : '未知分类'), [globalCategories, selectedCategoryId]);

  const activeSourceName = useMemo(() => {
    if (!activeSourceId) return null;
    return sources.find(s => s.id === activeSourceId)?.name;
  }, [sources, activeSourceId]);

  // Update page title in the header
  useEffect(() => {
    let title = '';
    if (isLoadingContent) {
      title = '正在加载...';
    } else if (sources.length === 0) {
      title = '请先设置内容源';
    } else {
      const sourcePart = activeSourceName ? `${activeSourceName} - ` : '';
      const categoryPart = categoryName;
      const countPart = totalItems > 0 ? ` · ${totalItems} 部` : '';
      title = `${sourcePart}${categoryPart}${countPart}`;
    }
    setPageTitle(title);
    
    // Cleanup on unmount
    return () => setPageTitle('');
  }, [isLoadingContent, sources.length, categoryName, totalItems, setPageTitle, activeSourceName]);


  // Effect to synchronize activeSourceId from URL trigger
  useEffect(() => {
    if (activeSourceTrigger && activeSourceTrigger !== activeSourceId) {
      setActiveSourceId(activeSourceTrigger);
    }
  }, [activeSourceTrigger, activeSourceId, setActiveSourceId]);

  // Effect to ensure activeSourceId is valid or default
  useEffect(() => {
    if (sources.length > 0) {
      const activeSourceIsValid = sources.find(s => s.id === activeSourceId);
      if (!activeSourceIsValid && sources[0]) {
        setActiveSourceId(sources[0].id);
      }
    } else if (sources.length === 0 && activeSourceId) {
      setActiveSourceId(null);
    }
  }, [sources, activeSourceId, setActiveSourceId]);

  // Memoized activeSourceUrl based on synchronized activeSourceId and sources
  const activeSourceUrl = useMemo(() => {
    if (activeSourceId) {
      const source = sources.find(s => s.id === activeSourceId);
      if (source) return source.url;
    }
    if (sources.length > 0 && sources[0]) {
      return sources[0].url; // Fallback
    }
    return null;
  }, [sources, activeSourceId]);

  const updateURLParamsForNav = useCallback((newParams: Record<string, string | number | undefined | null>) => {
    const currentParams = new URLSearchParams(searchParamsHook.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      const stringValue = value === null || value === undefined ? '' : String(value);
      if (stringValue === '' || (key === 'page' && value === 1) || (key === 'category' && value === 'all')) {
        currentParams.delete(key);
      } else {
        currentParams.set(key, stringValue);
      }
    });
    router.push(`${pathname}?${currentParams.toString()}`, { scroll: false });
  }, [router, searchParamsHook, pathname]);

  // Effect to reset content on context change
  useEffect(() => {
    if (mainContentRef.current) {
        mainContentRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
    setContentItems([]);
    setPage(1);
    setIsLoadingContent(true);
  }, [activeSourceUrl, selectedCategoryId, currentSearchTermQuery, searchTrigger, sources.length]);

  // Effect for fetching content (initial and subsequent)
  useEffect(() => {
    if (!activeSourceUrl && sources.length > 0) {
      setIsLoadingContent(true);
      return;
    }
    
    let isCancelled = false;
    
    const loadContent = async () => {
      if (page > totalPages && totalPages > 1 && !isLoadingContent) return;

      if(page === 1) setIsLoadingContent(true);
      else setIsLoadingMore(true);

      try {
        const response = await fetchApiContentList(activeSourceUrl, {
          page: page,
          categoryId: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
          searchTerm: currentSearchTermQuery || undefined,
        });

        if (!isCancelled) {
          setTotalPages(response.pageCount || 1);
          setTotalItems(response.total);
          setContentItems(prev => page === 1 ? response.items : [...prev, ...response.items]);
        }
      } catch (e) {
        if (!isCancelled) {
          setError(prev => (prev ? `${prev} & 无法加载内容列表。` : "无法加载内容列表。"));
          const mockResponse = getMockPaginatedResponse(page, selectedCategoryId, currentSearchTermQuery);
          setContentItems(prev => page === 1 ? mockResponse.items : [...prev, ...mockResponse.items]);
          setTotalPages(mockResponse.pageCount || 1);
          setTotalItems(mockResponse.total);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingContent(false);
          setIsLoadingMore(false);
        }
      }
    };
    
    loadContent();

    return () => { isCancelled = true; };
  }, [page, activeSourceUrl, selectedCategoryId, currentSearchTermQuery, searchTrigger, sources.length]);


  // Infinite scroll
  useEffect(() => {
    if (!loadMoreTriggerRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingContent && !isLoadingMore && page < totalPages) {
          setPage(prevPage => prevPage + 1);
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(loadMoreTriggerRef.current);
    
    return () => {
      if (loadMoreTriggerRef.current) {
        observer.unobserve(loadMoreTriggerRef.current);
      }
    };
  }, [isLoadingContent, isLoadingMore, page, totalPages]);


  const handleCategoryChange = (newCategoryId: string) => {
    updateURLParamsForNav({ 
        category: newCategoryId === 'all' ? null : newCategoryId, 
        page: 1,
        q: null, 
        searchTrigger: null
    });
  };

  if (sources.length === 0 && !activeSourceUrl && !isLoadingContent ) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center p-4">
        <Tv2 className="w-24 h-24 mb-6 text-muted-foreground" />
        <h2 className="text-2xl font-semibold mb-2 text-foreground">欢迎来到 晚风TV</h2>
        <p className="mb-6 text-muted-foreground max-w-md">
          您还没有配置任何内容源。请前往“设置”页面添加一个或多个内容源，以便开始浏览和发现精彩内容。
        </p>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/settings">前往设置</Link>
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">（当前可能显示示例分类和数据）</p>
      </div>
    );
  }

  const isLoadingCategories = globalCategories.length <= 1;

  return (
    <div className="space-y-4" ref={mainContentRef}>
      {error && (
         <Alert variant="destructive" className="mb-4">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>加载错误</AlertTitle>
           <AlertDescription>{error} 部分数据可能来自模拟源。</AlertDescription>
         </Alert>
      )}
      
      {isLoadingCategories && !isMobile && (
        <div className="bg-card p-3 rounded-md shadow-sm hidden md:block">
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      {(!isLoadingCategories && globalCategories.length > 0 && !isMobile) && (
        <ScrollArea className="w-full whitespace-nowrap rounded-md border shadow-sm bg-card hidden md:block">
          <div className="flex space-x-2 p-3">
            {globalCategories.map(category => (
              <Button
                key={`${activeSourceUrl || 'mock'}-${category.id}`}
                variant={selectedCategoryId === category.id ? "default" : "outline"}
                onClick={() => handleCategoryChange(category.id)}
                className="relative whitespace-nowrap text-sm h-9 px-4"
                size="sm"
              >
                {category.name}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      {isLoadingContent && contentItems.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : contentItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
          {contentItems.map((item, index) => (
            <ContentCard key={`${item.id}-${activeSourceUrl || 'mock'}-${item.title}-${index}`} item={item} sourceId={activeSourceId ?? undefined} />
          ))}
        </div>
      ) : (
        !isLoadingContent && (
            <div className="text-center py-12 flex flex-col items-center justify-center min-h-[300px]">
                <SearchIconTv className="w-16 h-16 mb-4 text-muted-foreground" />
                <p className="text-xl text-muted-foreground">
                  {currentSearchTermQuery ? `未找到与 "${currentSearchTermQuery}" 相关的内容。` : "此分类下暂无内容。"}
                </p>
                { !activeSourceUrl && sources.length > 0 && ( 
                    <p className="mt-2 text-sm text-muted-foreground">内容源可能正在加载或选择中，请稍候。</p>
                )}
            </div>
        )
      )}
      
      <div ref={loadMoreTriggerRef} className="flex justify-center items-center p-4">
        {isLoadingMore && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-card p-3 rounded-md shadow-sm hidden md:block">
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
