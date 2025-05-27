
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
import { AlertCircle, Tv2, ChevronLeft, ChevronRight, Search } from 'lucide-react'; // Added Tv2 import
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCategories } from '@/contexts/CategoryContext';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';

function HomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { categories: globalCategories, setCategories: setGlobalCategories } = useCategories(); // Renamed to globalCategories for clarity

  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [activeSourceId] = useLocalStorage<string | null>(LOCAL_STORAGE_KEY_ACTIVE_SOURCE, null);

  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive state from URL search parameters
  const selectedCategoryId = useMemo(() => searchParams.get('category') || 'all', [searchParams]);
  const currentSearchTermQuery = useMemo(() => searchParams.get('q') || '', [searchParams]);
  const currentPageQuery = useMemo(() => parseInt(searchParams.get('page') || '1', 10), [searchParams]);
  const activeSourceTrigger = useMemo(() => searchParams.get('activeSourceTrigger'), [searchParams]); // Listen to the trigger

  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  useEffect(() => {
    console.log(`HomePageContent: activeSourceId from useLocalStorage is: ${activeSourceId}`);
  }, [activeSourceId]);

  const activeSourceUrl = useMemo(() => {
    let url = null;
    if (activeSourceId) {
      const source = sources.find(s => s.id === activeSourceId);
      if (source) url = source.url;
    } else if (sources.length > 0) { // Default to first source if no active one is set or valid
      url = sources[0].url;
    }
    console.log(`HomePageContent: activeSourceUrl re-calculated to: ${url} (activeSourceId: ${activeSourceId})`);
    return url;
  }, [sources, activeSourceId]);


  const updateURLParams = useCallback((newParams: Record<string, string | number | undefined | null>) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    let changed = false;
    Object.entries(newParams).forEach(([key, value]) => {
      const stringValue = String(value);
      if (value === undefined || value === null || stringValue.trim() === '') {
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

    if (changed) {
        const newQueryString = currentParams.toString();
        // Preserve activeSourceTrigger if it's already there and not being explicitly changed
        if (searchParams.has('activeSourceTrigger') && !newParams.activeSourceTrigger) {
            if(!currentParams.has('activeSourceTrigger') && searchParams.get('activeSourceTrigger')) {
                 currentParams.set('activeSourceTrigger', searchParams.get('activeSourceTrigger')!);
            }
        }
        console.log(`Updating URL with new params: ${currentParams.toString()}`);
        router.push(`${pathname}?${currentParams.toString()}`, { scroll: false });
    }
  }, [router, searchParams, pathname]);


  const loadCategoriesAndContent = useCallback(async (
    sourceUrlForFetch: string | null,
    page: number,
    categoryId: string,
    searchTerm: string
  ) => {
    console.log(`Executing loadCategoriesAndContent for source: ${sourceUrlForFetch}, page: ${page}, category: ${categoryId}, search: ${searchTerm}`);
    setIsLoading(true);
    setIsLoadingCategories(true);
    setError(null);
    // setContentItems([]); // Clear previous content for better UX

    if (sourceUrlForFetch) {
      try {
        console.log(`Fetching categories for source: ${sourceUrlForFetch}`);
        const fetchedCategories = await fetchApiCategories(sourceUrlForFetch);
        console.log("Fetched categories:", fetchedCategories);
        setGlobalCategories(fetchedCategories);
      } catch (e) {
        console.error("Failed to load categories:", e);
        setError(prev => prev ? `${prev} & 无法加载分类信息。` : "无法加载分类信息。");
        setGlobalCategories(getMockApiCategories());
      } finally {
        setIsLoadingCategories(false);
      }

      try {
        console.log(`Fetching content for source: ${sourceUrlForFetch}, category: ${categoryId}, page: ${page}, search: ${searchTerm}`);
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
  }, [setGlobalCategories]); // Dependencies: setGlobalCategories is stable from context

  useEffect(() => {
    console.log(`HomePage useEffect triggered. ActiveSourceUrl: ${activeSourceUrl}, Page: ${currentPageQuery}, Category: ${selectedCategoryId}, Search: ${currentSearchTermQuery}, Trigger: ${activeSourceTrigger}`);
    // activeSourceUrl should be up-to-date here due to useMemo and its deps
    loadCategoriesAndContent(activeSourceUrl, currentPageQuery, selectedCategoryId, currentSearchTermQuery);
  }, [activeSourceUrl, currentPageQuery, selectedCategoryId, currentSearchTermQuery, loadCategoriesAndContent, activeSourceTrigger]); // Added activeSourceTrigger


  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      updateURLParams({ page: newPage });
    }
  };

  if (sources.length === 0 && !activeSourceUrl && !isLoading && !isLoadingCategories && (!globalCategories.length || globalCategories.every(c => c.id.startsWith('mock-'))) ) {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-[300px] w-full rounded-lg" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : contentItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {contentItems.map(item => (
            <ContentCard key={`${item.id}-${activeSourceUrl || 'mock'}-${item.title}`} item={item} />
          ))}
        </div>
      ) : (
        !isLoading && (
            <div className="text-center py-12 flex flex-col items-center justify-center">
                <Search className="w-16 h-16 mb-4 text-muted-foreground" />
                <p className="text-xl text-muted-foreground">
                {currentSearchTermQuery ? `未找到与 "${currentSearchTermQuery}" 相关的内容。` : "此分类下暂无内容。"}
                </p>
                { !activeSourceUrl && sources.length > 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">请尝试选择一个内容源。</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-[300px] w-full rounded-lg" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

