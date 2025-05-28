
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export function SearchBar() {
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
    
    if (trimmedQuery) {
      // Navigate to the dedicated search page with the query
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`, { scroll: false });
    } else {
      // If query is empty, navigate to search page without query, or handle as desired
      // For now, navigating to /search which might show a prompt to enter a search term
      router.push(`/search`, { scroll: false });
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-md">
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
