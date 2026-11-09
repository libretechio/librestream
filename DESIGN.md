# LibreStream browser direction

Phone and desktop browsers are the primary surfaces. Browse, search, open a title,
watch. Existing Jellyfin clients cover TVs.

## System

Apple TV+ / Infuse frosted glass, taken as a material direction, not a feature list.
No component library: `web/ui.jsx` holds the primitives.

- **Surfaces**: Warm Graphite — `#0F0E0D` body, `#151311` surface, `#1D1A17` card.
  Two alternates ship: Obsidian Noir and Blue Hour.
- **Glass**: `rgba(255,255,255,0.05–0.14)` over `blur(28–40px) saturate(180–190%)`,
  hairline borders at 9–14% white. Glass is the material of floating chrome only.
- **Actions**: white is the action colour. Mint (`--ls-cached`) means cached.
  Amber (`--ls-gold`) is IMDb only.
- **Type**: Figtree for interface and titles, JetBrains Sans for numerals, badges and
  timecodes. 11 / 12 / 13 / 14 / 16 / 20 / 28 / 40px.
- **Radius**: 6 / 10 / 14 / 18px, pills only for chips and the player controls.
- **Space**: 4px grid.
- **Motion**: 140–300ms on colour, border, shadow and a 1.03 scale on cards. Nothing
  bounces.

## Screens

- **Header**: floating glass dock, inset from the edges, plain text navigation, a
  palette pill and the profile. On phones it reduces to brand + profile; navigation
  moves to a floating glass dock at the bottom.
- **Browse**: full-bleed hero (artwork, one scrim, facts, Play / Choose stream /
  Watchlist), a filter strip, Continue watching as 16:9 cards, then poster shelves.
- **Poster card**: ratings and certification inside the artwork; title, `year · type ·
  runtime` and a data strip below. Hover scales 1.03 and reveals a white play button.
- **Title page**: full takeover, not a modal box. Hero with pinned actions. Movies get
  Play + Choose stream; series get an episode list where each row has its own Play,
  and Choose stream lives on the episode page.
- **Player**: one floating glass deck — timeline, play, ±10s, timecode, volume, tracks,
  aspect, speed, PiP, fullscreen. Aspect opens a popover with Fit / Fill / Stretch and
  zoom. Subtitles are drawn by the app inside the picture rect.

## Accessibility

Body text passes WCAG AA on every palette: lowest measured ratio 6.17 at 11px
(card metadata), 7.71 for hero synopsis, 17.29 for titles. Nothing interactive is
under 24px; phone targets are 32–44px. Focus is a 2px white ring, never removed.

## Behaviour

Stremio addon protocol. Authentik supplies a stable user identifier. Watchlists,
progress, appearance and remembered availability are browser-local per identity.
Shared addon configuration is read by the gateway from a private runtime file and is
never compiled into assets.
