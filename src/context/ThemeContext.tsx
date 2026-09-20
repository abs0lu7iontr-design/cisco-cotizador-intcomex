// ============================================================================
// CISCO AUTOMATED v2.1 - GLOBAL THEME CONTEXT (CYBER HUD & ENTERPRISE)
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppTheme } from '../modules/dsv/types';

interface ThemeContextType {
  theme: AppTheme;
  toggleTheme: () => void;
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    return (localStorage.getItem('cisco_app_theme') as AppTheme) || 'cyber';
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('cisco_app_theme', newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'cyber' ? 'enterprise' : 'cyber';
      localStorage.setItem('cisco_app_theme', next);
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme debe utilizarse dentro de un ThemeProvider');
  }
  return context;
};
