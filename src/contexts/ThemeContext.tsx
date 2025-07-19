"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_THEME = 'cinemaViewTheme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 统一初始主题为 dark，避免服务端客户端不一致
  const [theme, setTheme] = useState<Theme>("dark");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // 客户端初始化时设置正确的主题
    const storedTheme = localStorage.getItem(LOCAL_STORAGE_KEY_THEME) as Theme | null;
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      // Calculate time in China (UTC+8)
      const now = new Date();
      const utcHours = now.getUTCHours();
      let chinaHour = (utcHours + 8);
      if (chinaHour >= 24) {
        chinaHour = chinaHour - 24;
      }

      if (chinaHour >= 6 && chinaHour < 18) {
        setTheme("light");
      } else {
        setTheme("dark");
      }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    
    const root = window.document.documentElement;
    const body = window.document.body;

    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    localStorage.setItem(LOCAL_STORAGE_KEY_THEME, theme);

    // After applying the theme class, get the computed background color
    const computedBackgroundColor = getComputedStyle(body).backgroundColor;

    // Update the theme-color meta tag
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', computedBackgroundColor);

  }, [theme, isInitialized]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}