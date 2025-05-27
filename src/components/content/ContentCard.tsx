import type { ContentItem } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

interface ContentCardProps {
  item: ContentItem;
}

export function ContentCard({ item }: ContentCardProps) {
  const getAiHint = (currentItem: ContentItem) => {
    if (currentItem.genres && currentItem.genres.length > 0) {
      return currentItem.genres.slice(0, 2).join(" ").toLowerCase();
    }
    return currentItem.title.split(" ")[0].toLowerCase() || "movie poster";
  }

  return (
    <Link href={`/content/${item.id}`} passHref>
      <Card className="group overflow-hidden hover:shadow-xl transition-shadow duration-300 h-full flex flex-col bg-card hover:border-primary/50 border border-transparent">
        <CardHeader className="p-0 relative aspect-[2/3]">
          <Image
            src={item.posterUrl}
            alt={item.title || 'Content Poster'}
            fill
            style={{ objectFit: "cover" }}
            className="transition-transform duration-300 group-hover:scale-105"
            unoptimized={item.posterUrl.startsWith('https://placehold.co')}
            data-ai-hint={getAiHint(item)}
          />
        </CardHeader>
        <CardContent className="p-3 flex-grow">
          <CardTitle className="text-base font-semibold leading-tight mb-1 truncate text-card-foreground" title={item.title}>
            {item.title || "未知标题"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mb-2">
            {item.releaseYear || "未知年份"} &bull; {item.type === 'movie' ? '电影' : '电视剧'}
          </p>
          {item.genres && item.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {item.genres.slice(0, 2).map(genre => (
                <Badge key={genre} variant="secondary" className="text-xs">{genre}</Badge>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="p-3 pt-0">
          {item.userRating && (
            <div className="flex items-center text-sm text-amber-400">
              <Star className="w-4 h-4 mr-1 fill-current" />
              <span>{item.userRating.toFixed(1)}</span>
            </div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
