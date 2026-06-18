"use client";

import { useState, useEffect, useRef } from 'react';

function getValue<T>(key: string, initialValue: T | (() => T)): T {
  if (typeof window === 'undefined') {
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  }
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : (typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue);
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  }
}

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
  const initialValueRef = useRef(initialValue);
  const [storedValue, setStoredValue] = useState<T>(() => {
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setStoredValue(getValue(key, initialValueRef.current));
    setIsHydrated(true);
  }, [key]);

  useEffect(() => {
    if (typeof window !== 'undefined' && isHydrated) {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    }
  }, [key, storedValue, isHydrated]);
  
  // Effect to update state if localStorage changes in another tab/window
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          setStoredValue(JSON.parse(event.newValue));
        } catch (error) {
          console.warn(`Error parsing localStorage change for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  return [storedValue, setStoredValue];
}
