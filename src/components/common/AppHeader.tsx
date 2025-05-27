
"use client";

import { useEffect, useState } from 'react';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchBar } from "@/components/search/SearchBar";
import AppLogo from "./AppLogo";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings, Home, Wand2, List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { SourceConfig } from '@/types';
import { useRouter, usePathname, useSearchParams } from 'next/navigation'; // Added usePathname, useSearchParams

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';

export function AppHeader() {
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [activeSourceId, setActiveSourceId] = useLocalStorage<string | null>(LOCAL_STORAGE_KEY_ACTIVE_SOURCE, null);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname
  const searchParams = useSearchParams(); // Get current searchParams

  useEffect(() => {
    setIsClient(true);
    if (sources.length > 0 && (!activeSourceId || !sources.find(s => s.id === activeSourceId))) {
      if (isClient) setActiveSourceId(sources[0].id); // Ensure client-side for LS
    } else if (sources.length === 0 && activeSourceId) {
      if (isClient) setActiveSourceId(null);
    }
  }, [sources, activeSourceId, setActiveSourceId, isClient]);

  const handleSourceChange = (newSourceId: string) => {
    if (isClient) {
      setActiveSourceId(newSourceId); // This updates LS
      // Force a re-evaluation of the page by navigating with a trigger query param.
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('activeSourceTrigger', newSourceId); // Add/update a trigger
      newParams.set('page', '1'); // Reset to page 1 on source change
      if (pathname === '/') { // Only push if on homepage, otherwise state might be irrelevant
        router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
      } else {
         // If not on homepage, just set the active source ID.
         // Homepage will pick it up when it next loads.
      }
      console.log(`AppHeader: Source changed to ${newSourceId}, new URL params: ${newParams.toString()}`);
    }
  };
  
  if (!isClient) {
    return (
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-2 md:hidden">
          <SidebarTrigger />
          <Link href="/">
            <AppLogo />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <SidebarTrigger />
        <Link href="/">
          <AppLogo />
        </Link>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="主页">
          <Link href="/">
            <Home className="h-5 w-5" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild aria-label="AI推荐">
          <Link href="/recommendations">
            <Wand2 className="h-5 w-5" />
          </Link>
        </Button>
         <Button variant="ghost" size="icon" asChild aria-label="设置">
          <Link href="/settings">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {sources.length > 0 && (
          <div className="flex items-center gap-2">
            <List className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <Select value={activeSourceId || ''} onValueChange={handleSourceChange}>
              <SelectTrigger className="w-[150px] sm:w-[200px] h-9 text-sm">
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
        )}
        <SearchBar />
      </div>
    </header>
  );
}
