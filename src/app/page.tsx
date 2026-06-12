"use client";

import { useEffect, useMemo, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { ContentCard } from '@/components/content/ContentCard';
import { HeroCarousel } from '@/components/content/HeroCarousel';
import { CategoryNav } from '@/components/layout/CategoryNav';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Search as SearchIconTv, Tv2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCategories } from '@/contexts/CategoryContext';
import { useContentList } from '@/hooks/useContentList';
import { cn } from '@/lib/utils';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

function HomePageContent() {
  const searchParamsHook = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { categories: globalCategories, setPageTitle, activeSourceId, setActiveSourceId, setContentStats } = useCategories();

  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Memoized values from URL search parameters
  const selectedCategoryId = useMemo(() => searchParamsHook.get('category') || 'all', [searchParamsHook]);
  const currentSearchTermQuery = useMemo(() => searchParamsHook.get('q') || '', [searchParamsHook]);

  const categoryName = useMemo(() => globalCategories.find(c => c.id === selectedCategoryId)?.name || (selectedCategoryId === 'all' ? '全部' : '未知分类'), [globalCategories, selectedCategoryId]);

  // Effect to ensure activeSourceId is valid or default
  useEffect(() => {
    if (sources.length > 0) {
      const activeSourceIsValid = sources.find(s => s.id === activeSourceId);
      if (!activeSourceIsValid && sources[0]) {
        setActiveSourceId(sources[0].id);
      }
    }
  }, [sources, activeSourceId, setActiveSourceId]);

  const activeSourceUrl = useMemo(() => {
    if (activeSourceId) {
      const source = sources.find(s => s.id === activeSourceId);
      if (source) return source.url;
    }
    return null;
  }, [sources, activeSourceId]);

  const activeSourceName = useMemo(() => {
    if (!activeSourceId) return null;
    return sources.find(s => s.id === activeSourceId)?.name;
  }, [sources, activeSourceId]);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status
  } = useContentList({
    sourceUrl: activeSourceUrl,
    categoryId: selectedCategoryId,
    searchTerm: currentSearchTermQuery
  });

  const contentItems = useMemo(() => {
    return data?.pages.flatMap(page => page.items) || [];
  }, [data]);

  const lastPage = data?.pages[data.pages.length - 1];
  const totalItems = lastPage?.total || 0;
  const totalPages = lastPage?.pageCount || 1;
  const currentPage = lastPage?.page || 1;

  // Update page title in the header
  useEffect(() => {
    let title = '';
    if (status === 'pending') {
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
    
    return () => setPageTitle('');
  }, [status, sources.length, categoryName, totalItems, setPageTitle, activeSourceName]);

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreTriggerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 1.0 }
    );
    observer.observe(loadMoreTriggerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Update stats
  useEffect(() => {
    if (setContentStats) {
      setContentStats({
        loadedCount: contentItems.length,
        currentPage: currentPage,
        totalPages: totalPages,
        totalItems: totalItems
      });
    }
  }, [contentItems.length, currentPage, totalPages, totalItems, setContentStats]);

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

  const handleCategoryChange = (newCategoryId: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateURLParamsForNav({ 
        category: newCategoryId === 'all' ? null : newCategoryId, 
        page: 1,
        q: null, 
        searchTrigger: null
    });
  };

  if (sources.length === 0 && !activeSourceUrl && status !== 'pending') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center p-4">
        <Tv2 className="w-24 h-24 mb-6 text-muted-foreground" />
        <h2 className="text-2xl font-semibold mb-2 text-foreground">欢迎来到 晚风TV</h2>
        <p className="mb-6 text-muted-foreground max-w-md">请前往“设置”页面添加一个或多个内容源。</p>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/settings">前往设置</Link>
        </Button>
      </div>
    );
  }

  const isLoadingContent = status === 'pending';

  return (
    <div className="flex flex-col w-full min-h-screen pb-20 md:pb-6">
      
      {/* Hero Carousel (Only on first page, default category, no search) - EDGE TO EDGE */}
      {!currentSearchTermQuery && selectedCategoryId === 'all' && contentItems.length > 0 && (
          <HeroCarousel items={contentItems} sourceId={activeSourceId ?? null} />
      )}

      {/* Categories Navigation */}
      {(!currentSearchTermQuery || selectedCategoryId !== 'all') && (
        <div className="pt-6">
          <CategoryNav selectedCategoryId={selectedCategoryId} onCategoryChange={handleCategoryChange} />
        </div>
      )}

      <main className="flex-1 w-full max-w-screen-3xl mx-auto px-4 md:px-8">
        {error && (
           <Alert variant="destructive" className="mb-6">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>加载提示</AlertTitle>
             <AlertDescription>{error.message || "无法加载内容列表。"}</AlertDescription>
           </Alert>
        )}

        <div className="pt-2">
          {isLoadingContent && contentItems.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-3">
                  <Skeleton className="aspect-[3/4] w-full rounded-2xl bg-white/5" />
                  <Skeleton className="h-4 w-4/5 rounded-md bg-white/5" />
                </div>
              ))}
            </div>
          ) : contentItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
              {contentItems.map((item, index) => (
                <ContentCard 
                  key={`${item.id}-${index}`}
                  item={item} 
                  sourceId={activeSourceId ?? undefined}
                />
              ))}
            </div>
          ) : (
            !isLoadingContent && (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground opacity-50">
                <SearchIconTv className="w-16 h-16 mb-4" />
                <p className="text-lg">{currentSearchTermQuery ? `未找到与 "${currentSearchTermQuery}" 相关的结果` : "此分类下暂无内容"}</p>
              </div>
            )
          )}
          
          <div ref={loadMoreTriggerRef} className="flex justify-center items-center py-10">
            {isFetchingNextPage && <Loader2 className="h-8 w-8 animate-spin text-primary/50" />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
