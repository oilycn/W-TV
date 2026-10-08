"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearchSubmit?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({ onSearchSubmit, autoFocus = false }: SearchBarProps) {
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Update query state if URL 'q' parameter changes (e.g., on /search page)
  useEffect(() => {
    setQuery(decodeURIComponent(currentSearchParams.get('q') || ''));
  }, [currentSearchParams]);

  // Autofocus the input when it becomes visible
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    
    if (onSearchSubmit) {
      onSearchSubmit();
    }
    
    if (trimmedQuery) {
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`, { scroll: false });
    } else {
      router.push(`/search`, { scroll: false });
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full">
      <Input
        ref={inputRef}
        type="text"
        placeholder="搜索电影、电视剧、综艺..."
        className="h-10 rounded-full border-border/60 bg-muted/40 pl-4 pr-16 shadow-sm backdrop-blur-md placeholder:text-muted-foreground/70 transition-all duration-200 focus:bg-background focus:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/30"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      
      {query.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label="清空输入"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <Button 
        type="submit" 
        variant="ghost" 
        size="icon" 
        className="absolute right-0.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full hover:bg-transparent hover:text-primary transition-colors" 
        aria-label="搜索"
      >
        <Search className="h-4 w-4" />
      </Button>
    </form>
  );
}
