
"use client";

import { useEffect, useState } from 'react';
import { SearchBar } from "@/components/search/SearchBar";
import AppLogo from "./AppLogo";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings, Sun, Moon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { SourceConfig } from '@/types';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';


const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';

export function AppHeader() {
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [activeSourceId, setActiveSourceId] = useLocalStorage<string | null>(LOCAL_STORAGE_KEY_ACTIVE_SOURCE, null);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
      if (sources.length > 0 && (!activeSourceId || !sources.find(s => s.id === activeSourceId))) {
        setActiveSourceId(sources[0].id);
      } else if (sources.length === 0 && activeSourceId) {
        setActiveSourceId(null);
      }
    }
  }, [sources, activeSourceId, setActiveSourceId, isClient]);

  const handleSourceChange = (newSourceId: string) => {
    if (isClient) {
      setActiveSourceId(newSourceId);
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('activeSourceTrigger', newSourceId);
      newParams.set('page', '1'); 
      if (pathname === '/') {
        router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
      }
    }
  };

  if (!isClient) {
    return (
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/">
            <AppLogo />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur-md md:px-6">
      {/* --- Desktop View --- */}
      <div className="hidden md:flex w-full items-center gap-4">
        <Link href="/" className="mr-4">
          <AppLogo />
        </Link>
        <div className="flex-grow max-w-md">
          <SearchBar onSearchSubmit={() => {}} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {sources.length > 0 && (
            <Select value={activeSourceId || ''} onValueChange={handleSourceChange}>
              <SelectTrigger className="w-[150px] lg:w-[200px] h-9 text-sm">
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
          )}
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
      <div className="w-full md:hidden">
        {sources.length > 0 && (
          <Select value={activeSourceId || ''} onValueChange={handleSourceChange}>
            <SelectTrigger className="w-full h-9 text-sm">
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
        )}
      </div>
    </header>
  );
}
