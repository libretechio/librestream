# LibreStream browser direction

Phone and desktop browsers are the primary surfaces. Browse, search, open a title, select a source, watch. Existing Jellyfin clients cover TVs.

## System

Ant Design, shadcn/ui and DaisyUI are the reference bar: token-driven colour, dense rows, hairline borders, one accent, small radii, real focus rings. LibreStream takes that discipline and keeps its own identity — warm cinema palette, artwork-forward browse.

`web/tokens.css` is the only place sizes are decided. A palette swap in `palettes.css` restyles the whole app because every surface derives from `--color-*`.

- **Space**: 4px grid (`--ls-1` … `--ls-12`).
- **Radius**: four steps only — 4, 6, 8, 12px. No pills except status chips.
- **Type**: 11, 12, 13, 14, 16, 20, 26, 34px. Tabular numerals for every rating, runtime and timecode.
- **Surfaces**: body, surface, card, raised. Layering comes from luminance, never from blur or shadow.
- **Borders**: 1px hairlines carry hierarchy. Drop shadows are not used for elevation.
- **Accent**: primary action, active navigation, focus ring. Nothing else.
- **Blur**: two sticky bars only — the header and the phone navigation. Everything else is solid.
- **Motion**: colour and border transitions at 120–180ms. No hover translate, no scale.

## Screens

- **Header**: solid bar, hairline rule, wordmark left, segmented navigation centre, appearance and profile right. Navigation becomes a segmented control at 64rem; below that the phone bar takes over, so only one navigation is ever visible.
- **Browse**: hero with one artwork and one scrim, then horizontal shelves. Shelves scroll sideways with desktop arrows; "See all" opens a grid dialog. Posters carry certification, rating and a `year · type` line — no invented metadata.
- **Title dialog**: 16:9 artwork, one scrim, cast as text chips, episodes as hairline rows with a dedicated play button, sources as hairline rows inside a single bordered container.
- **Search / Saved / Appearance / Settings**: page title, then content. No decorative panels.
- **Player**: matte instrument panel — one 44px transport row, a hover scrub bubble, and a three-tab sheet (Tracks, Picture, Speed).

## Accessibility

Body text meets WCAG AA on every shipped palette, light and dark: the lowest measured ratio is 5.14 (Catppuccin Latte) and 7.45 on Nuvio Gold. Tertiary ink is an opaque mix, never an alpha over an unknown surface, so contrast survives palette changes. Interactive targets are at least 40px on phones and 36px on desktop. Focus is a 2px accent ring with offset, never removed.

## Behaviour

Existing Jellyfin clients cover TVs. Use the official Nuvio desktop/mobile task flow as a reference, not their TV focus engine or native player implementation. Both official clients are Kotlin/Compose apps. This browser source is independent and uses the Stremio addon protocol.

No Nuvio account flow. Authentik supplies a stable user identifier. Watchlists and progress are browser-local and scoped by that identifier. Shared addon configuration is read by the gateway from a private runtime file, never compiled into assets.
