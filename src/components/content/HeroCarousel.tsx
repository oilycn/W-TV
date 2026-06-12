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
    <div className="relative w-full h-[40vh] md:h-[50vh] max-h-[500px] min-h-[300px] overflow-hidden group bg-background">
      {/* Background Image with heavy blur */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={currentItem.backdropUrl || currentItem.posterUrl}
          alt=""
          fill
          style={{ objectFit: 'cover' }}
          className="transition-opacity duration-1000 ease-in-out blur-[40px] scale-150 opacity-40 dark:opacity-50"
          unoptimized={currentItem.backdropUrl?.startsWith('https://placehold.co') || currentItem.posterUrl.startsWith('https://placehold.co')}
          priority
        />
        {/* Cinematic Gradients */}
        {/* Left fade for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent w-full md:w-3/4 z-10"></div>
        {/* Bottom fade to seamlessly blend into the page */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10 h-full"></div>
        {/* Top fade to seamlessly blend with transparent header */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-background/80 to-transparent z-10"></div>
        <div className="absolute inset-0 bg-black/40 dark:bg-black/20 z-10"></div>
      </div>

      {/* Content Layout */}
      <div className="absolute inset-0 flex items-center justify-between px-6 md:px-12 lg:px-24 py-8 md:py-16 z-20 max-w-[2000px] mx-auto">
        
        {/* Left: Text & Actions */}
        <div className="flex flex-col justify-center h-full w-full md:w-1/2 lg:w-3/5 pb-8">
          <div className="animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out fill-mode-both stagger-1">
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-black text-white mb-3 md:mb-4 line-clamp-2 drop-shadow-2xl tracking-tight" title={currentItem.title}>
              {currentItem.title}
            </h1>
          </div>
          
          <p className="text-sm md:text-base lg:text-lg text-white/80 line-clamp-3 mb-6 md:mb-8 max-w-2xl leading-relaxed drop-shadow-md animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out fill-mode-both stagger-2">
            {currentItem.description || '暂无简介'}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out fill-mode-both stagger-3">
            <Button asChild size="lg" className="bg-white text-black hover:bg-white/90 font-bold rounded-full px-6 md:px-8 h-12 shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all hover:scale-105">
              <Link href={linkHref}>
                <Play className="w-5 h-5 mr-2 fill-current" />
                立即播放
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-black/20 text-white hover:bg-black/40 border-white/20 backdrop-blur-md font-bold rounded-full px-6 md:px-8 h-12 transition-all hover:scale-105">
              <Link href={linkHref}>
                <Info className="w-5 h-5 mr-2" />
                更多信息
              </Link>
            </Button>
          </div>
        </div>

        {/* Right: Poster Image (Hidden on mobile, visible on md+) */}
        <div className="hidden md:block relative h-[85%] aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 shrink-0 ml-8 transition-transform duration-700 hover:scale-105 hover:-translate-y-2 hover:rotate-1 hover:shadow-[0_30px_60px_rgba(var(--primary),0.2)] animate-in zoom-in-95 fade-in duration-1000 ease-out fill-mode-both stagger-4">
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
    </div>
  );
}
