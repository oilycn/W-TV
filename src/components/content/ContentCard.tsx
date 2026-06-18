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
    <div className="group flex h-full flex-col">
      <Link href={linkHref} prefetch={false} className="block relative h-full">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border/60 bg-muted/40 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-foreground/20 group-hover:shadow-xl">
          <Image
            src={item.posterUrl}
            alt={item.title || 'Content Poster'}
            fill
            style={{ objectFit: "cover" }}
            className="transition-transform duration-500 ease-out group-hover:scale-105"
            unoptimized={item.posterUrl.startsWith('https://placehold.co')}
            data-ai-hint={getAiHint(item)}
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 15vw"
          />
          
          {item.remarks && (
            <div className="absolute right-2 top-2 z-20 max-w-[80%] truncate rounded-md border border-white/15 bg-black/70 px-2 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur">
              {item.remarks}
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
          
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/20 shadow-lg backdrop-blur-md">
              <svg className="ml-1 h-6 w-6 text-white drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
      <div className="flex flex-grow flex-col pb-1 pt-2.5">
        <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground" title={item.title}>
          <Link href={linkHref} prefetch={false}>
            {item.title || "未知标题"}
          </Link>
        </h3>
        
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
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
            <Badge variant="outline" className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs">
              <Tv className="h-3 w-3" />
              <span className="truncate">{sourceName}</span>
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
