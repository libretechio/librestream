import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Theme } from '@astryxdesign/core/theme';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';

import { gothicTheme } from '@astryxdesign/theme-gothic/built';
import '@astryxdesign/theme-gothic/theme.css';
import { chocolateTheme } from '@astryxdesign/theme-chocolate/built';
import '@astryxdesign/theme-chocolate/theme.css';
import { stoneTheme } from '@astryxdesign/theme-stone/built';
import '@astryxdesign/theme-stone/theme.css';
import { matchaTheme } from '@astryxdesign/theme-matcha/built';
import '@astryxdesign/theme-matcha/theme.css';
import { butterTheme } from '@astryxdesign/theme-butter/built';
import '@astryxdesign/theme-butter/theme.css';
import { librestreamTheme } from './themes/librestream.js';
import './themes/librestream.css';

import '@fontsource-variable/figtree';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';

import './palettes.css';
import './tokens.css';
import './browser.css';
import { App } from './App.jsx';
import { PALETTES, DEFAULT_PREFERENCES, applyPaletteToDOM } from './palettes.js';

const ASTRYX_THEMES = {
  gothic: gothicTheme,
  chocolate: chocolateTheme,
  stone: stoneTheme,
  matcha: matchaTheme,
  butter: butterTheme,
  librestream: librestreamTheme
};

function getInitialPrefs() {
  try {
    const savedPalette = localStorage.getItem('librestream:active_palette');
    const savedAccent = localStorage.getItem('librestream:active_accent');
    const savedFont = localStorage.getItem('librestream:active_font');
    const pal = PALETTES.find((p) => p.id === savedPalette) || PALETTES[0];
    return {
      ...DEFAULT_PREFERENCES,
      palette: pal.id,
      accent: savedAccent || pal.accent,
      font: savedFont || pal.defaultFont || 'nuvio'
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

const initialPrefs = getInitialPrefs();
applyPaletteToDOM(initialPrefs);

function Root() {
  const [themePrefs, setThemePrefs] = useState(initialPrefs);
  const pal = PALETTES.find((p) => p.id === themePrefs.palette) || PALETTES[0];
  const astryxThemeObj = ASTRYX_THEMES[pal.astryxTheme] || chocolateTheme;
  const mode = pal.mode || 'dark';

  useEffect(() => {
    applyPaletteToDOM(themePrefs);
  }, [themePrefs]);

  return (
    <Theme theme={astryxThemeObj} mode={mode}>
      <App onThemeChange={setThemePrefs} />
    </Theme>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
