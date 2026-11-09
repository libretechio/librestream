import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/figtree';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';

import './palettes.css';
import './tokens.css';
import './browser.css';
import { App } from './App.jsx';
import { PALETTES, DEFAULT_PREFERENCES, applyPaletteToDOM } from './palettes.js';

function getInitialPrefs() {
  try {
    const savedPalette = localStorage.getItem('librestream:active_palette');
    const savedAccent = localStorage.getItem('librestream:active_accent');
    const savedFont = localStorage.getItem('librestream:active_font');
    const palette = PALETTES.find((entry) => entry.id === savedPalette) || PALETTES[0];
    return {
      ...DEFAULT_PREFERENCES,
      palette: palette.id,
      accent: savedAccent || palette.accent,
      font: savedFont || palette.defaultFont || 'graphite'
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

const initialPrefs = getInitialPrefs();
applyPaletteToDOM(initialPrefs);

function Root() {
  const [themePrefs, setThemePrefs] = useState(initialPrefs);

  useEffect(() => {
    applyPaletteToDOM(themePrefs);
  }, [themePrefs]);

  return <App onThemeChange={setThemePrefs} />;
}

createRoot(document.getElementById('root')).render(<Root />);
