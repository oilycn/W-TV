
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
import { AlertCircle, Tv2, ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCategories } from '@/contexts/CategoryContext';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';

function HomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { categories: globalCategories, setCategories: setGlobalCategories } = useCategories();

  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [activeSourceId, setActiveSourceId] = useLocalStorage<string | null>(LOCAL_STORAGE_KEY_ACTIVE_SOURCE, null);
  
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive state from URL search parameters
  const selectedCategoryId = useMemo(() => searchParams.get('category') || 'all', [searchParams]);
  const currentSearchTermQuery = useMemo(() => searchParams.get('q') || '', [searchParams]);
  const currentPageQuery = useMemo(() => parseInt(searchParams.get('page') || '1', 10), [searchParams]);
  const activeSourceTrigger = useMemo(() => searchParams.get('activeSourceTrigger'), [searchParams]);
  const searchTrigger = useMemo(() => searchParams.get('searchTrigger'), [searchParams]);


  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  useEffect(() => {
    // If a source trigger is in the URL, and it's different from current activeSourceId, update activeSourceId
    if (activeSourceTrigger && activeSourceTrigger !== activeSourceId) {
      console.log(`HomePageContent: activeSourceTrigger (${activeSourceTrigger}) detected from URL, updating activeSourceId.`);
      setActiveSourceId(activeSourceTrigger);
    }
  }, [activeSourceTrigger, activeSourceId, setActiveSourceId]);

   useEffect(() => {
    // This effect ensures a valid activeSourceId is always set if sources are available
    if (sources.length > 0) {
      const activeSourceIsValid = sources.find(s => s.id === activeSourceId);
      if (!activeSourceIsValid) { // If current activeSourceId is not in sources list or is null
        console.log("HomePageContent: Invalid or no activeSourceId, defaulting to first source.");
        setActiveSourceId(sources[0].id); // Default to the first source
      }
    } else if (sources.length === 0 && activeSourceId) { // If no sources, clear activeSourceId
      console.log("HomePageContent: No sources available, clearing activeSourceId.");
      setActiveSourceId(null);
    }
  }, [sources, activeSourceId, setActiveSourceId]);


  const activeSourceUrl = useMemo(() => {
    if (activeSourceId) {
      const source = sources.find(s => s.id === activeSourceId);
      if (source) {
        console.log(`HomePageContent: activeSourceUrl determined by activeSourceId: ${source.url}`);
        return source.url;
      }
    }
    // Fallback if activeSourceId is somehow invalid or not yet set, but sources exist
    if (sources.length > 0) {
      console.warn(`HomePageContent: activeSourceUrl using fallback (first source) because activeSourceId (${activeSourceId}) might be invalid or not yet synced.`);
      return sources[0].url;
    }
    console.log(`HomePageContent: activeSourceUrl is null (no sources or no valid activeSourceId).`);
    return null;
  }, [sources, activeSourceId]);


  const updateURLParams = useCallback((newParams: Record<string, string | number | undefined | null>) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    let changed = false;
    Object.entries(newParams).forEach(([key, value]) => {
      const stringValue = String(value);
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (key === 'page' && value === 1 && !currentParams.has('q') && (currentParams.get('category') === 'all' || !currentParams.has('category')) )) {
         // Remove 'all' category explicitly if it's the default, page is 1, and no search
        if (key === 'category' && value === 'all') {
             if(currentParams.has(key) && currentParams.get(key) === 'all') {
                currentParams.delete(key);
                changed = true;
            }
        } else if (currentParams.has(key)) {
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
  
    if (changed) {
        // Preserve triggers if they were part of the initiating searchParams
        // This helps avoid loops if the trigger itself is removed prematurely by newParams
        ['activeSourceTrigger', 'searchTrigger'].forEach(triggerKey => {
            if (searchParams.has(triggerKey) && !Object.prototype.hasOwnProperty.call(newParams, triggerKey)) {
                if(!currentParams.has(triggerKey) && searchParams.get(triggerKey)) {
                     currentParams.set(triggerKey, searchParams.get(triggerKey)!);
                }
            }
        });
        const newQueryString = currentParams.toString();
        console.log(`Updating URL with new params: ${newQueryString}`);
        router.push(`${pathname}?${newQueryString}`, { scroll: false });
    }
  }, [router, searchParams, pathname]);


  const loadCategoriesAndContent = useCallback(async (
    sourceUrlForFetch: string | null,
    page: number,
    categoryId: string,
    searchTerm: string
  ) => {
    console.log(`Executing loadCategoriesAndContent for source: ${sourceUrlForFetch}, page: ${page}, category: ${categoryId}, search: "${searchTerm}"`);
    setIsLoading(true);
    setIsLoadingCategories(true);
    setError(null);
    setContentItems([]); 

    if (sourceUrlForFetch) {
      try {
        console.log(`Fetching categories for source: ${sourceUrlForFetch}`);
        const fetchedCategories = await fetchApiCategories(sourceUrlForFetch);
        setGlobalCategories(fetchedCategories);
      } catch (e) {
        console.error("Failed to load categories:", e);
        setError(prev => prev ? `${prev} & 无法加载分类信息。` : "无法加载分类信息。");
        setGlobalCategories(getMockApiCategories());
      } finally {
        setIsLoadingCategories(false);
      }

      try {
        console.log(`Fetching content for source: ${sourceUrlForFetch}, category: ${categoryId}, page: ${page}, search: "${searchTerm}"`);
        const response = await fetchApiContentList(sourceUrlForFetch, {
          page,
          categoryId: categoryId === 'all' ? undefined : categoryId,
          searchTerm: searchTerm || undefined,
        });
        setContentItems(response.items);
        setTotalPages(response.pageCount || 1);
        setTotalItems(response.total);
        console.log("Fetched content:", response);
      } catch (e) {
        console.error("Failed to load content:", e);
        setError(prev => prev ? `${prev} & 无法加载内容。` : "无法加载内容。请检查您的网络连接或内容源配置。");
        const mockResponse = getMockPaginatedResponse(page, categoryId, searchTerm);
        setContentItems(mockResponse.items);
        setTotalPages(mockResponse.pageCount || 1);
        setTotalItems(mockResponse.total);
      } finally {
        setIsLoading(false);
      }
    } else {
      console.log("No active source URL, using mock data for categories and content.");
      setGlobalCategories(getMockApiCategories());
      const mockResponse = getMockPaginatedResponse(page, categoryId, searchTerm);
      setContentItems(mockResponse.items);
      setTotalPages(mockResponse.pageCount || 1);
      setTotalItems(mockResponse.total);
      setIsLoadingCategories(false);
      setIsLoading(false);
    }
  }, [setGlobalCategories]); 

  // Main effect to load data when activeSourceId, page, category, or search term changes
  useEffect(() => {
    console.log(`HomePageContent main useEffect. ActiveSourceId: ${activeSourceId}, Page: ${currentPageQuery}, Category: ${selectedCategoryId}, Search: "${currentSearchTermQuery}", SearchTrigger: ${searchTrigger}`);
    
    let sourceUrlForFetch: string | null = null;
    if (activeSourceId) {
      const source = sources.find(s => s.id === activeSourceId);
      if (source) {
        sourceUrlForFetch = source.url;
      } else {
        console.warn(`HomePageContent: activeSourceId ${activeSourceId} is invalid. No fetch attempt.`);
      }
    } else if (sources.length > 0) {
      console.warn("HomePageContent: No activeSourceId, but sources exist. This might indicate a sync delay or issue.");
      setIsLoading(true); 
      return; 
    }


    if (sourceUrlForFetch || sources.length === 0) { 
      loadCategoriesAndContent(sourceUrlForFetch, currentPageQuery, selectedCategoryId, currentSearchTermQuery);
    } else if (sources.length > 0 && !activeSourceId) {
        console.log("HomePageContent: Waiting for activeSourceId to be determined from sources list.");
        setIsLoading(true); 
    } else {
        console.log("HomePageContent: No valid source URL and no sources, data fetching skipped (mocks will be used by loadCategoriesAndContent if sourceUrlForFetch is null).");
        loadCategoriesAndContent(null, currentPageQuery, selectedCategoryId, currentSearchTermQuery);
    }
  }, [activeSourceId, currentPageQuery, selectedCategoryId, currentSearchTermQuery, sources, loadCategoriesAndContent, searchTrigger]);


  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      updateURLParams({ page: newPage, category: selectedCategoryId === 'all' ? null : selectedCategoryId, q: currentSearchTermQuery || null });
    }
  };

  if (sources.length === 0 && !activeSourceUrl && !isLoading && !isLoadingCategories ) {
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

      {(!isLoadingCategories && globalCategories.length > 0) && (
        <ScrollArea className="w-full whitespace-nowrap rounded-md border shadow-sm mb-6 bg-card">
          <div className="flex space-x-2 p-3">
            {globalCategories.map(category => (
              <Button
                key={category.id}
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


      {(isLoading || contentItems.length > 0 || totalItems > 0 || currentPageQuery > 1) && (
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 p-4 bg-card rounded-lg shadow">
            <span>总共 {totalItems} 条结果</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPageQuery - 1)} disabled={currentPageQuery <= 1 || isLoading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>第 {currentPageQuery} 页 / 共 {totalPages} 页</span>
              <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPageQuery + 1)} disabled={currentPageQuery >= totalPages || isLoading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      }


      {isLoading && contentItems.length === 0 ? (
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
        !isLoading && (
            <div className="text-center py-12 flex flex-col items-center justify-center">
                <SearchIcon className="w-16 h-16 mb-4 text-muted-foreground" />
                <p className="text-xl text-muted-foreground">
                {currentSearchTermQuery ? `未找到与 "${currentSearchTermQuery}" 相关的内容。` : "此分类下暂无内容。"}
                </p>
                { !activeSourceUrl && sources.length > 0 && ( 
                    <p className="mt-2 text-sm text-muted-foreground">内容源可能正在加载或选择中，请稍候。</p>
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

