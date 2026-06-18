'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Info, Star } from 'lucide-react';
import type { ContentItem } from '@/types';
import { Button } from '@/components/ui/button';

interface HeroCarouselProps {
  items: ContentItem[];
  sourceId?: string | null;
}

export function HeroCarousel({ items, sourceId }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!items || items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % Math.min(items.length, 5)); // max 5 items in carousel
    }, 8000);
    return () => clearInterval(interval);
  }, [items]);

  if (!items || items.length === 0) {
    return null; // Return skeleton or null if no items
  }

  const featuredItems = items.slice(0, 5);
  const currentItem = featuredItems[currentIndex];
  
  if (!currentItem) return null;

  const linkHref = sourceId 
    ? `/content/${currentItem.id}?sourceId=${sourceId}` 
    : `/content/${currentItem.id}`;

  return (
    <section className="relative h-[46vh] min-h-[360px] w-full overflow-hidden bg-background md:h-[56vh] md:max-h-[620px]">
      {/* Background Image with heavy blur */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={currentItem.backdropUrl || currentItem.posterUrl}
          alt=""
          fill
          style={{ objectFit: 'cover' }}
          className="scale-125 object-cover opacity-70 blur-[22px] saturate-125 transition-opacity duration-1000 ease-in-out dark:opacity-55"
          unoptimized={currentItem.backdropUrl?.startsWith('https://placehold.co') || currentItem.posterUrl.startsWith('https://placehold.co')}
          priority
        />
        {/* Cinematic Gradients */}
        {/* Left fade for text readability */}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/80 via-black/45 to-black/10"></div>
        {/* Bottom fade to seamlessly blend into the page */}
        <div className="absolute inset-0 z-10 h-full bg-gradient-to-t from-background via-background/10 to-transparent"></div>
        {/* Top fade to seamlessly blend with transparent header */}
        <div className="absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-background/55 to-transparent"></div>
      </div>

      {/* Content Layout */}
      <div className="absolute inset-0 z-20 mx-auto flex max-w-screen-3xl items-center justify-between px-6 py-8 md:px-8 lg:px-12">
        
        {/* Left: Text & Actions */}
        <div className="flex h-full w-full flex-col justify-center pb-8 md:w-1/2 lg:w-3/5">
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            今日焦点
          </div>
          <div className="animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out fill-mode-both stagger-1">
            <h1 className="mb-3 line-clamp-2 text-5xl font-black text-white drop-shadow-2xl md:mb-4 md:text-6xl lg:text-7xl" title={currentItem.title}>
              {currentItem.title}
            </h1>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-white/80">
            {currentItem.userRating && (
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                <Star className="h-4 w-4 fill-current text-amber-300" />
                {currentItem.userRating.toFixed(1)}
              </span>
            )}
            {currentItem.releaseYear && <span className="rounded-full bg-white/10 px-3 py-1 backdrop-blur">{currentItem.releaseYear}</span>}
            {currentItem.genres?.slice(0, 2).map((genre) => (
              <span key={genre} className="rounded-full bg-white/10 px-3 py-1 backdrop-blur">{genre}</span>
            ))}
          </div>
          
          <p className="mb-6 line-clamp-3 max-w-2xl text-sm leading-7 text-white/80 drop-shadow-md animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out fill-mode-both stagger-2 md:mb-8 md:text-base lg:text-lg">
            {currentItem.description || '暂无简介'}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out fill-mode-both stagger-3">
            <Button asChild size="lg" className="h-12 rounded-full bg-white px-6 font-bold text-black shadow-lg hover:bg-white/90 md:px-8">
              <Link href={linkHref}>
                <Play className="w-5 h-5 mr-2 fill-current" />
                立即播放
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-white/20 bg-black/20 px-6 font-bold text-white backdrop-blur-md hover:bg-black/40 md:px-8">
              <Link href={linkHref}>
                <Info className="w-5 h-5 mr-2" />
                更多信息
              </Link>
            </Button>
          </div>
        </div>

        {/* Right: Poster Image (Hidden on mobile, visible on md+) */}
        <div className="relative ml-8 hidden h-[78%] aspect-[2/3] shrink-0 overflow-hidden rounded-xl border border-white/15 shadow-2xl md:block">
          <Image
            src={currentItem.posterUrl}
            alt={currentItem.title}
            fill
            style={{ objectFit: 'cover' }}
            unoptimized={currentItem.posterUrl.startsWith('https://placehold.co')}
            sizes="(max-width: 1024px) 30vw, 20vw"
            priority
          />
        </div>

      </div>

      {/* Carousel Indicators */}
      {featuredItems.length > 1 && (
        <div className="absolute bottom-8 right-6 md:right-12 flex items-center gap-2 z-30">
          {featuredItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentIndex ? 'w-8 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'w-2 bg-white/30 hover:bg-white/60'}`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
