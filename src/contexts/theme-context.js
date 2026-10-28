import { createContext, useContext } from 'react';

export const THEME_STORAGE_KEY = 'dashboard-theme';
export const ThemeContext = createContext(null);

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used within ThemeProvider');
  return theme;
}
