"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from "next/link";
import AppLogo from "./AppLogo";
import { Button } from "@/components/ui/button";
import { Settings, Sun, Moon, Search as SearchIcon, ArrowLeft, ChevronsUpDown, History, Compass, Film, Tv, Palette, Theater, Popcorn, ChevronDown, Check, Sparkles, Database, Radio } from "lucide-react";
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

export function getSourceMeta(source?: SourceConfig | null) {
  if (!source) {
    return {
      typeLabel: '未配置',
      subLabel: '请添加内容源',
      badgeClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
      dotClass: 'bg-zinc-400',
      domain: '',
      isRule: false,
    };
  }

  const url = source.url || '';
  const isRule =
    source.type === 'rule' ||
    source.type === 'js' ||
    url.endsWith('.js') ||
    url.includes('/rules/') ||
    url.includes('rule=') ||
    url.includes('.pages.dev');

  let domain = '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    domain = parsed.hostname;
  } catch {
    domain = url.split('/')[0] || '';
  }

  if (isRule) {
    return {
      typeLabel: '爬虫规则',
      subLabel: 'DRpy / JS 规则',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
      domain: domain || '本地规则',
      isRule: true,
    };
  }

  return {
    typeLabel: 'CMS 采集',
    subLabel: '苹果CMS / JSON 接口',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    dotClass: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    domain: domain || 'API 接口',
    isRule: false,
  };
}

function SourceAndCategorySelector({ onSelection }: { onSelection: () => void }) {
  const { categories, activeSourceId, setActiveSourceId } = useCategories();
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const router = useRouter();
  const pathname = usePathname();

  const displayCategories = categories.filter(c => c.id !== 'all');

  const handleSourceChange = (newSourceId: string) => {
    setActiveSourceId(newSourceId);
    router.push('/');
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
                    <SelectTrigger className="w-full text-base py-5 rounded-xl border-border/80">
                        <SelectValue placeholder="选择内容源" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {sources.map(source => {
                          const meta = getSourceMeta(source);
                          return (
                            <SelectItem key={source.id} value={source.id} className="text-sm py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", meta.dotClass)} />
                                <span className="font-medium">{source.name}</span>
                                <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium shrink-0", meta.badgeClass)}>
                                  {meta.typeLabel}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
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
        <div className="flex h-10 min-w-[150px] items-center rounded-full border border-border/70 bg-background/80 px-4 text-xs text-muted-foreground shadow-sm">
          加载内容源...
        </div>
      );
    }

    const currentSource = sources.find(s => s.id === activeSourceId) || sources[0] || null;
    const currentMeta = getSourceMeta(currentSource);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={sources.length === 0}
            className={cn(
              "group relative flex h-10 items-center gap-2 rounded-full border border-border/80 bg-background/85 pl-3.5 pr-2.5 shadow-sm backdrop-blur-md transition-all duration-200",
              "hover:border-primary/50 hover:bg-muted/80 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              sources.length === 0 && "opacity-60 cursor-not-allowed"
            )}
            title={`当前影视源：${currentSource?.name || '未选择'}`}
          >
            {/* 呼吸状态灯 */}
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", currentMeta.dotClass)} />
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", currentMeta.dotClass)} />
            </span>

            {/* 源名称 */}
            <span className="max-w-[100px] sm:max-w-[130px] truncate text-xs font-semibold text-foreground tracking-tight">
              {currentSource?.name || '选择内容源'}
            </span>

            {/* 当前源类型彩色微徽章 */}
            {currentSource && (
              <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none shrink-0", currentMeta.badgeClass)}>
                {currentMeta.typeLabel}
              </span>
            )}

            {/* 下拉微箭头 */}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/70 transition-transform group-hover:text-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[300px] sm:w-[325px] rounded-2xl border-border/60 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-b border-border/50 mb-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Tv className="h-3.5 w-3.5 text-primary" />
              切换影视源
            </span>
            <span className="text-[11px] font-mono text-muted-foreground/80">
              共 {sources.length} 个可用源
            </span>
          </div>

          {/* 选项卡片列表 */}
          <div className="max-h-[360px] overflow-y-auto space-y-1 p-0.5 scrollbar-thin">
            {sources.length > 0 ? (
              sources.map(source => {
                const isSelected = source.id === (activeSourceId || sources[0]?.id);
                const meta = getSourceMeta(source);

                return (
                  <DropdownMenuItem
                    key={source.id}
                    onClick={() => handleSourceChange(source.id)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition-all outline-none",
                      isSelected
                        ? "bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 shadow-xs"
                        : "hover:bg-muted/70 text-foreground"
                    )}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", meta.dotClass)} />
                        <span className="truncate text-xs font-semibold leading-none">
                          {source.name}
                        </span>
                        <span className={cn("rounded-md border px-1.5 py-0.5 text-[9px] font-medium leading-none shrink-0", meta.badgeClass)}>
                          {meta.typeLabel}
                        </span>
                      </div>
                      <div className="mt-1 pl-3.5 truncate text-[11px] text-muted-foreground/75 font-mono">
                        {meta.domain} · {meta.subLabel}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                暂无可用内容源
              </div>
            )}
          </div>

          {/* Footer 管理入口 */}
          <DropdownMenuSeparator className="my-1 border-border/40" />
          <DropdownMenuItem asChild className="cursor-pointer rounded-xl text-xs py-2 text-muted-foreground hover:text-foreground justify-center font-medium">
            <Link href="/settings" className="flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              管理与添加内容源
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
            
            <div className="hidden lg:block">
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
