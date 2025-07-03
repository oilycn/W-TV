"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLogo from "./AppLogo";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings, Sun, Moon, Search as SearchIcon, ArrowLeft } from "lucide-react";
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


const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';

export function AppHeader() {
  const [isClient, setIsClient] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { pageTitle, activeSourceId, setActiveSourceId } = useCategories();
  const router = useRouter();
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
  const isMobile = useIsMobile();
  
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
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md">
        <div className="flex h-14 items-center border-b px-4 md:px-6 pt-[env(safe-area-inset-top)]">
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
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md">
      <div className="relative flex h-14 items-center border-b px-4 md:px-6 pt-[env(safe-area-inset-top)] overflow-hidden">
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
                    <span className="text-sm font-medium text-foreground truncate max-w-[calc(100vw-160px)]">
                        {pageTitle}
                    </span>
                </div>

                <div className='flex-1 flex justify-end'>
                    <Button variant="ghost" size="icon" aria-label="打开搜索" onClick={() => setIsMobileSearchVisible(true)}>
                        <SearchIcon className="h-5 w-5" />
                    </Button>
                </div>
            </div>
            
            {/* Search View */}
            <div className={cn(
            "absolute inset-y-0 left-0 right-0 flex items-center gap-2 bg-background px-2 transition-all duration-300 md:hidden pt-[env(safe-area-inset-top)]",
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