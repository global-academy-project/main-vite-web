import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY, ThemeContext } from './theme-context';

export default function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem(THEME_STORAGE_KEY) === 'dark',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode);
    localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const syncThemeAcrossTabs = (event) => {
      if (event.key === THEME_STORAGE_KEY) {
        setDarkMode(event.newValue === 'dark');
      }
    };

    window.addEventListener('storage', syncThemeAcrossTabs);
    return () => window.removeEventListener('storage', syncThemeAcrossTabs);
  }, []);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
