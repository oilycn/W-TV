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
import { AlertCircle, Search as SearchIconTv, Tv2, Loader2, PlusCircle, Settings2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCategories } from '@/contexts/CategoryContext';
import { useContentList } from '@/hooks/useContentList';

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

  if (sources.length === 0 && !activeSourceUrl) {
    return (
      <div className="flex min-h-[calc(100vh-9rem)] w-full items-center justify-center px-4 pb-20 pt-8 md:pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-sm">
            <Tv2 className="h-10 w-10 text-foreground" />
          </div>
          <h1 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">欢迎来到晚风TV</h1>
          <p className="mb-8 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
            添加一个内容源后，就可以开始浏览分类、搜索片名和继续观看历史。
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 rounded-full px-6">
              <Link href="/settings">
                <PlusCircle className="h-4 w-4" />
                添加内容源
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6">
              <Link href="/settings">
                <Settings2 className="h-4 w-4" />
                打开设置
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isLoadingContent = status === 'pending';
  const showCategoryNav = (!currentSearchTermQuery || selectedCategoryId !== 'all') && globalCategories.length > 0;

  return (
    <div className="flex min-h-screen w-full flex-col pb-20 md:pb-6">
      
      {/* Hero Carousel (Only on first page, default category, no search) - EDGE TO EDGE */}
      {!currentSearchTermQuery && selectedCategoryId === 'all' && contentItems.length > 0 && (
          <HeroCarousel items={contentItems} sourceId={activeSourceId ?? null} />
      )}

      {showCategoryNav && (
        <div className="pt-5 md:hidden">
          <CategoryNav selectedCategoryId={selectedCategoryId} onCategoryChange={handleCategoryChange} />
        </div>
      )}

      <main className="mx-auto w-full max-w-screen-3xl flex-1 px-4 pt-2 md:px-8 md:pt-4">
        <section className="min-w-0">
          {error && (
             <Alert variant="destructive" className="mb-6">
               <AlertCircle className="h-4 w-4" />
               <AlertTitle>加载提示</AlertTitle>
               <AlertDescription>{error.message || "无法加载内容列表。"}</AlertDescription>
             </Alert>
          )}

          {contentItems.length > 0 && (
            <div className="mb-5 flex flex-col justify-between gap-4 border-b border-border/70 pb-5 md:flex-row md:items-end">
              <div className="min-w-0">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {activeSourceName || '当前内容源'}
                </p>
                <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                  {currentSearchTermQuery ? '搜索结果' : categoryName}
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm sm:flex sm:flex-wrap">
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">已加载</p>
                  <p className="font-semibold text-foreground">{contentItems.length}</p>
                </div>
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">总量</p>
                  <p className="font-semibold text-foreground">{totalItems || '-'}</p>
                </div>
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">页码</p>
                  <p className="font-semibold text-foreground">{currentPage}/{totalPages}</p>
                </div>
              </div>
            </div>
          )}

          {isLoadingContent && contentItems.length === 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[2/3] w-full rounded-lg bg-muted" />
                  <Skeleton className="h-4 w-4/5 rounded-md bg-muted" />
                  <Skeleton className="h-3 w-2/5 rounded-md bg-muted" />
                </div>
              ))}
            </div>
          ) : contentItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8">
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
              <div className="flex min-h-[440px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-border/70 bg-background shadow-sm">
                  <SearchIconTv className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="mb-2 text-2xl font-semibold text-foreground">
                  {currentSearchTermQuery ? '没有找到相关内容' : '此分类暂无内容'}
                </h2>
                <p className="max-w-md text-muted-foreground">
                  {currentSearchTermQuery ? `未找到与 "${currentSearchTermQuery}" 相关的结果。` : '可以切换分类或尝试其他内容源。'}
                </p>
              </div>
            )
          )}
          
          <div ref={loadMoreTriggerRef} className="flex justify-center items-center py-10">
            {isFetchingNextPage && <Loader2 className="h-8 w-8 animate-spin text-primary/50" />}
          </div>
        </section>
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
