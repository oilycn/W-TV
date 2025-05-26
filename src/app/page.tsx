
"use client";

import { useEffect, useState, useMemo } from 'react';
import type { ContentItem, SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchAllContent, getMockContentItems } from '@/lib/content-loader';
import { ContentCard } from '@/components/content/ContentCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Tv2 } from 'lucide-react'; // Added Tv2 import
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

const uniqueSorted = (arr: (string | undefined)[] = []): string[] => {
  const filtered = arr.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  return Array.from(new Set(filtered)).sort();
};


export default function HomePage() {
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'tv_show'>('all');

  useEffect(() => {
    async function loadContent() {
      setIsLoading(true);
      setError(null);
      try {
        const items = await fetchAllContent(sources);
        setContentItems(items);
      } catch (e) {
        console.error("Failed to load content:", e);
        setError("无法加载内容。请检查您的网络连接或内容源配置。");
        setContentItems(getMockContentItems()); // Fallback to mock data on error
      } finally {
        setIsLoading(false);
      }
    }
    loadContent();
  }, [sources]);

  const availableQualities = useMemo(() => uniqueSorted(contentItems.flatMap(item => item.availableQualities)), [contentItems]);
  const availableGenres = useMemo(() => uniqueSorted(contentItems.flatMap(item => item.genres)), [contentItems]);

  const filteredContent = useMemo(() => {
    return contentItems.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesQuality = qualityFilter === 'all' || (item.availableQualities && item.availableQualities.includes(qualityFilter));
      const matchesGenre = genreFilter === 'all' || (item.genres && item.genres.includes(genreFilter));
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      return matchesSearch && matchesQuality && matchesGenre && matchesType;
    });
  }, [contentItems, searchTerm, qualityFilter, genreFilter, typeFilter]);


  if (sources.length === 0 && isLoading) {
     // Still loading sources, show skeletons
  } else if (sources.length === 0 && !isLoading) {
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
         <p className="mt-4 text-sm text-muted-foreground">（当前显示示例数据）</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {error && (
         <Alert variant="destructive" className="mb-6">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>加载错误</AlertTitle>
           <AlertDescription>{error} 将显示示例数据。</AlertDescription>
         </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-card rounded-lg shadow">
        <Input 
          placeholder="搜索标题或描述..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="sm:col-span-2 md:col-span-1 lg:col-span-1"
        />
        <Select value={qualityFilter} onValueChange={setQualityFilter}>
          <SelectTrigger><SelectValue placeholder="按质量筛选" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有质量</SelectItem>
            {availableQualities.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={genreFilter} onValueChange={setGenreFilter}>
          <SelectTrigger><SelectValue placeholder="按类型筛选" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有类型</SelectItem>
            {availableGenres.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as 'all' | 'movie' | 'tv_show')}>
          <SelectTrigger><SelectValue placeholder="按格式筛选" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有格式</SelectItem>
            <SelectItem value="movie">电影</SelectItem>
            <SelectItem value="tv_show">电视剧</SelectItem>
          </SelectContent>
        </Select>
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
      ) : filteredContent.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredContent.map(item => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-muted-foreground">未找到与您的筛选条件匹配的内容。</p>
        </div>
      )}
    </div>
  );
}
