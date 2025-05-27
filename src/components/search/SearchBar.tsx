
"use client";

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export function SearchBar() {
  const router = useRouter();
  const currentPathname = usePathname();
  const currentSearchParams = useSearchParams();
  const [query, setQuery] = useState(currentSearchParams.get('q') || '');


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    const newParams = new URLSearchParams(currentSearchParams.toString());

    if (trimmedQuery) {
      newParams.set('q', encodeURIComponent(trimmedQuery));
      newParams.set('page', '1'); // Reset to page 1 for new search
    } else {
      newParams.delete('q'); // Remove search query if input is empty
    }

    // Always target the homepage for search functionality for this app's design
    const targetPath = '/';
    
    // Preserve activeSourceTrigger if it exists
    const activeSourceTrigger = currentSearchParams.get('activeSourceTrigger');
    if (activeSourceTrigger && !newParams.has('activeSourceTrigger')) {
        newParams.set('activeSourceTrigger', activeSourceTrigger);
    }
    
    router.push(`${targetPath}?${newParams.toString()}`, { scroll: false });
  };

  // Update query state if URL changes externally
  React.useEffect(() => {
    setQuery(currentSearchParams.get('q') || '');
  }, [currentSearchParams]);

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
