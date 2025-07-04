import type { ContentItem } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star } from 'lucide-react';

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
    <Link href={linkHref}>
      <Card className="group overflow-hidden hover:shadow-xl transition-shadow duration-300 h-full flex flex-col bg-card hover:border-primary/50 border border-transparent">
        <CardHeader className="p-0 relative aspect-video">
          <Image
            src={item.posterUrl}
            alt={item.title || 'Content Poster'}
            fill
            style={{ objectFit: "cover" }}
            className="transition-transform duration-300 group-hover:scale-105"
            unoptimized={item.posterUrl.startsWith('https://placehold.co')}
            data-ai-hint={getAiHint(item)}
          />
          {item.remarks && (
            <div className="absolute top-2 right-2 rounded-sm bg-black/75 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
              {item.remarks}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-3 flex-grow flex flex-col">
          <CardTitle className="text-base font-semibold leading-tight truncate text-card-foreground" title={item.title}>
            {item.title || "未知标题"}
          </CardTitle>
          {sourceName && (
            <p className="text-xs font-medium text-primary mt-1 truncate" title={sourceName}>
              {sourceName}
            </p>
          )}
          <div className="flex justify-between items-center text-xs text-muted-foreground mt-auto pt-2">
            {/* Left side: Year & Genre */}
            <div className="flex items-center gap-1.5 truncate">
              {item.releaseYear && (
                <span>{item.releaseYear}</span>
              )}
              
              {item.genres && item.genres.length > 0 && (
                <>
                  {item.releaseYear && <span>&bull;</span>}
                  <span className="truncate">{item.genres[0]}</span>
                </>
              )}
            </div>

            {/* Right side: Rating */}
            {item.userRating && (
              <div className="flex items-center gap-1 text-amber-400 shrink-0 ml-2">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="font-medium">{item.userRating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
