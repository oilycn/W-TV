"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from "next/link";
import AppLogo from "./AppLogo";
import { Button } from "@/components/ui/button";
import { Settings, Sun, Moon, Search as SearchIcon, ArrowLeft, ChevronsUpDown, History, Compass, Film, Tv, Palette, Theater, Popcorn, ChevronDown, Check } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

function SourceAndCategorySelector({ onSelection }: { onSelection: () => void }) {
  const { categories, activeSourceId, setActiveSourceId } = useCategories();
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
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
                <h3 className="text-base font-semibold mb-2 text-muted-foreground">内容源</h3>
                <Select value={activeSourceId || ''} onValueChange={handleSourceChange}>
                    <SelectTrigger className="w-full text-base py-5">
                        <SelectValue placeholder="选择内容源" />
                    </SelectTrigger>
                    <SelectContent>
                        {sources.map(source => (
                        <SelectItem key={source.id} value={source.id} className="text-base py-2">
                            {source.name}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            <div>
                <h3 className="text-base font-semibold mb-2 text-muted-foreground">分类</h3>
                {categories.length > 1 ? (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {displayCategories.map(category => (
                            <Button
                                key={category.id}
                                variant="secondary"
                                onClick={() => handleCategoryClick(category.id)}
                                className="h-auto justify-center rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                            >
                                <span className="truncate">{category.name}</span>
                            </Button>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {Array.from({ length: 12 }).map((_, index) => (
                            <Skeleton key={index} className="h-[50px] w-full rounded-lg bg-white/5" />
                        ))}
                    </div>
                )}
            </div>
        </div>
    </ScrollArea>
  );
}

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();
  const { categories, pageTitle, activeSourceId, setActiveSourceId } = useCategories();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [isSelectorSheetOpen, setIsSelectorSheetOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const selectedCategoryId = searchParams.get('category') || 'all';

  useEffect(() => {
    setIsClientReady(true);
  }, []);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initialize state
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const handleSourceChange = (newSourceId: string) => {
    setActiveSourceId(newSourceId);
    router.push('/'); 
  };

  const getCategoryIcon = (name: string) => {
    if (name.includes('电影')) return Film;
    if (name.includes('剧')) return Tv;
    if (name.includes('动漫')) return Palette;
    if (name.includes('综艺')) return Theater;
    if (name.includes('全部')) return Compass;
    return Popcorn;
  };

  const getHeaderCategoryName = (name: string) => {
    return name.replace(/[（(].*?[）)]/g, '').trim() || name;
  };

  const handleHeaderCategoryChange = (categoryId: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (categoryId === 'all') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', categoryId);
    }
    nextParams.delete('q');
    nextParams.delete('page');
    const query = nextParams.toString();
    router.push(`/${query ? `?${query}` : ''}`, { scroll: false });
  };

  useEffect(() => {
    if (!isMobile) {
      setIsMobileSearchVisible(false);
    }
  }, [isMobile]);
  
  const SourceSwitcher = () => {
    if (!isClientReady) {
      return (
        <div className="flex h-10 min-w-[140px] max-w-[220px] items-center rounded-full border border-border/70 bg-background/80 px-4 text-sm text-muted-foreground shadow-sm">
          选择内容源
        </div>
      );
    }

    return (
      <Select value={activeSourceId || ''} onValueChange={handleSourceChange} disabled={sources.length === 0}>
        <SelectTrigger className="h-10 w-auto min-w-[140px] max-w-[220px] rounded-full border-border/70 bg-background/80 px-4 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted">
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
  };

  const HeaderCategoryNav = () => {
    if (pathname !== '/' || categories.length === 0 || !isClientReady) {
      return null;
    }

    const visibleCategories = categories.slice(0, 5);
    const selectedCategory = categories.find(category => category.id === selectedCategoryId);
    const shouldAppendSelected = selectedCategory && !visibleCategories.some(category => category.id === selectedCategory.id);
    const quickCategories = shouldAppendSelected
      ? [...visibleCategories.slice(0, 4), selectedCategory]
      : visibleCategories;

    return (
      <div className="hidden min-w-0 flex-none items-center md:flex">
        <div className="flex max-w-[34vw] min-w-0 items-center gap-1 rounded-full border border-border/70 bg-gradient-to-r from-background/95 via-muted/70 to-background/90 p-1 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-white/50 backdrop-blur lg:max-w-[40vw] xl:max-w-[520px]">
          <div className="flex min-w-0 items-center gap-1 overflow-hidden">
            {quickCategories.map((category, index) => {
              const headerName = getHeaderCategoryName(category.name);
              const Icon = getCategoryIcon(category.name);
              const isActive = selectedCategoryId === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => handleHeaderCategoryChange(category.id)}
                  className={cn(
                    "h-8 max-w-[112px] shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:ring-offset-0",
                    index >= 4 ? "hidden 2xl:flex" : index >= 2 ? "hidden xl:flex" : "flex",
                    isActive
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-background/90 hover:text-foreground"
                  )}
                  title={category.name}
                >
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-background" : "text-muted-foreground")} />
                  <span className="min-w-0 truncate whitespace-nowrap">{headerName}</span>
                </button>
              );
            })}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs text-muted-foreground hover:bg-background/90 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/25 focus-visible:ring-offset-0">
                更多
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[420px] rounded-xl p-2">
              <DropdownMenuLabel className="px-2 py-2 text-xs text-muted-foreground">选择分类</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="grid max-h-[360px] grid-cols-3 gap-1 overflow-y-auto p-1 styled-scrollbar">
                {categories.map((category) => {
                  const Icon = getCategoryIcon(category.name);
                  const isActive = selectedCategoryId === category.id;

                  return (
                    <DropdownMenuItem
                      key={category.id}
                      onClick={() => handleHeaderCategoryChange(category.id)}
                      className={cn("h-9 rounded-lg", isActive && "bg-muted font-semibold")}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="min-w-0 flex-1 truncate">{category.name}</span>
                      {isActive && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <header className={cn(
      "sticky top-0 z-50 pt-[env(safe-area-inset-top)] transition-all duration-300",
      isScrolled 
        ? "border-b border-border/60 bg-background/90 shadow-sm backdrop-blur-xl"
        : "border-b border-transparent bg-background/70 backdrop-blur"
    )}>
      <div className="relative mx-auto flex h-16 max-w-screen-3xl items-center justify-between overflow-hidden px-4 md:px-8">
        {/* --- Desktop View --- */}
        <div className="hidden w-full items-center gap-5 md:flex xl:gap-7">
          <Link href="/" className="flex shrink-0 items-center gap-4">
            <AppLogo />
          </Link>
          
          <HeaderCategoryNav />
          
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 lg:gap-3">
            <div className="w-[220px] max-w-[22vw] lg:w-[240px] xl:w-[280px]">
              <SearchBar onSearchSubmit={() => {}} />
            </div>
            
            <div className="hidden xl:block">
              <SourceSwitcher />
            </div>
            
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="切换主题" className="rounded-full hover:bg-muted active:scale-95">
              {theme === 'light' ? <Moon className="h-5 w-5 text-foreground" /> : <Sun className="h-5 w-5 text-foreground" />}
            </Button>
            
            <Button variant="ghost" size="icon" asChild aria-label="观看历史" className="rounded-full hover:bg-muted active:scale-95">
              <Link href="/history">
                <History className="h-5 w-5 text-foreground" />
              </Link>
            </Button>
            
            <Button variant="ghost" size="icon" asChild aria-label="设置" className="rounded-full hover:bg-muted active:scale-95">
              <Link href="/settings">
                <Settings className="h-5 w-5 text-foreground" />
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
                                <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-muted/50 border border-border hover:bg-muted transition-colors">
                                    <span className="text-sm font-medium text-foreground truncate max-w-[calc(100vw-200px)]">
                                        {pageTitle}
                                    </span>
                                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                </button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="h-[60svh] flex flex-col bg-background backdrop-blur-xl border-t border-border">
                                <SheetHeader>
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
                    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="切换主题" className="hover:bg-muted rounded-full mr-1">
                        {theme === 'light' ? <Moon className="h-5 w-5 text-foreground" /> : <Sun className="h-5 w-5 text-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="打开搜索" onClick={() => setIsMobileSearchVisible(true)} className="hover:bg-muted rounded-full">
                        <SearchIcon className="h-5 w-5 text-foreground" />
                    </Button>
                </div>
            </div>
            
            {/* Search View */}
            <div className={cn(
            "absolute inset-y-0 left-0 right-0 flex h-full items-center gap-2 bg-transparent px-2 transition-all duration-300 md:hidden",
            {
                'opacity-100': isMobileSearchVisible,
                'opacity-0 pointer-events-none translate-x-4': !isMobileSearchVisible,
            }
            )}>
                <Button variant="ghost" size="icon" aria-label="返回" onClick={() => setIsMobileSearchVisible(false)} className="hover:bg-white/10 rounded-full">
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
