
"use client";

import type { ApiCategory } from '@/types';
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface CategoryContextType {
  categories: ApiCategory[];
  setCategories: (categories: ApiCategory[]) => void;
  // isLoading: boolean; // Kept for potential future use if context fetches its own data
  // error: string | null;  // Kept for potential future use
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategoriesState] = useState<ApiCategory[]>([]);
  // const [isLoading, setIsLoading] = useState<boolean>(false); 
  // const [error, setError] = useState<string | null>(null); 

  const setCategories = useCallback((newCategories: ApiCategory[]) => {
    setCategoriesState(newCategories);
  }, []);
  
  return (
    <CategoryContext.Provider value={{ categories, setCategories }}>
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
