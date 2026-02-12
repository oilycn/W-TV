
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
import { 
  AlertCircle, Search as SearchIconTv, Tv2, Loader2,
  Film, Tv, Palette, Mic, BookOpen, Music, Trophy, Gamepad2,
  Newspaper, GraduationCap, Home, ChefHat, Plane, Rocket,
  Ghost, Laugh, Heart, Zap, Sword, Shield, Baby, DollarSign,
  Stethoscope, Sparkles, Car, Laptop, Smartphone, Camera,
  Headphones, Radio, Monitor, Clapperboard, Theater, Popcorn
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCategories } from '@/contexts/CategoryContext';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

function HomePageContent() {
  const searchParamsHook = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { categories: globalCategories, setPageTitle, activeSourceId, setActiveSourceId, setContentStats } = useCategories();
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
    
    return () => setPageTitle('');
  }, [isLoadingContent, sources.length, categoryName, totalItems, setPageTitle, activeSourceName]);

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

  // Effect to fetch content
  useEffect(() => {
    if (!activeSourceUrl && sources.length > 0) return;
    
    let isCancelled = false;
    
    const loadContent = async () => {
      if (page > totalPages && totalPages > 1 && !isLoadingContent) return;

      if(page === 1) setIsLoadingContent(true);
      else setIsLoadingMore(true);

      try {
        const response = await fetchApiContentList(activeSourceUrl || '', {
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
          setError("无法加载内容列表。");
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
    return () => observer.disconnect();
  }, [isLoadingContent, isLoadingMore, page, totalPages]);

  // Update stats
  useEffect(() => {
    if (setContentStats) {
      setContentStats({
        loadedCount: contentItems.length,
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems
      });
    }
  }, [contentItems.length, page, totalPages, totalItems, setContentStats]);

  const handleCategoryChange = (newCategoryId: string) => {
    setContentItems([]);
    setPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateURLParamsForNav({ 
        category: newCategoryId === 'all' ? null : newCategoryId, 
        page: 1,
        q: null, 
        searchTrigger: null
    });
  };

  if (sources.length === 0 && !activeSourceUrl && !isLoadingContent) {
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

  const isLoadingCategories = globalCategories.length <= 1;

  return (
    <div className="flex flex-col lg:flex-row w-full">
      {/* --- 左侧边栏 - 桌面端固定 --- */}
      <aside className="hidden lg:block fixed left-0 top-14 w-60 h-[calc(100vh-3.5rem)] z-10 p-3 bg-background" suppressHydrationWarning>
        <div className="relative h-full flex flex-col bg-card/40 backdrop-blur-md rounded-2xl border border-border/10 shadow-[inset_0_1px_4px_rgba(255,255,255,0.05),0_8px_16px_-4px_rgba(0,0,0,0.3)] overflow-hidden">
          {/* 装饰光影 - 对称设计 */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 via-transparent to-primary/5"></div>
          
          {/* 分类列表 - 独立滚动 */}
          <div className="flex-1 overflow-y-auto px-2 py-4 scrollbar-none">
             <div className="space-y-1.5 px-1">
               {globalCategories.map((category, index) => {
                  const getIcon = (name: string) => {
                    if (name.includes('电影')) return Film;
                    if (name.includes('剧')) return Tv;
                    if (name.includes('动漫')) return Palette;
                    if (name.includes('综艺')) return Theater;
                    return Popcorn;
                  };
                  const Icon = getIcon(category.name);
                  const isActive = selectedCategoryId === category.id;
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryChange(category.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 relative group overflow-hidden",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground hover:scale-[1.01]"
                      )}
                    >
                      <Icon className={cn("w-4.5 h-4.5 relative z-10 transition-transform duration-300 group-hover:scale-110", isActive && "text-white")} />
                      <span className="truncate relative z-10 font-medium">{category.name}</span>
                      {isActive && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none"></div>}
                    </button>
                  );
               })}
             </div>
          </div>

          {/* 底部统计面板 - 底座化设计 */}
          <div className="mt-auto bg-gradient-to-t from-background/80 to-transparent backdrop-blur-sm p-4 border-t border-white/5">
             <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground/60 font-mono uppercase tracking-widest">
                <div className="bg-white/5 rounded-lg p-2 text-center">
                   <p className="mb-0.5">已加载</p>
                   <span className="text-foreground font-bold">{contentItems.length}</span>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                   <p className="mb-0.5">总数</p>
                   <span className="text-primary font-bold">{totalItems}</span>
                </div>
             </div>
             <div className="mt-2 text-center">
                <p className="text-[9px] text-muted-foreground/40 font-medium">页码: {page} / {totalPages}</p>
             </div>
          </div>
        </div>
      </aside>

      {/* --- 右侧内容区 --- */}
      <main className="flex-1 lg:ml-60 px-4 py-4 md:px-6 md:py-6">
        {error && (
           <Alert variant="destructive" className="mb-6">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>提示</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
           </Alert>
        )}

        {/* 视频网格 - 最多显示 7 列 */}
        <div className="p-1">
          {isLoadingContent && contentItems.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 gap-6 md:gap-8">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-3">
                  <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
                  <Skeleton className="h-4 w-4/5 rounded-md" />
                </div>
              ))}
            </div>
          ) : contentItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 gap-6 md:gap-8">
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
            {isLoadingMore && <Loader2 className="h-8 w-8 animate-spin text-primary/50" />}
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
