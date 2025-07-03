"use client";

import { useCategories } from '@/contexts/CategoryContext';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Suspense } from 'react';

function CategoriesPageContent() {
    const { categories } = useCategories();

    // Remove 'all' category for the display grid, as this page is for choosing a specific one.
    const displayCategories = categories.filter(c => c.id !== 'all');

    if (categories.length <= 1) { // Only 'all' or empty
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                 {Array.from({ length: 12 }).map((_, index) => (
                     <Skeleton key={index} className="h-16 w-full" />
                 ))}
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayCategories.map(category => (
                <Button key={category.id} variant="outline" className="h-16 text-base" asChild>
                    <Link href={`/?category=${category.id}`}>{category.name}</Link>
                </Button>
            ))}
        </div>
    );
}


export default function CategoriesPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                分类浏览
            </h1>
            <Suspense fallback={
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                     {Array.from({ length: 12 }).map((_, index) => (
                         <Skeleton key={index} className="h-16 w-full" />
                     ))}
                </div>
            }>
                <CategoriesPageContent />
            </Suspense>
        </div>
    );
}
