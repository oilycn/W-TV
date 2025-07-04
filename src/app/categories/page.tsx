"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * This page is deprecated as category browsing is now handled
 * in the modal that opens from the AppHeader on mobile.
 * This component redirects any user who lands here to the homepage.
 */
export default function DeprecatedCategoriesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  // Render nothing while the redirect is happening
  return null;
}
