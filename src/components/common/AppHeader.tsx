"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from "next/link";
import AppLogo from "./AppLogo";
import { Button } from "@/components/ui/button";
import { Settings, Sun, Moon, Search as SearchIcon, ArrowLeft, ChevronsUpDown } from "lucide-react";
import { useTheme } from '@/contexts/ThemeContext';
import { useCategories } from '@/contexts/CategoryContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { SourceConfig } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchBar } from "@/components/search/SearchBar";
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

function SourceAndCategorySelector({ onSelection }: { onSelection: () => void }) {
  const { categories, activeSourceId, setActiveSourceId } = useCategories();
  const [sources] = useLocalStorage<SourceConfig[]>('cinemaViewSources', []);
  const router = useRouter();
  const pathname = usePathname();

  const displayCategories = categories.filter(c => c.id !== 'all');

  const handleSourceChange = (newSourceId: string) => {
    setActiveSourceId(newSourceId);
    if (pathname === '/') {
        router.push('/');
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    router.push(`/?category=${categoryId}`);
    onSelection();
  };

  if (sources.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center text-center p-4 h-full">
             <p className="text-muted-foreground">请先到“设置”页面添加内容源。</p>
             <Button asChild onClick={onSelection} className="mt-4">
                <Link href="/settings">前往设置</Link>
             </Button>
        </div>
    )
  }

  return (
    <ScrollArea className="flex-1 -mx-6">
        <div className="px-6 space-y-6 pb-6">
            <div>
                <h3 className="text-lg font-semibold mb-3">内容源</h3>
                <Select value={activeSourceId || ''} onValueChange={handleSourceChange}>
                    <SelectTrigger className="w-full">
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
            </div>
            
            <div>
                <h3 className="text-lg font-semibold mb-3">分类</h3>
                {categories.length > 1 ? (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {displayCategories.map(category => (
                            <Button
                                key={category.id}
                                variant="secondary"
                                onClick={() => handleCategoryClick(category.id)}
                                className="h-auto justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                            >
                                <span className="truncate">{category.name}</span>
                            </Button>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {Array.from({ length: 12 }).map((_, index) => (
                            <Skeleton key={index} className="h-12 w-full rounded-lg" />
                        ))}
                    </div>
                )}
            </div>
        </div>
    </ScrollArea>
  );
}


export function AppHeader() {
  const [isClient, setIsClient] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { pageTitle, activeSourceId, setActiveSourceId } = useCategories();
  const router = useRouter();
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [isSelectorSheetOpen, setIsSelectorSheetOpen] = useState(false);
  
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  
  const handleSourceChange = (newSourceId: string) => {
    setActiveSourceId(newSourceId);
    router.push('/'); 
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileSearchVisible(false);
    }
  }, [isMobile]);
  
  if (!isClient) {
    return (
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between border-b px-4 md:px-6">
            <Link href="/" className="mr-4">
              <AppLogo />
            </Link>
        </div>
      </header>
    );
  }
  
  const SourceSwitcher = () => (
     <Select value={activeSourceId || ''} onValueChange={handleSourceChange} disabled={sources.length === 0}>
        <SelectTrigger className="w-auto min-w-[120px] max-w-[200px] h-9 border-input bg-background/80">
            <SelectValue placeholder="选择内容源" />
        </SelectTrigger>
        <SelectContent>
            {sources.length > 0 ? sources.map(source => (
            <SelectItem key={source.id} value={source.id}>
                {source.name}
            </SelectItem>
            )) : <SelectItem value="no-source" disabled>请先添加源</SelectItem>}
        </SelectContent>
    </Select>
  );

  return (
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="relative flex h-14 items-center justify-between border-b px-4 md:px-6 overflow-hidden">
        {/* --- Desktop View --- */}
        <div className="hidden w-full items-center gap-4 md:flex">
          <Link href="/" className="mr-4 flex items-center gap-4">
            <AppLogo />
          </Link>
          
          <SourceSwitcher />
          
          <div className="ml-auto flex items-center gap-4">
            <div className="w-full max-w-xs">
              <SearchBar onSearchSubmit={() => {}} />
            </div>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="切换主题">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="设置">
              <Link href="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* --- Mobile View --- */}
        <div className='contents md:hidden'>
            {/* Normal Header */}
            <div className={cn(
            "flex w-full items-center justify-between transition-all duration-300",
            {
                'opacity-0 pointer-events-none -translate-x-4': isMobileSearchVisible,
                'opacity-100': !isMobileSearchVisible,
            }
            )}>
                <div className='flex-1'>
                    <Link href="/" className="flex items-center gap-2">
                        <AppLogo />
                    </Link>
                </div>
                

                <div className="absolute left-1/2 -translate-x-1/2">
                    { pathname === '/' ? (
                        <Sheet open={isSelectorSheetOpen} onOpenChange={setIsSelectorSheetOpen}>
                            <SheetTrigger asChild>
                                <button className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent -ml-2 -mr-2">
                                    <span className="text-sm font-medium text-foreground truncate max-w-[calc(100vw-200px)]">
                                        {pageTitle}
                                    </span>
                                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                </button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="h-[75svh] flex flex-col p-0">
                                <SheetHeader className="p-4 border-b">
                                    <SheetTitle>浏览内容</SheetTitle>
                                </SheetHeader>
                                <SourceAndCategorySelector onSelection={() => setIsSelectorSheetOpen(false)} />
                            </SheetContent>
                        </Sheet>
                    ) : (
                        <span className="text-sm font-medium text-foreground truncate max-w-[calc(100vw-160px)]">
                            {pageTitle}
                        </span>
                    )}
                </div>

                <div className='flex-1 flex justify-end'>
                    <Button variant="ghost" size="icon" aria-label="打开搜索" onClick={() => setIsMobileSearchVisible(true)}>
                        <SearchIcon className="h-5 w-5" />
                    </Button>
                </div>
            </div>
            
            {/* Search View */}
            <div className={cn(
            "absolute inset-y-0 left-0 right-0 flex h-full items-center gap-2 bg-background px-2 transition-all duration-300 md:hidden",
            {
                'opacity-100': isMobileSearchVisible,
                'opacity-0 pointer-events-none translate-x-4': !isMobileSearchVisible,
            }
            )}>
                <Button variant="ghost" size="icon" aria-label="返回" onClick={() => setIsMobileSearchVisible(false)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className='w-full'>
                    <SearchBar autoFocus={isMobileSearchVisible} onSearchSubmit={() => setIsMobileSearchVisible(false)} />
                </div>
            </div>
        </div>
      </div>
    </header>
  );
}
