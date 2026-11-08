import React from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import {librestreamTheme} from './themes/librestream.js';
import './themes/librestream.css';
import './palettes.css';
import '@fontsource-variable/figtree';
import {App} from './App.jsx';
import './browser.css';

// Pre-initialize palette before render to avoid theme flash
try {
  const saved = localStorage.getItem('librestream:active_palette');
  const accent = localStorage.getItem('librestream:active_accent');
  if (saved) document.documentElement.setAttribute('data-palette', saved);
  if (accent) document.documentElement.style.setProperty('--ls-accent', accent);
} catch {}

createRoot(document.getElementById('root')).render(<Theme theme={librestreamTheme} mode="dark"><App/></Theme>);

