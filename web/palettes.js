export const FONT_PRESETS = [
  {
    id: 'oxblood',
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
    name: 'Nuvio Sans',
    badge: 'JetBrains Sans',
    description: 'Authentic Nuvio Android & Desktop grotesque with crisp tabular numerals',
    heading: '"JetBrains Sans", "Plus Jakarta Sans Variable", system-ui, sans-serif',
    body: '"JetBrains Sans", "Plus Jakarta Sans Variable", system-ui, sans-serif',
    code: '"JetBrains Mono Variable", monospace'
  },
  {
    id: 'editorial',
    name: 'Cinema Editorial',
    badge: 'Fraunces + Jakarta',
    description: 'Expressive optical-size display serif headings with clean geometric body copy',
    heading: '"Fraunces Variable", Georgia, serif',
    body: '"Plus Jakarta Sans Variable", "JetBrains Sans", system-ui, sans-serif',
    code: '"JetBrains Mono Variable", monospace'
  },
  {
    id: 'geometric',
    name: 'Modern Studio',
    badge: 'Space Grotesk',
    description: 'Technical widescreen display headings paired with high-legibility UI text',
    heading: '"Space Grotesk Variable", "JetBrains Sans", system-ui, sans-serif',
    body: '"Plus Jakarta Sans Variable", "JetBrains Sans", system-ui, sans-serif',
    code: '"JetBrains Mono Variable", monospace'
  },
  {
    id: 'astryx',
    name: 'Astryx Native',
    badge: 'Figtree Variable',
    description: 'Balanced humanist sans from the core Astryx system',
    heading: '"Figtree Variable", system-ui, sans-serif',
    body: '"Figtree Variable", system-ui, sans-serif',
    code: '"JetBrains Mono Variable", monospace'
  }
];

