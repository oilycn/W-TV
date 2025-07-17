
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
  const [isClient, setIsClient] = useState(false);

  const categoryName = useMemo(() => globalCategories.find(c => c.id === selectedCategoryId)?.name || (selectedCategoryId === 'all' ? '全部' : '未知分类'), [globalCategories, selectedCategoryId]);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
    // 切换分类时清空当前内容并重置页面
    setContentItems([]);
    setPage(1);
    
    // 滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
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
      {/* 主要内容区域 - 左侧边栏 + 右侧内容 */}
      <div className="flex gap-6">
        {/* 左侧边栏 - 固定在页面左侧 */}
        {isClient && !isMobile && (
          <div className="hidden lg:block fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] bg-background border-r border-transparent z-10">
            <div className="h-full flex flex-col">
              {/* 分类导航 - 可滚动区域 */}
              {(!isLoadingCategories && globalCategories.length > 0) && (
                <div className="flex-1 overflow-y-auto p-4" style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}>
                  <style jsx>{`
                    div::-webkit-scrollbar {
                      display: none;
                    }
                  `}</style>
                  <div className="space-y-1">
                    {globalCategories.map(category => (
                      <button
                        key={`${activeSourceUrl || 'mock'}-${category.id}`}
                        onClick={() => handleCategoryChange(category.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                          selectedCategoryId === category.id 
                            ? 'bg-primary text-primary-foreground font-medium' 
                            : 'text-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 底部固定信息区域 */}
              <div className="flex-shrink-0 border-t border-border/20 bg-background">
                {/* 统计信息 */}
                {contentItems.length > 0 && (
                  <div className="px-4 py-3">
                    <h3 className="text-sm font-medium text-foreground mb-2">统计信息</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">已加载</span>
                        <span className="font-medium">{contentItems.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">页码</span>
                        <span className="font-medium">{page}/{totalPages}</span>
                      </div>
                      {totalItems > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">总计</span>
                          <span className="font-medium text-primary">{totalItems}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 当前源信息 */}
                {activeSourceName && (
                  <div className="px-4 pb-4">
                    <div className={contentItems.length > 0 ? "border-t border-border/20 pt-3" : ""}>
                      <h3 className="text-sm font-medium text-foreground mb-2">当前源</h3>
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{activeSourceName}</div>
                          <div className="text-xs text-muted-foreground">正在使用</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 右侧主内容区域 */}
        <div className={`flex-1 min-w-0 ${isClient && !isMobile ? 'lg:ml-64' : ''}`}>
          {/* 移动端分类导航 */}
          {(!isLoadingCategories && globalCategories.length > 0 && isMobile) && (
            <div className="mb-3 lg:hidden">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex space-x-1 border-b border-transparent">
                  {globalCategories.map(category => (
                    <Button
                      key={`${activeSourceUrl || 'mock'}-${category.id}`}
                      variant="ghost"
                      onClick={() => handleCategoryChange(category.id)}
                      className={`relative whitespace-nowrap text-sm h-10 px-4 rounded-none border-b-2 transition-all duration-200 ${
                        selectedCategoryId === category.id 
                          ? 'border-primary text-primary bg-primary/5 font-medium' 
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="h-1" />
              </ScrollArea>
            </div>
          )}

          {/* 内容网格 */}
          <div className="p-1 md:p-2">
            {isLoadingContent && contentItems.length === 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 md:gap-3">
                {Array.from({ length: 18 }).map((_, index) => (
                  <div key={index} className="animate-pulse">
                    <Skeleton className="aspect-[3/4] w-full rounded-lg" />
                  </div>
                ))}
              </div>
            ) : contentItems.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 md:gap-3" ref={mainContentRef}>
                {contentItems.map((item, index) => (
                  <ContentCard 
                    key={`${item.id}-${activeSourceUrl || 'mock'}-${item.title}-${index}`}
                    item={item} 
                    sourceId={activeSourceId ?? undefined}
                  />
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
        </div>
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
    <div className="flex gap-6">
      {/* 左侧边栏骨架 */}
      <div className="hidden lg:block fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] bg-background border-r border-transparent z-10">
        <div className="h-full flex flex-col">
          <div className="flex-1 p-4">
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 border-t border-border/20 bg-background p-4">
            <Skeleton className="h-4 w-16 mb-2" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 右侧内容骨架 */}
      <div className="flex-1 min-w-0 lg:ml-64">
        {/* 移动端分类骨架 */}
        <div className="mb-3 lg:hidden">
          <div className="flex space-x-1 border-b border-transparent">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-16 rounded-none" />
            ))}
          </div>
        </div>
        
        {/* 内容网格骨架 */}
        <div className="p-1 md:p-2">
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 md:gap-3">
            {Array.from({ length: 18 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <Skeleton className="aspect-[3/4] w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
