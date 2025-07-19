import type { ContentItem } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Tv } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ContentCardProps {
  item: ContentItem;
  sourceId?: string;
  sourceName?: string;
}

export function ContentCard({ item, sourceId, sourceName }: ContentCardProps) {
  const getAiHint = (currentItem: ContentItem) => {
    if (currentItem.genres && currentItem.genres.length > 0) {
      return currentItem.genres.slice(0, 2).join(" ").toLowerCase();
    }
    return currentItem.title.split(" ")[0].toLowerCase() || "movie poster";
  }

  const linkHref = sourceId 
    ? `/content/${item.id}?sourceId=${sourceId}` 
    : `/content/${item.id}`;

  return (
    <div className="group flex flex-col h-full">
      <Link href={linkHref} className="block relative">
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted shadow-sm group-hover:shadow-xl transition-all duration-300">
          <Image
            src={item.posterUrl}
            alt={item.title || 'Content Poster'}
            fill
            style={{ objectFit: "cover" }}
            className="transition-transform duration-300 group-hover:scale-105"
            unoptimized={item.posterUrl.startsWith('https://placehold.co')}
            data-ai-hint={getAiHint(item)}
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 15vw"
          />
          
          {item.remarks && (
            <Badge 
              variant="destructive" 
              className="absolute top-2 right-2 z-10 shadow-lg"
            >
              {item.remarks}
            </Badge>
          )}

          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors duration-300"></div>
          
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-black ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
      <div className="pt-3 pb-1 flex flex-col flex-grow">
        <h3 className="font-semibold text-sm leading-tight text-foreground truncate mb-1.5" title={item.title}>
          <Link href={linkHref}>
            {item.title || "未知标题"}
          </Link>
        </h3>
        
        <div className="flex items-center text-xs text-muted-foreground gap-x-2 flex-wrap">
          {item.userRating && (
            <div className="flex items-center gap-1 text-amber-500 font-medium">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>{item.userRating.toFixed(1)}</span>
            </div>
          )}
          {item.releaseYear && <span>{item.releaseYear}</span>}
          {item.genres && item.genres.length > 0 && (
            <span className="truncate">{item.genres[0]}</span>
          )}
        </div>
        
        {sourceName && (
          <div className="mt-auto pt-2">
            <Badge variant="outline" className="flex items-center gap-1.5 w-full justify-center text-xs py-1 px-2">
              <Tv className="h-3 w-3" />
              <span className="truncate">{sourceName}</span>
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
