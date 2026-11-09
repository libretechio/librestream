export const FONT_PRESETS = [
  {
    id: 'graphite',
    name: 'Figtree + JetBrains',
    badge: 'Figtree / JBSans',
    description: 'Figtree for titles and interface, JetBrains Sans for numerals, badges and timecodes',
    heading: '"Figtree Variable", "JBSans", system-ui, sans-serif',
    body: '"Figtree Variable", "JBSans", system-ui, sans-serif',
    numeric: '"JBSans", "JetBrains Sans", system-ui, sans-serif',
    code: '"JetBrains Mono Variable", monospace'
  },
  {
    id: 'nuvio',
    name: 'JetBrains Sans',
    badge: 'JBSans',
    description: 'Single grotesque everywhere, including numerals',
    heading: '"JBSans", system-ui, sans-serif',
    body: '"JBSans", system-ui, sans-serif',
    numeric: '"JBSans", system-ui, sans-serif',
    code: '"JetBrains Mono Variable", monospace'
  },
  {
    id: 'geometric',
    name: 'Space Grotesk',
    badge: 'Grotesk + Figtree',
    description: 'Technical geometric headings, Figtree body, JetBrains numerals',
    heading: '"Space Grotesk Variable", "Figtree Variable", system-ui, sans-serif',
    body: '"Figtree Variable", "JBSans", system-ui, sans-serif',
    numeric: '"JBSans", system-ui, sans-serif',
    code: '"JetBrains Mono Variable", monospace'
  }
];

export const PALETTES = [
  {
    id: 'graphite',
    name: 'Warm Graphite',
    category: 'LibreStream',
    mode: 'dark',
    defaultFont: 'graphite',
    description: 'Warm graphite surfaces, white actions, mint for cached. Film-stock warmth.',
    swatches: ['#0F0E0D', '#151311', '#1D1A17', '#F6F2EC', '#5EEAD4'],
    accent: '#ffffff',
    accentSecondary: '#5EEAD4',
    onAccent: '#0a0a0c',
    tokens: {
      body: '#0F0E0D',
      surface: '#151311',
      card: '#1D1A17',
      popover: '#211D1A',
      muted: '#0C0B0A',
      textPrimary: '#F6F2EC',
      textSecondary: '#AEA69C',
      border: 'rgba(255, 255, 255, 0.08)',
      borderEmphasized: 'rgba(255, 255, 255, 0.13)'
    }
  },
  {
    id: 'obsidian',
    name: 'Obsidian Noir',
    category: 'LibreStream',
    mode: 'dark',
    defaultFont: 'graphite',
    description: 'Pure neutral near-black, white actions, teal for cached.',
    swatches: ['#0E0E10', '#131315', '#1C1B1E', '#F5F5F7', '#2DD4BF'],
    accent: '#ffffff',
    accentSecondary: '#2DD4BF',
    onAccent: '#0a0a0c',
    tokens: {
      body: '#0E0E10',
      surface: '#131315',
      card: '#1C1B1E',
      popover: '#202024',
      muted: '#0B0B0D',
      textPrimary: '#F5F5F7',
      textSecondary: '#A1A1AA',
      border: 'rgba(255, 255, 255, 0.08)',
      borderEmphasized: 'rgba(255, 255, 255, 0.13)'
    }
  },
  {
    id: 'bluehour',
    name: 'Blue Hour',
    category: 'LibreStream',
    mode: 'dark',
    defaultFont: 'graphite',
    description: 'Cool slate-black with colder ink and ice-blue cached markers.',
    swatches: ['#0A0C11', '#101319', '#171B23', '#F1F4F9', '#7DD3FC'],
    accent: '#ffffff',
    accentSecondary: '#7DD3FC',
    onAccent: '#0a0a0c',
    tokens: {
      body: '#0A0C11',
      surface: '#101319',
      card: '#171B23',
      popover: '#1B2029',
      muted: '#080A0E',
      textPrimary: '#F1F4F9',
      textSecondary: '#9AA3B2',
      border: 'rgba(255, 255, 255, 0.08)',
      borderEmphasized: 'rgba(255, 255, 255, 0.13)'
    }
  }
];

export const DEFAULT_PREFERENCES = {
  layout: 'premiere',
  posterShape: 'poster',
  player: 'compact',
  palette: 'graphite',
  accent: '#ffffff',
  font: 'graphite'
};

export function applyPaletteToDOM(prefs = DEFAULT_PREFERENCES) {
  if (typeof document === 'undefined') return;
  const pal = PALETTES.find((p) => p.id === prefs.palette) || PALETTES[0];
  const fontObj = FONT_PRESETS.find((f) => f.id === (prefs.font || pal.defaultFont)) || FONT_PRESETS[0];
  const accent = prefs.accent || pal.accent;
  const t = pal.tokens;

  const root = document.documentElement;
  root.setAttribute('data-palette', pal.id);
  root.setAttribute('data-theme', pal.mode || 'dark');
  root.setAttribute('data-font', fontObj.id);
  root.style.colorScheme = pal.mode || 'dark';

  const vars = {
    '--ls-cached': pal.accentSecondary || '#5eead4',
    '--ls-accent': accent,
    '--ls-accent-secondary': pal.accentSecondary || accent,
    '--ls-on-accent': pal.onAccent || (pal.mode === 'light' ? '#ffffff' : '#111111'),
    '--ls-ambient-glow': t.glow,
    '--color-background-body': t.body,
    '--color-background-surface': t.surface,
    '--color-background-card': t.card,
    '--color-background-popover': t.popover,
    '--color-background-muted': t.muted,
    '--color-accent': accent,
    '--color-on-accent': pal.onAccent || (pal.mode === 'light' ? '#ffffff' : '#111111'),
    '--color-accent-muted': t.borderEmphasized,
    '--color-text-primary': t.textPrimary,
    '--color-text-secondary': t.textSecondary,
    '--color-text-accent': accent,
    '--color-icon-primary': t.textPrimary,
    '--color-icon-secondary': t.textSecondary,
    '--color-icon-accent': accent,
    '--color-border': t.border,
    '--color-border-emphasized': t.borderEmphasized,
    '--font-family-heading': fontObj.heading,
    '--font-family-body': fontObj.body,
    '--font-family-code': fontObj.code,
    '--font-family-num': fontObj.numeric || fontObj.body
  };

  const targets = [root, document.body].filter(Boolean);

  for (const el of targets) {
    for (const [k, v] of Object.entries(vars)) {
      el.style.setProperty(k, v);
    }
  }
}
