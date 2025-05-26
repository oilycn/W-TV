
"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { ContentItem, SourceConfig, ApiCategory, PaginatedContentResponse } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchApiCategories, fetchApiContentList, getMockApiCategories, getMockPaginatedResponse } from '@/lib/content-loader';
import { ContentCard } from '@/components/content/ContentCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Tv2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCategories } from '@/contexts/CategoryContext'; 

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

function HomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { setCategories: setGlobalCategories } = useCategories(); 

  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [apiCategoriesForSelect, setApiCategoriesForSelect] = useState<ApiCategory[]>([]); 
  
  const selectedCategoryId = useMemo(() => searchParams.get('category') || 'all', [searchParams]);
  const currentSearchTermQuery = useMemo(() => searchParams.get('q') || '', [searchParams]);
  const currentPageQuery = useMemo(() => parseInt(searchParams.get('page') || '1', 10), [searchParams]);

  const [searchInput, setSearchInput] = useState(currentSearchTermQuery); 
  
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'tv_show'>('all');

  const primarySourceUrl = useMemo(() => sources.length > 0 ? sources[0].url : null, [sources]);

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
        router.push(`${pathname}?${newQueryString}`, { scroll: false });
    }
  }, [router, searchParams, pathname]);


  const loadCategoriesAndContent = useCallback(async (page: number, categoryId: string, searchTerm: string) => {
    setIsLoading(true);
    setIsLoadingCategories(true);
    setError(null);

    let fetchedCategories: ApiCategory[] = [];
    if (primarySourceUrl) {
      try {
        fetchedCategories = await fetchApiCategories(primarySourceUrl);
        if (fetchedCategories.length === 0 && globalCategories.length === 0) { // Only use mock if no global and no fetched
            fetchedCategories = getMockApiCategories();
        }
      } catch (e) {
        console.error("Failed to load categories:", e);
        setError(prev => prev ? `${prev} & 无法加载分类信息。` : "无法加载分类信息。");
        if (globalCategories.length === 0) fetchedCategories = getMockApiCategories();
      }
    } else {
      if (globalCategories.length === 0) fetchedCategories = getMockApiCategories();
    }

    if(fetchedCategories.length > 0) {
        setApiCategoriesForSelect(fetchedCategories);
        setGlobalCategories(fetchedCategories);
    } else if (globalCategories.length > 0) {
        setApiCategoriesForSelect(globalCategories); // Use existing global if fetch yields nothing new
    }
    setIsLoadingCategories(false);

    try {
      let response: PaginatedContentResponse;
      if (!primarySourceUrl && !searchTerm && categoryId === 'all') { 
        response = getMockPaginatedResponse(page);
      } else if (!primarySourceUrl && (searchTerm || categoryId !== 'all')) { 
        response = { items: [], page:1, pageCount: 1, limit: 20, total: 0 };
      }
      else if (primarySourceUrl) {
        response = await fetchApiContentList(primarySourceUrl, {
          page,
          categoryId: categoryId === 'all' ? undefined : categoryId,
          searchTerm: searchTerm || undefined,
        });
      } else { 
        response = getMockPaginatedResponse(page, categoryId, searchTerm);
      }

      setContentItems(response.items);
      setTotalPages(response.pageCount || 1); // Ensure totalPages is at least 1
      setTotalItems(response.total);

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
  }, [primarySourceUrl, setGlobalCategories, globalCategories]);


  useEffect(() => {
    setSearchInput(currentSearchTermQuery); 
    loadCategoriesAndContent(currentPageQuery, selectedCategoryId, currentSearchTermQuery);
  }, [selectedCategoryId, currentSearchTermQuery, currentPageQuery, loadCategoriesAndContent]);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      if (currentSearchTermQuery !== searchInput) {
         updateURLParams({ q: searchInput || undefined, page: 1 });
      }
    }, 500); 

    return () => {
      clearTimeout(handler);
    };
  }, [searchInput, currentSearchTermQuery, updateURLParams]);


  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };
  
  const handleCategoryChange = (newCategoryId: string) => {
    updateURLParams({ category: newCategoryId, page: 1, q: searchInput || undefined }); // Keep search term
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      updateURLParams({ page: newPage });
    }
  };
  
  const clientFilteredContent = useMemo(() => {
    return contentItems.filter(item => {
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      return matchesType;
    });
  }, [contentItems, typeFilter]);


  if (sources.length === 0 && !primarySourceUrl && !isLoading && !isLoadingCategories && (!apiCategoriesForSelect.length || apiCategoriesForSelect.every(c => c.name.includes('(模拟)'))) ) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center">
        <Tv2 className="w-24 h-24 mb-6 text-muted-foreground" />
        <h2 className="text-2xl font-semibold mb-2 text-foreground">欢迎来到影院视图</h2>
        <p className="mb-6 text-muted-foreground">
          看起来您还没有配置任何内容源。
        </p>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/settings">前往设置以添加内容源</Link>
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">（当前显示示例分类和数据）</p>
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

      <div className="space-y-4 p-4 bg-card rounded-lg shadow">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="relative sm:col-span-2 md:col-span-1">
            <Input 
              type="search"
              placeholder="搜索标题..."
              value={searchInput}
              onChange={handleSearchInputChange}
              className="pr-10"
            />
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          {isLoadingCategories && apiCategoriesForSelect.length === 0 ? ( // Show skeleton only if categories are truly loading AND empty
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={selectedCategoryId} onValueChange={handleCategoryChange} disabled={apiCategoriesForSelect.length === 0}>
              <SelectTrigger><SelectValue placeholder="按分类筛选" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有分类</SelectItem>
                {apiCategoriesForSelect.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as 'all' | 'movie' | 'tv_show')}>
            <SelectTrigger><SelectValue placeholder="按格式筛选 (客户端)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有格式</SelectItem>
              <SelectItem value="movie">电影</SelectItem>
              <SelectItem value="tv_show">电视剧</SelectItem>
            </SelectContent>
          </Select>
        </div>
         <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
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
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-[300px] w-full rounded-lg" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : clientFilteredContent.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {clientFilteredContent.map(item => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-muted-foreground">
            {currentSearchTermQuery ? `未找到与 "${currentSearchTermQuery}" 相关的内容。` : "此分类下暂无内容。"}
          </p>
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Skeleton className="h-10 sm:col-span-2 md:col-span-1" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
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

