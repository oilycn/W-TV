
"use client";

import type { ApiCategory, SourceConfig } from '@/types';
import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { fetchApiCategories, getMockApiCategories } from '@/lib/content-loader';

interface CategoryContextType {
  categories: ApiCategory[];
  setCategories: (categories: ApiCategory[]) => void;
  pageTitle: string;
  setPageTitle: (title: string) => void;
  activeSourceId: string | null;
  setActiveSourceId: (id: string | null) => void;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';


function arraysEqual(arr1: ApiCategory[], arr2: ApiCategory[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i].id !== arr2[i].id || arr1[i].name !== arr2[i].name) {
      return false;
    }
  }
  return true;
}

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategoriesState] = useState<ApiCategory[]>([]);
  const [pageTitle, setPageTitle] = useState('');
  const [sources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [activeSourceId, setActiveSourceId] = useLocalStorage<string | null>(LOCAL_STORAGE_KEY_ACTIVE_SOURCE, null);

  const activeSourceUrl = useMemo(() => {
    if (activeSourceId) {
      const source = sources.find(s => s.id === activeSourceId);
      if (source) return source.url;
    }
    if (sources.length > 0 && sources[0]) {
      return sources[0].url;
    }
    return null;
  }, [sources, activeSourceId]);


  const setCategories = useCallback((newCategories: ApiCategory[]) => {
    setCategoriesState(prevCategories => {
      if (arraysEqual(prevCategories, newCategories)) {
        return prevCategories; // Return the old state to prevent re-render if categories are the same
      }
      return newCategories; // Update state only if categories have actually changed
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      if (activeSourceUrl) {
        try {
          const fetchedCategories = await fetchApiCategories(activeSourceUrl);
          if (isMounted) {
            setCategories(fetchedCategories);
          }
        } catch (e) {
          console.error("Failed to load categories in provider", e);
          if (isMounted) {
            setCategories(getMockApiCategories());
          }
        }
      } else {
        if (isMounted) {
          // If no source is active (e.g., user cleared all), show mock categories as placeholder
          setCategories(getMockApiCategories());
        }
      }
    };
    loadCategories();
    return () => { isMounted = false; }
  }, [activeSourceUrl, setCategories]);
  
  const value = { categories, setCategories, pageTitle, setPageTitle, activeSourceId, setActiveSourceId };
  
  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoryProvider');
  }
  return context;
}
