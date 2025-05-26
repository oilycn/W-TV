
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchBar } from "@/components/search/SearchBar";
import AppLogo from "./AppLogo";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <SidebarTrigger />
        <Link href="/">
          <AppLogo />
        </Link>
      </div>
      <div className="hidden md:flex items-center">
        {/* Optional: Could add breadcrumbs or page title here */}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <SearchBar />
        <Button variant="ghost" size="icon" asChild aria-label="设置">
          <Link href="/settings">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
        {/* User profile / other actions can go here */}
      </div>
    </header>
  );
}
