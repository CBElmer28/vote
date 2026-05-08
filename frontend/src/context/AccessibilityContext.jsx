import { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext();

export const AccessibilityProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('accessibility-settings');
    return saved ? JSON.parse(saved) : {
      theme: 'light',
      font: 'normal', // 'normal', 'dyslexic'
      colorProfile: 'default', // 'default', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'
      adhdMode: false, // Reading mask
      textScale: 1, // 1, 1.2, 1.5
      highContrast: false,
      reducedMotion: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
    
    // Apply settings to document
    const root = document.documentElement;
    
    // Theme
    root.setAttribute('data-theme', settings.theme);
    
    // Color Profile
    root.setAttribute('data-color-profile', settings.colorProfile);
    
    // Font
    root.setAttribute('data-font', settings.font);
    
    // High Contrast
    if (settings.highContrast) root.classList.add('high-contrast');
    else root.classList.remove('high-contrast');
    
    // Text Scale
    root.style.setProperty('--text-scale', settings.textScale);
    root.style.fontSize = `${settings.textScale * 100}%`;
    root.setAttribute('data-text-scale', settings.textScale);
    
    // Reduced Motion
    if (settings.reducedMotion) root.classList.add('reduced-motion');
    else root.classList.remove('reduced-motion');

    // ADHD Mode (controlled via component, but could set a global class)
    if (settings.adhdMode) root.classList.add('adhd-mode');
    else root.classList.remove('adhd-mode');

  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleTheme = () => {
    updateSetting('theme', settings.theme === 'light' ? 'dark' : 'light');
  };

  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting, toggleTheme }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext);
