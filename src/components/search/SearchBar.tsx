"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

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
        // A small delay can help ensure the element is fully rendered and transitions are complete
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

  return (
    <form onSubmit={handleSearch} className="relative w-full">
      <Input
        ref={inputRef}
        type="search"
        placeholder="搜索电影、电视剧..."
        className="pr-10 h-9"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Button type="submit" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9" aria-label="搜索">
        <Search className="h-4 w-4" />
      </Button>
    </form>
  );
}
