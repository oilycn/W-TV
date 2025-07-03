
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLogo from "./AppLogo";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings, Sun, Moon, Search as SearchIcon } from "lucide-react";
import { useTheme } from '@/contexts/ThemeContext';
import { useCategories } from '@/contexts/CategoryContext';
import { Separator } from '@/components/ui/separator';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { SourceConfig } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SearchBar } from "@/components/search/SearchBar";


const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';

export function AppHeader() {
  const [isClient, setIsClient] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { pageTitle } = useCategories();
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [activeSourceId, setActiveSourceId] = useLocalStorage<string | null>(LOCAL_STORAGE_KEY_ACTIVE_SOURCE, null);
  
  const handleSourceChange = (newSourceId: string) => {
    setActiveSourceId(newSourceId);
    router.push('/'); 
  };

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    // Simple static header for SSR/initial render
    return (
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
        <Link href="/" className="mr-4">
          <AppLogo />
        </Link>
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
    <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur-md md:px-6">
      {/* --- Desktop View --- */}
      <div className="hidden w-full items-center gap-4 md:flex">
        <Link href="/" className="mr-4 flex items-center gap-4">
          <AppLogo />
        </Link>
        <div className='flex items-center gap-4'>
            <SourceSwitcher />
            {pageTitle && <Separator orientation="vertical" className="h-6" />}
            <span className='text-sm text-muted-foreground truncate max-w-md'>{pageTitle}</span>
        </div>
        
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
      <div className="flex w-full items-center justify-between md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <AppLogo />
        </Link>

        <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="打开搜索">
                  <SearchIcon className="h-5 w-5" />
              </Button>
          </SheetTrigger>
          <SheetContent side="top" className="p-4 pt-6">
              <SearchBar onSearchSubmit={() => setIsSearchOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
