export const PALETTES = [
  {
    id: 'libre-sand',
    name: 'Libre Sand',
    category: 'Built-in',
    description: 'Warm golden sand and stone',
    swatches: ['#111315', '#1b1e22', '#edc894', '#f4f3ef'],
    accent: '#edc894',
    accents: [
      { id: 'sand', name: 'Sand', color: '#edc894' },
      { id: 'amber', name: 'Amber', color: '#f59e0b' },
      { id: 'copper', name: 'Copper', color: '#ea580c' },
      { id: 'rose', name: 'Rose', color: '#f43f5e' }
    ]
  },
  {
    id: 'neutral',
    name: 'Neutral',
    category: 'Built-in',
    description: 'Crisp monochromatic dark and light',
    swatches: ['#151719', '#202428', '#bfc5cf', '#f2f3ed'],
    accent: '#bfc5cf',
    accents: [
      { id: 'silver', name: 'Silver', color: '#bfc5cf' },
      { id: 'white', name: 'White', color: '#f8fafc' },
      { id: 'zinc', name: 'Zinc', color: '#a1a1aa' }
    ]
  },
  {
    id: 'sea-glass',
    name: 'Sea Glass',
    category: 'Built-in',
    description: 'Cool marine teal and coastal slate',
    swatches: ['#101618', '#182226', '#a5d4c2', '#e4edea'],
    accent: '#a5d4c2',
    accents: [
      { id: 'seaglass', name: 'Sea Glass', color: '#a5d4c2' },
      { id: 'emerald', name: 'Emerald', color: '#10b981' },
      { id: 'cyan', name: 'Cyan', color: '#06b6d4' }
    ]
  },
  {
    id: 'nord',
    name: 'Nord',
    category: 'Community',
    description: 'Arctic, north-bluish clean palette',
    swatches: ['#242933', '#2e3440', '#88c0d0', '#eceff4'],
    accent: '#88c0d0',
    accents: [
      { id: 'frost-ice', name: 'Ice', color: '#88c0d0' },
      { id: 'frost-blue', name: 'Frost', color: '#81a1c1' },
      { id: 'aurora-green', name: 'Green', color: '#a3be8c' },
      { id: 'aurora-purple', name: 'Purple', color: '#b48ead' }
    ]
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    category: 'Community',
    description: 'Soothing dark pastel palette',
    swatches: ['#181825', '#1e1e2e', '#cba6f7', '#cdd6f4'],
    accent: '#cba6f7',
    variants: [
      { id: 'catppuccin-mocha', name: 'Mocha' },
      { id: 'catppuccin-macchiato', name: 'Macchiato' },
      { id: 'catppuccin-frappe', name: 'Frappé' },
      { id: 'catppuccin-latte', name: 'Latte (Light)' }
    ],
    accents: [
      { id: 'mauve', name: 'Mauve', color: '#cba6f7' },
      { id: 'blue', name: 'Blue', color: '#89b4fa' },
      { id: 'green', name: 'Green', color: '#a6e3a1' },
      { id: 'peach', name: 'Peach', color: '#fab387' },
      { id: 'pink', name: 'Pink', color: '#f5c2e7' }
    ]
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    category: 'Community',
    description: 'Light pastel daytime theme',
    swatches: ['#e6e9ef', '#eff1f5', '#8839ef', '#4c4f69'],
    accent: '#8839ef',
    accents: [
      { id: 'mauve', name: 'Mauve', color: '#8839ef' },
      { id: 'blue', name: 'Blue', color: '#1e66f5' },
      { id: 'green', name: 'Green', color: '#40a02b' },
      { id: 'peach', name: 'Peach', color: '#fe640b' }
    ]
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    category: 'Community',
    description: 'Neon dark theme celebrating night in Tokyo',
    swatches: ['#16161e', '#1a1b26', '#7aa2f7', '#c0caf5'],
    accent: '#7aa2f7',
    variants: [
      { id: 'tokyo-night', name: 'Night' },
      { id: 'tokyo-night-storm', name: 'Storm' },
      { id: 'tokyo-night-day', name: 'Day (Light)' }
    ],
    accents: [
      { id: 'cyan', name: 'Cyan', color: '#7dcfff' },
      { id: 'blue', name: 'Blue', color: '#7aa2f7' },
      { id: 'magenta', name: 'Magenta', color: '#bb9af7' },
      { id: 'orange', name: 'Orange', color: '#ff9e64' }
    ]
  },
  {
    id: 'dracula',
    name: 'Dracula',
    category: 'Community',
    description: 'Vampiric dark theme with neon highlights',
    swatches: ['#1e1f29', '#282a36', '#bd93f9', '#f8f8f2'],
    accent: '#bd93f9',
    accents: [
      { id: 'purple', name: 'Purple', color: '#bd93f9' },
      { id: 'pink', name: 'Pink', color: '#ff79c6' },
      { id: 'cyan', name: 'Cyan', color: '#8be9fd' },
      { id: 'green', name: 'Green', color: '#50fa7b' }
    ]
  }
];

export const HOMEPAGE_LAYOUTS = [
  {
    id: 'premiere',
    name: 'Premiere',
    badge: 'A',
    description: 'Cinematic widescreen hero, rich metadata, artwork-first discovery'
  },
  {
    id: 'collection',
    name: 'Collection',
    badge: 'B',
    description: 'Compact sidebar rail, denser shelves, and filter pills above fold'
  },
  {
    id: 'focus',
    name: 'Focus',
    badge: 'C',
    description: 'Calm panoramic banner, watch-first continue tracking, editorial grid'
  }
];

export const PLAYER_STYLES = [
  {
    id: 'compact',
    name: 'Compact toolbar',
    badge: 'C · MPV style',
    description: 'Floating MPV OSC-inspired bottom control pill with quick toggles'
  },
  {
    id: 'edge',
    name: 'Edge controls',
    badge: 'A · Cinematic',
    description: 'Full-viewport classic overlay with top details and bottom timeline'
  },
  {
    id: 'panel',
    name: 'Panel controls',
    badge: 'B · Settings drawer',
    description: 'Side drawer for audio, subtitles, stream source picker, and speed'
  }
];

export const DEFAULT_PREFERENCES = {
  layout: 'premiere',
  player: 'compact',
  palette: 'libre-sand',
  accent: '#edc894'
};
