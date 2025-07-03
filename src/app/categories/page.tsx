"use client";

import { useCategories } from '@/contexts/CategoryContext';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Suspense } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { SourceConfig } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from 'next/navigation';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

function CategoriesPageContent() {
    const { categories, activeSourceId, setActiveSourceId } = useCategories();
    const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
    const router = useRouter();

    // Remove 'all' category for the display grid, as this page is for choosing a specific one.
    const displayCategories = categories.filter(c => c.id !== 'all');

    const handleSourceChange = (newSourceId: string) => {
        setActiveSourceId(newSourceId);
        // Refresh the page to trigger the CategoryProvider to refetch categories
        router.refresh(); 
    };

    if (categories.length <= 1 && sources.length === 0) { // Only 'all' or empty, and no sources
        return (
            <div className="flex flex-col items-center justify-center text-center p-4">
                 <p className="text-muted-foreground">请先到“设置”页面添加内容源。</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {sources.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-2">内容源</h2>
                    <Select value={activeSourceId || ''} onValueChange={handleSourceChange}>
                        <SelectTrigger className="w-full sm:w-[280px]">
                            <SelectValue placeholder="选择内容源" />
                        </SelectTrigger>
                        <SelectContent>
                            {sources.map(source => (
                            <SelectItem key={source.id} value={source.id}>
                                {source.name}
                            </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <p className="text-xs text-muted-foreground mt-2">切换内容源后，分类列表将自动更新。</p>
                </div>
            )}
            
            <div>
                <h2 className="text-lg font-semibold mb-2">分类</h2>
                {displayCategories.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
                        {displayCategories.map(category => (
                            <Button key={category.id} variant="outline" asChild className="h-10 text-sm justify-center">
                                <Link href={`/?category=${category.id}`} className="truncate">{category.name}</Link>
                            </Button>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
                        {Array.from({ length: 12 }).map((_, index) => (
                            <Skeleton key={index} className="h-10 w-full" />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


export default function CategoriesPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                分类浏览
            </h1>
            <Suspense fallback={
                 <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold mb-2">内容源</h2>
                        <Skeleton className="h-10 w-full sm:w-[280px]" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold mb-2">分类</h2>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
                            {Array.from({ length: 12 }).map((_, index) => (
                                <Skeleton key={index} className="h-10 w-full" />
                            ))}
                        </div>
                    </div>
                </div>
            }>
                <CategoriesPageContent />
            </Suspense>
        </div>
    );
}
