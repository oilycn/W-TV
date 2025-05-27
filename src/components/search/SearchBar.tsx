
"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export function SearchBar() {
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const [query, setQuery] = useState(''); // Initialize with empty string

  // Update query state if URL changes externally
  useEffect(() => {
    setQuery(decodeURIComponent(currentSearchParams.get('q') || ''));
  }, [currentSearchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('SearchBar: handleSearch triggered. Current query state:', query);
    const trimmedQuery = query.trim();
    
    // Start with current params to preserve things like activeSourceTrigger
    const params = new URLSearchParams(currentSearchParams.toString()); 

    if (trimmedQuery) {
      params.set('q', trimmedQuery); // URLSearchParams handles encoding
    } else {
      params.delete('q');
    }
    params.set('page', '1'); // Always reset to page 1 for a new search
    params.set('searchTrigger', Date.now().toString()); // Add a trigger to ensure effect runs

    const targetPath = '/'; // Always search on the homepage
    const newSearchString = params.toString();
    
    console.log('SearchBar: Pushing to path:', targetPath, 'Search string:', newSearchString);
    router.push(`${targetPath}?${newSearchString}`, { scroll: false });
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
