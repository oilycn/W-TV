
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
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return "dark"; // Default for SSR, will be updated on client
    }
    const storedTheme = localStorage.getItem(LOCAL_STORAGE_KEY_THEME) as Theme | null;
    if (storedTheme) {
      return storedTheme; // User preference takes precedence
    }

    // Calculate time in China (UTC+8)
    const now = new Date();
    const utcHours = now.getUTCHours();
    let chinaHour = (utcHours + 8);
    if (chinaHour >= 24) {
      chinaHour = chinaHour - 24;
    }

    if (chinaHour >= 6 && chinaHour < 18) {
      return "light";
    } else {
      return "dark";
    }
  });

  useEffect(() => {
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

  }, [theme]);

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
