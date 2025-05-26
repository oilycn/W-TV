
"use client";

import type { ApiCategory } from '@/types';
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface CategoryContextType {
  categories: ApiCategory[];
  setCategories: (categories: ApiCategory[]) => void;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

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

  const setCategories = useCallback((newCategories: ApiCategory[]) => {
    setCategoriesState(prevCategories => {
      if (arraysEqual(prevCategories, newCategories)) {
        return prevCategories; // Return the old state to prevent re-render if categories are the same
      }
      return newCategories; // Update state only if categories have actually changed
    });
  }, []); // Empty dependency array means setCategories function itself is stable
  
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