export const PALETTES = [
  {
    id: 'oxblood',
    name: 'Oxblood',
    category: 'LibreStream',
    astryxTheme: 'chocolate',
    mode: 'dark',
    defaultFont: 'oxblood',
    description: 'Cinema red on warm near-black. Artwork first, one accent, no decoration',
    swatches: ['#120d0d', '#231a1a', '#c0524a', '#f7ecea'],
    accent: '#c0524a',
    accentSecondary: '#d97b70',
    onAccent: '#ffffff',
    tokens: {
      body: '#120d0d',
      surface: '#1a1414',
      card: '#231a1a',
      popover: '#2b2020',
      muted: '#161010',
      textPrimary: '#f7ecea',
      textSecondary: '#c9a5a0',
      border: 'rgba(247, 236, 234, 0.11)',
      borderEmphasized: 'rgba(247, 236, 234, 0.24)',
      glow: 'rgba(192, 82, 74, 0.20)'
    },
  },
  {
    id: 'nuvio-gold',
    name: 'Nuvio Gold',
    category: 'Nuvio Signature',
    astryxTheme: 'chocolate',
    mode: 'dark',
    defaultFont: 'nuvio',
    description: 'Signature Nuvio warm obsidian canvas with burnished cinema gold accents',
    swatches: ['#0f0e0b', '#1d1a14', '#e8a91c', '#ffd45c'],
    accent: '#e8a91c',
    accentSecondary: '#ffd45c',
    onAccent: '#111111',
    tokens: {
      body: '#0f0e0b',
      surface: '#181510',
      card: '#241f16',
      popover: '#262118',
      muted: '#14120d',
      textPrimary: '#f7f4ec',
      textSecondary: '#b8ae99',
      border: 'rgba(255, 212, 92, 0.14)',
      borderEmphasized: 'rgba(232, 169, 28, 0.38)',
      glow: 'rgba(232, 169, 28, 0.22)'
    },
    accents: [
      { id: 'gold', name: 'Cinema Gold', color: '#e8a91c' },
      { id: 'sun', name: 'Solar Gold', color: '#ffd45c' },
      { id: 'amber', name: 'Amber', color: '#f59e0b' },
      { id: 'copper', name: 'Copper', color: '#ea580c' }
    ]
  },
  {
    id: 'nuvio-arctic',
    name: 'Nuvio Arctic Blue',
    category: 'Nuvio Signature',
    astryxTheme: 'gothic',
    mode: 'dark',
    defaultFont: 'nuvio',
    description: 'Deep midnight slate with electric cyan-blue Nuvio highlights',
    swatches: ['#0b0e14', '#141a24', '#3185f5', '#4de3ff'],
    accent: '#4de3ff',
    accentSecondary: '#3185f5',
    onAccent: '#071018',
    tokens: {
      body: '#0b0e14',
      surface: '#121822',
      card: '#182130',
      popover: '#1b2536',
      muted: '#0e131b',
      textPrimary: '#f0f6ff',
      textSecondary: '#94a8c4',
      border: 'rgba(77, 227, 255, 0.14)',
      borderEmphasized: 'rgba(49, 133, 245, 0.42)',
      glow: 'rgba(49, 133, 245, 0.25)'
    },
    accents: [
      { id: 'cyan', name: 'Arctic Cyan', color: '#4de3ff' },
      { id: 'blue', name: 'Cobalt Blue', color: '#3185f5' },
      { id: 'indigo', name: 'Indigo', color: '#6366f1' },
      { id: 'sky', name: 'Sky', color: '#38bdf8' }
    ]
  },
  {
    id: 'nuvio-jade',
    name: 'Nuvio Jade',
    category: 'Nuvio Signature',
    astryxTheme: 'matcha',
    mode: 'dark',
    defaultFont: 'nuvio',
    description: 'Rich emerald bio-luminescence on dark botanical obsidian',
    swatches: ['#0b0f0d', '#141d18', '#22d37c', '#7bf08d'],
    accent: '#22d37c',
    accentSecondary: '#0bbf9a',
    onAccent: '#06130c',
    tokens: {
      body: '#0b0f0d',
      surface: '#121a16',
      card: '#18251e',
      popover: '#1b2a22',
      muted: '#0e1411',
      textPrimary: '#ecfdf5',
      textSecondary: '#92b4a3',
      border: 'rgba(34, 211, 124, 0.15)',
      borderEmphasized: 'rgba(34, 211, 124, 0.4)',
      glow: 'rgba(34, 211, 124, 0.22)'
    },
    accents: [
      { id: 'jade', name: 'Jade', color: '#22d37c' },
      { id: 'mint', name: 'Neon Mint', color: '#7bf08d' },
      { id: 'teal', name: 'Teal', color: '#0bbf9a' }
    ]
  },
  {
    id: 'nuvio-rose-gold',
    name: 'Nuvio Rose Gold',
    category: 'Nuvio Signature',
    astryxTheme: 'chocolate',
    mode: 'dark',
    defaultFont: 'editorial',
    description: 'Velvet plum darkness paired with warm rose-gold & sunset violet',
    swatches: ['#100c0f', '#1f161d', '#ec70a9', '#ffb37a'],
    accent: '#ec70a9',
    accentSecondary: '#b75aff',
    onAccent: '#16070e',
    tokens: {
      body: '#100c0f',
      surface: '#1a1218',
      card: '#261a23',
      popover: '#2b1d28',
      muted: '#140f13',
      textPrimary: '#fdf2f8',
      textSecondary: '#bfa0b3',
      border: 'rgba(236, 112, 169, 0.16)',
      borderEmphasized: 'rgba(236, 112, 169, 0.42)',
      glow: 'rgba(236, 112, 169, 0.24)'
    },
    accents: [
      { id: 'rosegold', name: 'Rose Gold', color: '#ec70a9' },
      { id: 'peach', name: 'Sunset Peach', color: '#ffb37a' },
      { id: 'orchid', name: 'Orchid', color: '#b75aff' }
    ]
  },
  {
    id: 'amoled-black',
    name: 'AMOLED Pitch Black',
    category: 'Nuvio Signature',
    astryxTheme: 'gothic',
    mode: 'dark',
    defaultFont: 'nuvio',
    description: 'True #000000 OLED zero-backlight canvas with crisp high-contrast edges',
    swatches: ['#000000', '#0c0d10', '#ffd45c', '#ffffff'],
    accent: '#ffd45c',
    accentSecondary: '#38bdf8',
    onAccent: '#000000',
    tokens: {
      body: '#000000',
      surface: '#0a0b0e',
      card: '#12141a',
      popover: '#151820',
      muted: '#07080a',
      textPrimary: '#ffffff',
      textSecondary: '#a1a8b5',
      border: 'rgba(255, 255, 255, 0.14)',
      borderEmphasized: 'rgba(255, 212, 92, 0.45)',
      glow: 'rgba(255, 212, 92, 0.18)'
    },
    accents: [
      { id: 'gold', name: 'Gold', color: '#ffd45c' },
      { id: 'white', name: 'Pure White', color: '#ffffff' },
      { id: 'cyan', name: 'Electric Cyan', color: '#38bdf8' },
      { id: 'crimson', name: 'Crimson', color: '#f43f5e' }
    ]
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    category: 'Community',
    astryxTheme: 'gothic',
    mode: 'dark',
    defaultFont: 'geometric',
    description: 'Neon indigo night in downtown Tokyo with electric blue & violet',
    swatches: ['#16161e', '#1a1b26', '#7aa2f7', '#bb9af7'],
    accent: '#7aa2f7',
    accentSecondary: '#bb9af7',
    onAccent: '#0d1017',
    tokens: {
      body: '#13141c',
      surface: '#1a1b26',
      card: '#24283b',
      popover: '#292e42',
      muted: '#16161e',
      textPrimary: '#c0caf5',
      textSecondary: '#9aa5ce',
      border: 'rgba(122, 162, 247, 0.18)',
      borderEmphasized: '#3b4261',
      glow: 'rgba(122, 162, 247, 0.25)'
    },
    accents: [
      { id: 'blue', name: 'Neon Blue', color: '#7aa2f7' },
      { id: 'cyan', name: 'Sky Cyan', color: '#7dcfff' },
      { id: 'magenta', name: 'Neon Violet', color: '#bb9af7' },
      { id: 'orange', name: 'Sunset Orange', color: '#ff9e64' },
      { id: 'green', name: 'Teal Mint', color: '#73daca' }
    ]
  },
  {
    id: 'dracula',
    name: 'Dracula',
    category: 'Community',
    astryxTheme: 'gothic',
    mode: 'dark',
    defaultFont: 'geometric',
    description: 'Vampiric dark purple slate with neon pink and cyan highlights',
    swatches: ['#191a21', '#282a36', '#bd93f9', '#ff79c6'],
    accent: '#bd93f9',
    accentSecondary: '#ff79c6',
    onAccent: '#14151f',
    tokens: {
      body: '#16171f',
      surface: '#21222c',
      card: '#282a36',
      popover: '#343746',
      muted: '#191a21',
      textPrimary: '#f8f8f2',
      textSecondary: '#a9b2d0',
      border: 'rgba(189, 147, 249, 0.2)',
      borderEmphasized: '#6272a4',
      glow: 'rgba(189, 147, 249, 0.26)'
    },
    accents: [
      { id: 'purple', name: 'Dracula Purple', color: '#bd93f9' },
      { id: 'pink', name: 'Neon Pink', color: '#ff79c6' },
      { id: 'cyan', name: 'Vampire Cyan', color: '#8be9fd' },
      { id: 'green', name: 'Venom Green', color: '#50fa7b' }
    ]
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    category: 'Community',
    astryxTheme: 'chocolate',
    mode: 'dark',
    defaultFont: 'nuvio',
    description: 'Warm cozy dark espresso with pastel mauve, peach & lavender',
    swatches: ['#11111b', '#1e1e2e', '#cba6f7', '#fab387'],
    accent: '#cba6f7',
    accentSecondary: '#fab387',
    onAccent: '#11111b',
    tokens: {
      body: '#11111b',
      surface: '#181825',
      card: '#1e1e2e',
      popover: '#313244',
      muted: '#141420',
      textPrimary: '#cdd6f4',
      textSecondary: '#a6adc8',
      border: 'rgba(203, 166, 247, 0.18)',
      borderEmphasized: '#45475a',
      glow: 'rgba(203, 166, 247, 0.24)'
    },
    accents: [
      { id: 'mauve', name: 'Mauve', color: '#cba6f7' },
      { id: 'peach', name: 'Peach', color: '#fab387' },
      { id: 'blue', name: 'Sapphire', color: '#89b4fa' },
      { id: 'green', name: 'Green', color: '#a6e3a1' },
      { id: 'pink', name: 'Pink', color: '#f5c2e7' }
    ]
  },
  {
    id: 'nord',
    name: 'Nord',
    category: 'Community',
    astryxTheme: 'stone',
    mode: 'dark',
    defaultFont: 'nuvio',
    description: 'Arctic polar night slate with glacier frost blue & aurora accents',
    swatches: ['#242933', '#2e3440', '#88c0d0', '#eceff4'],
    accent: '#88c0d0',
    accentSecondary: '#81a1c1',
    onAccent: '#1d212a',
    tokens: {
      body: '#1e222a',
      surface: '#242933',
      card: '#2e3440',
      popover: '#3b4252',
      muted: '#222730',
      textPrimary: '#eceff4',
      textSecondary: '#cbd4e1',
      border: 'rgba(136, 192, 208, 0.2)',
      borderEmphasized: '#4c566a',
      glow: 'rgba(136, 192, 208, 0.22)'
    },
    accents: [
      { id: 'frost-ice', name: 'Frost Ice', color: '#88c0d0' },
      { id: 'frost-blue', name: 'Glacier', color: '#81a1c1' },
      { id: 'aurora-green', name: 'Aurora Green', color: '#a3be8c' },
      { id: 'aurora-purple', name: 'Aurora Purple', color: '#b48ead' }
    ]
  },
  {
    id: 'astryx-chocolate',
    name: 'Astryx Chocolate',
    category: 'Astryx Native',
    astryxTheme: 'chocolate',
    mode: 'dark',
    defaultFont: 'editorial',
    description: 'Official Astryx Chocolate theme with Fraunces serif headings & roasted cocoa',
    swatches: ['#141010', '#1c1610', '#d4a06a', '#ede4d4'],
    accent: '#d4a06a',
    accentSecondary: '#b88859',
    onAccent: '#141010',
    tokens: {
      body: '#141010',
      surface: '#1c1610',
      card: '#261d15',
      popover: '#2e231a',
      muted: '#181310',
      textPrimary: '#ede4d4',
      textSecondary: '#c4a882',
      border: 'rgba(212, 160, 106, 0.18)',
      borderEmphasized: '#6b5540',
      glow: 'rgba(212, 160, 106, 0.22)'
    },
    accents: [
      { id: 'caramel', name: 'Caramel', color: '#d4a06a' },
      { id: 'amber', name: 'Roasted Amber', color: '#eab308' },
      { id: 'cream', name: 'Warm Cream', color: '#ede4d4' }
    ]
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    category: 'Daylight',
    astryxTheme: 'butter',
    mode: 'light',
    defaultFont: 'nuvio',
    description: 'Crisp daytime paper surfaces with vibrant royal mauve & cobalt',
    swatches: ['#e6e9ef', '#eff1f5', '#8839ef', '#4c4f69'],
    accent: '#8839ef',
    accentSecondary: '#1e66f5',
    onAccent: '#ffffff',
    tokens: {
      body: '#e6e9ef',
      surface: '#eff1f5',
      card: '#ffffff',
      popover: '#ffffff',
      muted: '#dce0e8',
      textPrimary: '#2c2f44',
      textSecondary: '#5c5f77',
      border: 'rgba(76, 79, 105, 0.14)',
      borderEmphasized: '#9ca0b0',
      glow: 'rgba(136, 57, 239, 0.18)'
    },
    accents: [
      { id: 'mauve', name: 'Royal Mauve', color: '#8839ef' },
      { id: 'blue', name: 'Cobalt Blue', color: '#1e66f5' },
      { id: 'teal', name: 'Teal', color: '#179299' },
      { id: 'peach', name: 'Vibrant Peach', color: '#fe640b' }
    ]
  },
  {
    id: 'libre-sand',
    name: 'Libre Sand',
    category: 'Built-in',
    astryxTheme: 'stone',
    mode: 'dark',
    defaultFont: 'nuvio',
    description: 'Warm desert sandstone and charcoal slate',
    swatches: ['#111315', '#1b1e22', '#edc894', '#f4f3ef'],
    accent: '#edc894',
    accentSecondary: '#f59e0b',
    onAccent: '#111315',
    tokens: {
      body: '#111315',
      surface: '#191c20',
      card: '#22262c',
      popover: '#262b32',
      muted: '#15181b',
      textPrimary: '#f4f3ef',
      textSecondary: '#b3b7bd',
      border: 'rgba(237, 200, 148, 0.14)',
      borderEmphasized: '#3e444b',
      glow: 'rgba(237, 200, 148, 0.2)'
    },
    accents: [
      { id: 'sand', name: 'Sand', color: '#edc894' },
      { id: 'amber', name: 'Amber', color: '#f59e0b' },
      { id: 'copper', name: 'Copper', color: '#ea580c' },
      { id: 'rose', name: 'Rose', color: '#f43f5e' }
    ]
  }
];

