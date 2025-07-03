"use client";

import { useEffect, useState } from 'react';
import { SearchBar } from "@/components/search/SearchBar";
import AppLogo from "./AppLogo";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings, Sun, Moon } from "lucide-react";
import { useTheme } from '@/contexts/ThemeContext';


export function AppHeader() {
  const [isClient, setIsClient] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setIsClient(true);
  }, []);
  
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
      <div className="hidden w-full items-center gap-4 md:flex">
        <Link href="/" className="mr-4">
          <AppLogo />
        </Link>
        <div className="flex-grow max-w-md">
          <SearchBar onSearchSubmit={() => {}} />
        </div>
        <div className="ml-auto flex items-center gap-2">
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
        <div className="flex items-center">
            <Link href="/">
                <AppLogo />
            </Link>
        </div>
      </div>
    </header>
  );
}
