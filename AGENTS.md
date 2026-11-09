# AGENTS.md — LibreStream browser client

Project guidance for coding agents.

## Stack
React 19 + Vite. No component library. Every control is a native element with the
app's own styles, so focus, keyboard and semantics come from the browser.

- `web/ui.jsx` — the primitives: Button, IconButton, Badge, Chip, Field, Select,
  Segmented, Modal, ModalHeader, Skeleton, Spinner. Add new controls here.
- `web/tokens.css` — the only place sizes are decided (space, radius, type, glass).
- `web/palettes.css` — palette values; `web/palettes.js` — palette + font presets and
  the DOM writer that applies them.
- `web/browser.css` — component styles, built from the tokens.
- `web/badges.js` — everything that derives display data from addon metadata or
  stream text. Pure functions, unit tested.
- `web/Player.jsx`, `web/SubtitleLayer.jsx`, `web/picture.js` — playback and the
  picture-rect maths that keeps subtitles inside the video.
- `server.mjs` — the gateway: addon proxy, playback proxy, subtitle proxy.

## Rules
- Colours, spacing and radii come from tokens. No raw hex in component CSS; no
  `px` for anything that should scale.
- `html` stays at the browser default font size: every token is in `rem`.
- Actions are white. Mint (`--ls-cached`) means "cached" and nothing else.
- Glass is for floating chrome (docks, modals, player deck, chips over artwork).
  Body surfaces are solid.
- Poster card: ratings and age certification inside the artwork; quality,
  language count, size, cached in the strip below.
- Never invent metadata. If a provider does not send a rating, the badge does not
  render. See `badges.js`.
- Playback and subtitle URLs stay behind gateway handles; never expose provider
  URLs or tokens to the client.

## Checks before delivering
- `npm run build`
- `npm test` (66 tests)
- `node tests/player-preview.mjs` for a local player fixture on :4178
