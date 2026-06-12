import React from 'react';
import { useCategories } from '@/contexts/CategoryContext';
import { cn } from '@/lib/utils';
import { Film, Tv, Palette, Theater, Popcorn, Compass } from 'lucide-react';

interface CategoryNavProps {
  selectedCategoryId: string;
  onCategoryChange: (id: string) => void;
}

export function CategoryNav({ selectedCategoryId, onCategoryChange }: CategoryNavProps) {
  const { categories: globalCategories } = useCategories();

  const getIcon = (name: string) => {
    if (name.includes('电影')) return Film;
    if (name.includes('剧')) return Tv;
    if (name.includes('动漫')) return Palette;
    if (name.includes('综艺')) return Theater;
    if (name.includes('全部')) return Compass;
    return Popcorn;
  };

  return (
    <div className="w-full relative z-30 mb-6 max-w-screen-3xl mx-auto">
      <div className="w-full overflow-x-auto styled-scrollbar pb-3">
        <div className="flex w-max space-x-3 py-1 px-4 md:px-8">
          {globalCategories.map((category) => {
            const Icon = getIcon(category.name);
            const isActive = selectedCategoryId === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                  isActive 
                    ? "bg-foreground text-background shadow-md scale-105" 
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground border border-border/50"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-background" : "text-muted-foreground")} />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
