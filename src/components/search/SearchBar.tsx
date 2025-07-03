
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearchSubmit?: () => void;
}

export function SearchBar({ onSearchSubmit }: SearchBarProps) {
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const [query, setQuery] = useState('');

  // Update query state if URL 'q' parameter changes (e.g., on /search page)
  useEffect(() => {
    setQuery(decodeURIComponent(currentSearchParams.get('q') || ''));
  }, [currentSearchParams]);

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
