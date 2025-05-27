
"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { ContentItem, SourceConfig, ApiCategory, PaginatedContentResponse } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchApiCategories, fetchApiContentList, getMockApiCategories, getMockPaginatedResponse } from '@/lib/content-loader';
import { ContentCard } from '@/components/content/ContentCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ChevronLeft, ChevronRight, Search as SearchIcon, Tv2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCategories } from '@/contexts/CategoryContext';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';

function HomePageContent() {
  const searchParamsHook = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { categories: globalCategories, setCategories: setGlobalCategories } = useCategories();

  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [activeSourceId, setActiveSourceId] = useLocalStorage<string | null>(LOCAL_STORAGE_KEY_ACTIVE_SOURCE, null);
  
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoized values from URL search parameters
  const selectedCategoryId = useMemo(() => searchParamsHook.get('category') || 'all', [searchParamsHook]);
  const currentSearchTermQuery = useMemo(() => searchParamsHook.get('q') || '', [searchParamsHook]);
  const currentPageQuery = useMemo(() => parseInt(searchParamsHook.get('page') || '1', 10), [searchParamsHook]);
  const activeSourceTrigger = useMemo(() => searchParamsHook.get('activeSourceTrigger'), [searchParamsHook]);
  const searchTrigger = useMemo(() => searchParamsHook.get('searchTrigger'), [searchParamsHook]);
  
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Effect to synchronize activeSourceId from URL trigger
  useEffect(() => {
    if (activeSourceTrigger && activeSourceTrigger !== activeSourceId) {
      console.log(`HomePageContent: (Effect: Sync activeSourceId from URL) Trigger: ${activeSourceTrigger}, Current ID: ${activeSourceId}. Updating activeSourceId.`);
      setActiveSourceId(activeSourceTrigger);
    }
  }, [activeSourceTrigger, activeSourceId, setActiveSourceId]);

  // Effect to ensure activeSourceId is valid or default
  useEffect(() => {
    if (sources.length > 0) {
      const activeSourceIsValid = sources.find(s => s.id === activeSourceId);
      if (!activeSourceIsValid && sources[0]) {
        console.log(`HomePageContent: (Effect: Validate activeSourceId) Invalid or no activeSourceId (${activeSourceId}), defaulting to first source: ${sources[0].id}.`);
        setActiveSourceId(sources[0].id);
      }
    } else if (sources.length === 0 && activeSourceId) {
      console.log("HomePageContent: (Effect: Validate activeSourceId) No sources available, clearing activeSourceId.");
      setActiveSourceId(null);
    }
  }, [sources, activeSourceId, setActiveSourceId]);

  // Memoized activeSourceUrl based on synchronized activeSourceId and sources
  const activeSourceUrl = useMemo(() => {
    if (activeSourceId) {
      const source = sources.find(s => s.id === activeSourceId);
      if (source) {
        console.log(`HomePageContent: (Memo: activeSourceUrl) Derived from activeSourceId (${activeSourceId}): ${source.url}`);
        return source.url;
      }
    }
    if (sources.length > 0 && sources[0]) {
      console.warn(`HomePageContent: (Memo: activeSourceUrl) Using fallback (first source: ${sources[0].url}) as activeSourceId (${activeSourceId}) is invalid or not yet synced.`);
      return sources[0].url; // Fallback if activeSourceId is somehow invalid but sources exist
    }
    console.log(`HomePageContent: (Memo: activeSourceUrl) is null (no sources or no valid activeSourceId).`);
    return null;
  }, [sources, activeSourceId]);


  // Helper to update URL parameters
  const updateURLParams = useCallback((newParams: Record<string, string | number | undefined | null>) => {
    const currentParams = new URLSearchParams(searchParamsHook.toString());
    let changed = false;

    Object.entries(newParams).forEach(([key, value]) => {
      const stringValue = value === null || value === undefined ? '' : String(value);
      if (stringValue === '' || (key === 'page' && value === 1) || (key === 'category' && value === 'all')) {
        if (currentParams.has(key)) {
          currentParams.delete(key);
          changed = true;
        }
      } else {
        if (currentParams.get(key) !== stringValue) {
          currentParams.set(key, stringValue);
          changed = true;
        }
      }
    });
  
    // Ensure triggers are not lost if they were the only change source initially
    ['activeSourceTrigger', 'searchTrigger'].forEach(triggerKey => {
        if (searchParamsHook.has(triggerKey) && !Object.prototype.hasOwnProperty.call(newParams, triggerKey)) {
            if(!currentParams.has(triggerKey) && searchParamsHook.get(triggerKey)) {
                 currentParams.set(triggerKey, searchParamsHook.get(triggerKey)!);
            }
        }
    });

    const newQueryString = currentParams.toString();
    if (changed || (pathname + (newQueryString ? `?${newQueryString}` : '')) !== (pathname + (searchParamsHook.toString() ? `?${searchParamsHook.toString()}` : ''))) {
        console.log(`HomePageContent: updateURLParams pushing to: ${pathname}?${newQueryString}`);
        router.push(`${pathname}?${newQueryString}`, { scroll: false });
    }
  }, [router, searchParamsHook, pathname]);


  // Effect for fetching/setting categories
  useEffect(() => {
    if (activeSourceUrl) {
      console.log(`HomePageContent: (Effect: Categories) Valid activeSourceUrl: ${activeSourceUrl}. Fetching.`);
      setIsLoadingCategories(true);
      // setError(null); // Intentionally not clearing general error here
      fetchApiCategories(activeSourceUrl)
        .then(fetchedCategories => {
          setGlobalCategories(fetchedCategories);
          console.log(`HomePageContent: (Effect: Categories) Categories set for ${activeSourceUrl}:`, fetchedCategories.length);
        })
        .catch(e => {
          console.error(`HomePageContent: (Effect: Categories) Failed for ${activeSourceUrl}:`, e);
          setError(prev => (prev ? `${prev} & 无法加载分类。` : "无法加载分类。"));
          setGlobalCategories(getMockApiCategories()); // Fallback on error
        })
        .finally(() => {
          setIsLoadingCategories(false);
        });
    } else { // activeSourceUrl is null
      if (sources.length === 0) {
        // No sources configured, use mock data
        console.log("HomePageContent: (Effect: Categories) No sources configured. Using mock categories.");
        setIsLoadingCategories(true); // To show skeleton briefly
        setGlobalCategories(getMockApiCategories());
        setIsLoadingCategories(false);
      } else {
        // Sources exist, but activeSourceUrl is null (e.g., activeSourceId is invalid or being initialized).
        // Don't fetch, don't clear categories. Just show loading until activeSourceUrl is valid.
        console.log("HomePageContent: (Effect: Categories) activeSourceUrl is null, but sources exist. Setting isLoadingCategories=true.");
        setIsLoadingCategories(true); 
        // Do NOT setGlobalCategories([]) here, as it might wipe previously fetched ones
        // if activeSourceUrl flickers. The other useEffects should eventually set a valid activeSourceUrl.
      }
    }
  }, [activeSourceUrl, setGlobalCategories, sources.length]);


  // Effect for fetching content list
  useEffect(() => {
    // This effect depends on activeSourceUrl being correctly set by other effects/memos
    if (activeSourceUrl) {
      console.log(`HomePageContent: (Effect: Content) Fetching for source: ${activeSourceUrl}, category: ${selectedCategoryId}, page: ${currentPageQuery}, search: "${currentSearchTermQuery}"`);
      setIsLoadingContent(true);
      // Don't clear global error here, let category errors persist if they occurred
      setContentItems([]); 

      fetchApiContentList(activeSourceUrl, {
        page: currentPageQuery,
        categoryId: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
        searchTerm: currentSearchTermQuery || undefined,
      })
        .then(response => {
          setContentItems(response.items);
          setTotalPages(response.pageCount || 1);
          setTotalItems(response.total);
          console.log(`HomePageContent: (Effect: Content) Content fetched for ${activeSourceUrl}:`, response.items.length, `Total: ${response.total}`);
        })
        .catch(e => {
          console.error(`HomePageContent: (Effect: Content) Failed to load content from ${activeSourceUrl}:`, e);
          if (e instanceof Error && e.message.includes("暂不支持搜索")) {
            console.warn(`HomePageContent: (Effect: Content) API Search Not Supported: ${activeSourceUrl}. Message: ${e.message}`);
             setError(prev => (prev ? `${prev} & 此源不支持搜索。` : "此源不支持搜索。"));
          } else {
            setError(prev => (prev ? `${prev} & 无法加载内容列表。` : "无法加载内容列表。"));
          }
          const mockResponse = getMockPaginatedResponse(currentPageQuery, selectedCategoryId, currentSearchTermQuery);
          setContentItems(mockResponse.items);
          setTotalPages(mockResponse.pageCount || 1);
          setTotalItems(mockResponse.total);
        })
        .finally(() => {
          setIsLoadingContent(false);
        });
    } else if (sources.length === 0) { // No sources, use mock content
      console.log("HomePageContent: (Effect: Content) No sources, using mock content.");
      setIsLoadingContent(true);
      const mockResponse = getMockPaginatedResponse(currentPageQuery, selectedCategoryId, currentSearchTermQuery);
      setContentItems(mockResponse.items);
      setTotalPages(mockResponse.pageCount || 1);
      setTotalItems(mockResponse.total);
      setIsLoadingContent(false);
    } else {
        // activeSourceUrl is null but sources exist. Content loading should wait.
        console.log("HomePageContent: (Effect: Content) activeSourceUrl is null, but sources exist. Setting isLoadingContent=true.");
        setIsLoadingContent(true);
    }
  // searchTrigger included to ensure re-fetch on new search even if other params are same
  }, [activeSourceUrl, currentPageQuery, selectedCategoryId, currentSearchTermQuery, sources.length, searchTrigger]);


  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      updateURLParams({ 
        page: newPage, 
        category: selectedCategoryId === 'all' ? null : selectedCategoryId, 
        q: currentSearchTermQuery || null 
      });
    }
  };

  if (sources.length === 0 && !activeSourceUrl && !isLoadingCategories && !isLoadingContent ) {
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

  return (
    <div className="space-y-6">
      {error && (
         <Alert variant="destructive" className="mb-6">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>加载错误</AlertTitle>
           <AlertDescription>{error} 部分数据可能来自模拟源。</AlertDescription>
         </Alert>
      )}

      {isLoadingCategories && (
        <div className="space-y-2 p-3 border rounded-md shadow-sm mb-6 bg-card">
            <div className="flex space-x-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-28" />
            </div>
        </div>
      )}
      {(!isLoadingCategories && globalCategories.length > 0) && (
        <ScrollArea className="w-full whitespace-nowrap rounded-md border shadow-sm mb-6 bg-card">
          <div className="flex space-x-2 p-3">
            {globalCategories.map(category => (
              <Button
                key={`${activeSourceUrl || 'mock'}-${category.id}`}
                variant={selectedCategoryId === category.id ? "default" : "outline"}
                onClick={() => updateURLParams({ category: category.id, page: 1, q: null })}
                className="whitespace-nowrap text-sm h-9 px-4"
                size="sm"
              >
                {category.name}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      

      {(isLoadingContent || contentItems.length > 0 || totalItems > 0 || currentPageQuery > 1 || currentSearchTermQuery ) && (
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 p-4 bg-card rounded-lg shadow">
            <span>总共 {totalItems} 条结果 {currentSearchTermQuery && `(搜索 "${currentSearchTermQuery}")`}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPageQuery - 1)} disabled={currentPageQuery <= 1 || isLoadingContent}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>第 {currentPageQuery} 页 / 共 {totalPages} 页</span>
              <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPageQuery + 1)} disabled={currentPageQuery >= totalPages || isLoadingContent}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      }


      {isLoadingContent && contentItems.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-4 md:gap-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : contentItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-4 md:gap-6">
          {contentItems.map(item => (
            <ContentCard key={`${item.id}-${activeSourceUrl || 'mock'}-${item.title}`} item={item} />
          ))}
        </div>
      ) : (
        !isLoadingContent && (
            <div className="text-center py-12 flex flex-col items-center justify-center min-h-[300px]">
                <SearchIcon className="w-16 h-16 mb-4 text-muted-foreground" />
                <p className="text-xl text-muted-foreground">
                {currentSearchTermQuery ? `未找到与 "${currentSearchTermQuery}" 相关的内容。` : "此分类下暂无内容。"}
                </p>
                { !activeSourceUrl && sources.length > 0 && ( 
                    <p className="mt-2 text-sm text-muted-foreground">内容源可能正在加载或选择中，请稍候。</p>
                )}
                 { error && error.includes("此源不支持搜索") && currentSearchTermQuery && (
                     <p className="mt-2 text-sm text-destructive">提示: 当前内容源不支持搜索功能。</p>
                 )}
            </div>
        )
      )}
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
      <div className="space-y-2 p-3 border rounded-md shadow-sm mb-6 bg-card">
          <div className="flex space-x-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-28" />
          </div>
      </div>
      <div className="space-y-4 p-4 bg-card rounded-lg shadow">
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-4 md:gap-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="aspect-[2/3] w-full rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

