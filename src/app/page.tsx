
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
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

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

const uniqueSortedClientFilter = (arr: (string | undefined)[] = []): string[] => {
  const filtered = arr.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  return Array.from(new Set(filtered)).sort();
};

export default function HomePage() {
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Client-side filters (applied after server fetch)
  const [qualityFilter, setQualityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'tv_show'>('all');

  const primarySourceUrl = useMemo(() => sources.length > 0 ? sources[0].url : null, [sources]);

  const loadCategories = useCallback(async () => {
    if (!primarySourceUrl) {
      setCategories(getMockApiCategories());
      return;
    }
    setIsLoading(true);
    try {
      const fetchedCategories = await fetchApiCategories(primarySourceUrl);
      setCategories(fetchedCategories.length > 0 ? fetchedCategories : getMockApiCategories());
    } catch (e) {
      console.error("Failed to load categories:", e);
      setError("无法加载分类信息。");
      setCategories(getMockApiCategories());
    } finally {
      setIsLoading(false); // Categories loading is part of overall loading
    }
  }, [primarySourceUrl]);

  const loadContent = useCallback(async (page: number, categoryId: string, searchTerm: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let response: PaginatedContentResponse;
      if (!primarySourceUrl && !searchTerm && categoryId === 'all') { // Only use mock if no source AND no search/category
        response = getMockPaginatedResponse(page);
      } else if (!primarySourceUrl && (searchTerm || categoryId !== 'all')) { // If searching/filtering without source, show no results
        response = { items: [], page:1, pageCount: 1, limit: 20, total: 0 };
      }
      else if (primarySourceUrl) {
        response = await fetchApiContentList(primarySourceUrl, {
          page,
          categoryId: categoryId === 'all' ? undefined : categoryId,
          searchTerm: searchTerm || undefined,
        });
      } else { // Should not happen if logic above is correct
        response = getMockPaginatedResponse(page, categoryId, searchTerm);
      }

      setContentItems(response.items);
      setCurrentPage(response.page);
      setTotalPages(response.pageCount);
      setTotalItems(response.total);

      if (response.items.length === 0 && (searchTerm || categoryId !== 'all')) {
        // You might want a softer message if search/filter yields no results vs. total failure
      }

    } catch (e) {
      console.error("Failed to load content:", e);
      setError("无法加载内容。请检查您的网络连接或内容源配置。");
      const mockResponse = getMockPaginatedResponse(page, categoryId, searchTerm);
      setContentItems(mockResponse.items); // Fallback to mock data on error
      setCurrentPage(mockResponse.page);
      setTotalPages(mockResponse.pageCount);
      setTotalItems(mockResponse.total);
    } finally {
      setIsLoading(false);
    }
  }, [primarySourceUrl]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    // Initial load and when category/search/page changes
    loadContent(currentPage, selectedCategoryId, debouncedSearchTerm);
  }, [loadContent, currentPage, selectedCategoryId, debouncedSearchTerm]);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(currentSearchTerm);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [currentSearchTerm]);


  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentSearchTerm(e.target.value);
  };
  
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setCurrentPage(1); // Reset to page 1 on category change
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };
  
  const availableQualitiesClient = useMemo(() => uniqueSortedClientFilter(contentItems.flatMap(item => item.availableQualities)), [contentItems]);
  
  const clientFilteredContent = useMemo(() => {
    return contentItems.filter(item => {
      const matchesQuality = qualityFilter === 'all' || (item.availableQualities && item.availableQualities.includes(qualityFilter));
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      return matchesQuality && matchesType;
    });
  }, [contentItems, qualityFilter, typeFilter]);


  if (sources.length === 0 && !primarySourceUrl && !isLoading) {
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

      {/* Filters Bar */}
      <div className="space-y-4 p-4 bg-card rounded-lg shadow">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="relative sm:col-span-2 md:col-span-1">
            <Input 
              type="search"
              placeholder="搜索标题..."
              value={currentSearchTerm}
              onChange={handleSearchInputChange}
              className="pr-10"
            />
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
            <SelectTrigger><SelectValue placeholder="按分类筛选" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有分类</SelectItem>
              {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as 'all' | 'movie' | 'tv_show')}>
            <SelectTrigger><SelectValue placeholder="按格式筛选 (客户端)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有格式</SelectItem>
              <SelectItem value="movie">电影</SelectItem>
              <SelectItem value="tv_show">电视剧</SelectItem>
            </SelectContent>
          </Select>
          {/* Removed Quality filter to simplify, can be added back if needed */}
        </div>
         <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
          <span>总共 {totalItems} 条结果</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1 || isLoading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>第 {currentPage} 页 / 共 {totalPages} 页</span>
            <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages || isLoading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content Grid / Skeletons */}
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
            {currentSearchTerm ? `未找到与 "${currentSearchTerm}" 相关的内容。` : "此分类下暂无内容。"}
          </p>
        </div>
      )}
    </div>
  );
}