export const HOMEPAGE_LAYOUTS = [
  {
    id: 'premiere',
    name: 'Premiere',
    badge: 'Nuvio Hero + Rails',
    description: 'Cinematic multi-slide hero pager, IMDb & quality badges, and horizontal poster rails'
  },
  {
    id: 'collection',
    name: 'Collection',
    badge: 'Dense + Filter Pills',
    description: 'Quick category filter bar above compact horizontal shelves and widescreen backdrops'
  },
  {
    id: 'focus',
    name: 'Focus',
    badge: 'Editorial Minimal',
    description: 'Restrained spotlight banner with watch-first continue tracking and clean poster rows'
  }
];

export const POSTER_SHAPES = [
  {
    id: 'poster',
    name: 'Portrait Posters (2:3)',
    description: 'Classic vertical movie & series posters (3 per row on mobile)'
  },
  {
    id: 'landscape',
    name: 'Widescreen Backdrops (16:9)',
    description: 'Nuvio landscape backdrop cards with title overlay'
  }
];

export const PLAYER_STYLES = [
  {
    id: 'compact',
    name: 'MPV Floating Pill',
    badge: 'MPV OSC',
    description: 'Floating bottom glass control dock with timecodes, ±10s skip, audio/subtitles, and speed'
  },
  {
    id: 'edge',
    name: 'Cinematic Edge',
    badge: 'Nuvio Fullscreen',
    description: 'Full-width top & bottom gradient overlays with large touch controls'
  },
  {
    id: 'panel',
    name: 'Studio Drawer',
    badge: 'Side Inspector',
    description: 'Slide-out side drawer for instant stream switching, subtitle tracks, and speed'
  }
];

export const DEFAULT_PREFERENCES = {
  layout: 'premiere',
  posterShape: 'poster',
  player: 'compact',
  palette: 'oxblood',
  accent: '#c0524a',
  font: 'oxblood'
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

  const targets = [
    root,
    document.body,
    ...document.querySelectorAll('[data-astryx-theme], [data-astryx-media]')
  ].filter(Boolean);

  for (const el of targets) {
    for (const [k, v] of Object.entries(vars)) {
      el.style.setProperty(k, v);
    }
  }
}
