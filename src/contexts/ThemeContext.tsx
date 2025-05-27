
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
    // Get current UTC hour
    const utcHours = now.getUTCHours();
    // Calculate China Standard Time hour (UTC+8)
    // The calculation (utcHours + 8) can result in values >= 24 or negative if we were subtracting.
    // A simple way to handle this correctly for a 24-hour cycle is:
    let chinaHour = (utcHours + 8);
    if (chinaHour >= 24) {
      chinaHour = chinaHour - 24;
    } else if (chinaHour < 0) { // Should not happen with +8 but good for general timezone math
      chinaHour = chinaHour + 24;
    }
    // Alternative using toLocaleString which is more robust for timezones, but might be slightly heavier.
    // For simplicity and direct hour check, manual offset is fine if DST is not a concern for UTC+8.
    // const chinaTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Shanghai", hour12: false, hour: 'numeric' });
    // const chinaHour = parseInt(chinaTimeStr, 10);


    if (chinaHour >= 6 && chinaHour < 18) {
      return "light";
    } else {
      return "dark";
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_THEME, theme);
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
