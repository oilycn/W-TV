'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Info, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ContentItem } from '@/types';
import { Button } from '@/components/ui/button';

interface HeroCarouselProps {
  items: ContentItem[];
  sourceId?: string | null;
}

export function HeroCarousel({ items, sourceId }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [heroPosterSrc, setHeroPosterSrc] = useState<string | null>(null);

  const featuredItems = items?.slice(0, 5) || [];

  const handleNext = useCallback(() => {
    if (featuredItems.length <= 1) return;
    setHeroPosterSrc(null);
    setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
  }, [featuredItems.length]);

  const handlePrev = useCallback(() => {
    if (featuredItems.length <= 1) return;
    setHeroPosterSrc(null);
    setCurrentIndex((prev) => (prev - 1 + featuredItems.length) % featuredItems.length);
  }, [featuredItems.length]);

  useEffect(() => {
    if (featuredItems.length <= 1 || isPaused) return;
    const interval = setInterval(handleNext, 8000);
    return () => clearInterval(interval);
  }, [featuredItems.length, isPaused, handleNext]);

  if (!items || items.length === 0) {
    return null;
  }

  const currentItem = featuredItems[currentIndex];
  if (!currentItem) return null;

  const linkHref = sourceId 
    ? `/content/${currentItem.id}?sourceId=${sourceId}` 
    : `/content/${currentItem.id}`;

  return (
    <section 
      className="relative h-[48vh] min-h-[380px] w-full overflow-hidden bg-background md:h-[58vh] md:max-h-[640px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Image with heavy blur */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={currentItem.backdropUrl || currentItem.posterUrl}
          alt=""
          fill
          style={{ objectFit: 'cover' }}
          className="scale-125 object-cover opacity-70 blur-[26px] saturate-125 transition-all duration-1000 ease-in-out dark:opacity-50"
          unoptimized={currentItem.backdropUrl?.startsWith('https://placehold.co') || currentItem.posterUrl.startsWith('https://placehold.co') || !currentItem.posterUrl.startsWith('/')}
          priority
        />
        {/* Cinematic Gradients */}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/85 via-black/55 to-black/20"></div>
        <div className="absolute inset-0 z-10 h-full bg-gradient-to-t from-background via-background/20 to-transparent"></div>
        <div className="absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-background/60 to-transparent"></div>
      </div>

      {/* Content Layout */}
      <div className="absolute inset-0 z-20 mx-auto flex max-w-screen-3xl items-center justify-between px-6 py-8 md:px-10 lg:px-14">
        {/* Left: Text & Actions */}
        <div className="flex h-full w-full flex-col justify-center pb-8 md:w-3/5 lg:w-2/3">
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            热门推荐
          </div>
          
          <div>
            <h1 className="mb-3 line-clamp-2 text-4xl font-black text-white drop-shadow-2xl md:mb-4 md:text-5xl lg:text-6xl" title={currentItem.title}>
              {currentItem.title}
            </h1>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-white/90">
            {currentItem.userRating && currentItem.userRating > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 font-semibold text-amber-300 backdrop-blur-md">
                <Star className="h-4 w-4 fill-current text-amber-300" />
                {currentItem.userRating.toFixed(1)}
              </span>
            )}
            {currentItem.releaseYear && (
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-md">{currentItem.releaseYear}</span>
            )}
            {currentItem.genres?.slice(0, 3).map((genre) => (
              <span key={genre} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-md">{genre}</span>
            ))}
          </div>
          
          <p className="mb-6 line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/80 drop-shadow-md md:mb-8 md:text-base">
            {currentItem.description || '暂无详细影视简介。点击立即播放开始观影。'}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full bg-primary px-7 font-bold text-primary-foreground shadow-xl transition-transform hover:scale-105 hover:bg-primary/90 md:px-8">
              <Link href={linkHref}>
                <Play className="w-5 h-5 mr-2 fill-current" />
                立即播放
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-white/20 bg-white/10 px-6 font-semibold text-white shadow-md backdrop-blur-md hover:bg-white/20 md:px-7">
              <Link href={linkHref}>
                <Info className="w-5 h-5 mr-2" />
                查看详情
              </Link>
            </Button>
          </div>
        </div>

        {/* Right: Poster Image (Hidden on mobile, visible on md+) */}
        <div className="relative ml-8 hidden h-[82%] aspect-[2/3] shrink-0 overflow-hidden rounded-2xl border border-white/20 shadow-2xl transition-transform duration-500 hover:scale-102 md:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroPosterSrc || currentItem.posterUrl}
            alt={currentItem.title}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => {
              if (currentItem.posterUrl && !heroPosterSrc && !currentItem.posterUrl.startsWith('/')) {
                setHeroPosterSrc(`/api/proxy?url=${encodeURIComponent(currentItem.posterUrl)}`);
              }
            }}
          />
        </div>
      </div>

      {/* 大屏切页左右箭头 */}
      {featuredItems.length > 1 && (
        <div className="absolute right-6 bottom-8 z-30 hidden items-center gap-3 md:flex md:right-12">
          <Button
            size="icon"
            variant="outline"
            onClick={handlePrev}
            className="h-9 w-9 rounded-full border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-black/60 hover:text-white"
            aria-label="Previous item"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={handleNext}
            className="h-9 w-9 rounded-full border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-black/60 hover:text-white"
            aria-label="Next item"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 底部指示器 */}
      {featuredItems.length > 1 && (
        <div className="absolute bottom-6 left-6 z-30 flex items-center gap-2 md:bottom-8 md:left-12">
          {featuredItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-8 bg-primary shadow-md' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
