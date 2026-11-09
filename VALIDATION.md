# LibreStream validation

## Frosted glass pass + poster information split (2026-11-09, local only)

Reference: a Google Stitch mockup the user liked (Apple TV+ / Infuse frosted glass), used as a style reference for existing components only. Nothing was copied wholesale.

Poster information, as directed:
- Inside the artwork: IMDb rating, Rotten Tomatoes score, age certification. Nothing else.
- Under the artwork (the strip): quality flags (4K / DV / HDR / Atmos / REMUX), language count, file size, cached, new, saved.
- Rotten Tomatoes: **no configured addon supplies an RT score.** The RT addon's catalog entries carry only id/name/poster/description, and its meta endpoint returns 502 here. The badge renders only when a real score arrives (`rtRating`, `tomatoMeter`, `rottenTomatoes` or `app_extras.*`), so it is hidden today rather than faked.
- Age certification: Cinemeta does not send one; Xperience sends `app_extras.certification`. Metadata from all meta-capable addons is now merged instead of first-wins, so certification is found. It is remembered per title, so the poster shows `R` after the title has been opened once.

Frosted glass, applied to existing elements:
- Surfaces neutralised to near-black (`#0b0b0d` / `#0f0f12` / `#18181c`); the Oxblood accent `#c0524a` is kept.
- Header: fixed, gradient-to-transparent, `backdrop-filter: blur(20px)`, plain text navigation with no pill, circular ghost buttons, white brand tile.
- Hero: two-gradient vignette, frosted meta chips, white solid primary CTA + frosted secondary, 12px radii.
- Posters: 12px radius, 1px white/6% hairline, hover scale 1.03 with a deep shadow (no accent border), frosted rating chips, white circular play on hover.
- Dialogs and stream rows: frosted panels (`blur(28px) saturate(180%)`), 16px radius, stream rows as individual glass cards with white circular play on hover.
- Player: floating frosted deck (`blur(40px)`, 16px radius), white circular play, thin white scrubber with a hover thumb, glass pills for audio/subtitles and sources in the top bar.
- Continue watching: glass cards, white progress bar, resume-time chip on the artwork.

Bug found and fixed while driving the UI: on the desktop two-column title panel the Sources action row is hidden, so "Choose stream" opened nothing. `Sources` now accepts an `openPicker` signal from the parent.

Measured (Chromium, local preview, real addons)
- Header blur active; hero CTA `rgb(255,255,255)`; poster radius 12px with `rgba(255,255,255,0.06)` border; rating chips `blur(12px)`; dialog `blur(28px)` at 16px radius; player deck `blur(40px)`, 16px radius, white play, 8px inner icon radius.
- Poster for a read title: `R` top-right, `★ 7.8` top-left, strip `4K · DV · Atmos · REMUX · 8 lang · 72 GB · cached`.
- Desktop stream picker: 493 rows from PenguPlay/AIOStreams; no overflow at 1425 or 375 px.
- Build and 66 tests pass.

Not verified
- Human visual review; every check here is geometry and computed style.
- Rotten Tomatoes scores, because no addon provides them.
- Safari and iOS.
- Production. Nothing pushed, merged or deployed.

## Round 5 — strip prefetch, player alignment, resume cards (2026-11-09, local only)

Chosen by the user: prefetch the first visible titles, align the player to the approved system, and show resume time on continue-watching artwork.

- `web/badges.js`: `titlesNeedingAvailability` and `prefetchAvailability`. Bounded to 12 titles, concurrency 2, one AbortController for the page lifetime, skipped titles already in the store. 3 unit tests.
- `web/App.jsx`: prefetch effect keyed on the featured items, plus a resume-time label on continue-watching cards.
- `web/browser.css`: player chrome now takes the Oxblood accent, 8px control radius, Figtree titles and JetBrains Sans timecodes; continue cards are 16:9 with a resume chip and progress bar.

Measured: poster strips on the home route went from 3 to 9 within ~20s of load, with 8 titles in the availability store. Sample strips: `4K · DV · Atmos · 8 lang · cached`, `4K · HDR`. Player opened and played; play control is Oxblood `rgb(192,82,74)`, clock font JetBrains Sans. Build and 63 tests pass.

## Approved design pass — Oxblood (2026-11-09, local only)

Ten decisions were taken from the user, each from a rendered mockup, before any app code changed. Mockups live in `mockups/` next to this file.

| Decision | Chosen |
|---|---|
| Direction | A — Editorial Cinema (artwork first, quiet chrome) |
| Poster info | Corners for certification and rating; data strip under the artwork for quality, language count, cache |
| Typography | Figtree for titles and UI, JetBrains Sans for numerals and badges |
| Palette | Oxblood — `#c0524a` on `#120d0d` |
| Shape | S2 Soft — 10px artwork, 8px controls, 4px badges, one soft shadow |
| Hero | H1 full-bleed |
| Title panel | D2 two-column on desktop, D3 tabbed on phone |
| Poster strip | Quality + language count + cached |
| Hover | Lift 2px, accent border, artwork zooms 3%, reveals Play and the trimmed badges |
| Phone navigation | Bottom bar with a filled active pill |

Implemented
- `web/palettes.js`: Oxblood palette added and made the default; new `oxblood` font preset carrying a `numeric` face, exposed as `--font-family-num`; `DEFAULT_PREFERENCES` point at both.
- `web/palettes.css`: Oxblood token block so the palette applies before JS runs.
- `web/tokens.css`: radius scale is now 4 / 8 / 10 / 12, plus `--ls-num` and a single elevation pair.
- `web/badges.js` (new, 9 unit tests): runtime parsing, New badge from a real release date only, episode counts, awards, certification, language extraction from provider flags, and `availabilityFromStreams` for quality/HDR/DV/Atmos/REMUX/cache/languages.
- Poster card: certification + New top-left, rating top-right, progress bar, and a caption carrying title, `year · type · runtime` and the data strip. Hover reveals Play and the badges trimmed from the strip. Touch devices always show Play.
- Availability is remembered per title in `localStorage` after its streams load, so the strip fills in without extra requests. No language or quality is invented: an unopened title shows only what its catalogue entry actually contains.
- Title panel: `useMediaQuery` picks D2 (poster column + facts + actions + episodes + sources) or D3 (banner, actions, Episodes/Overview/Streams tabs).
- Phone navigation: filled accent pill behind the active icon.

Fixed on the way: the app crashed to a blank page twice during this pass (`useMemo is not defined`, then `ScrollRow is not defined`) after two of my edits removed or failed to import symbols. Both were caught by reading the console, not by the build, which had passed.

Measured in the browser (Chromium, local preview, real addons)
- Palette `oxblood`, heading font Figtree, numerals JetBrains Sans, artwork radius 10px, shadow present.
- 96 poster cards on the home route; each has a hover Play control; strip renders `4K · DV · Atmos · 8 lang · cached` for a title whose streams had been read, with 3 more badges behind hover.
- Contrast on Oxblood: poster title 14.7, poster sub 7.59, quality chip 19.28, shelf heading 16.66, hero synopsis 8.12.
- Desktop title panel: two columns (184px poster + content), Play / Choose stream / Watchlist, no duplicated action row.
- Phone title panel: tabbed layout, actions above the tabs.
- Build and 60 tests pass.

Not verified
- Human visual review. I cannot see images, so every check here is geometry, computed style and contrast; the mockups were rendered and measured, not looked at.
- Safari and iOS.
- Production. Nothing pushed, merged or deployed for this pass.

## Interface system pass (2026-11-09, local only)

Scope: the whole interface, not only the player. Header, navigation, hero, shelves, posters, continue watching, title dialog, episodes, sources, appearance and settings were rebuilt on one token layer.

What changed
- `web/tokens.css` (new) defines the only sizes used: 4px spacing grid, four radii (4/6/8/12), seven type steps, four surface levels, hairline borders, one accent, focus ring. Every value derives from the palette variables, so a palette swap restyles the app.
- `web/browser.css` was rewritten around that layer. Removed: 15 pill radii (9999px), the ambient blurred hero backdrop, the second hero scrim, the poster gradient scrim on every card, hover translate/scale, card drop shadows, and the decorative app-shell glow.
- Shelves no longer use the Astryx Carousel: its round shadowed pagination dots and edge fade were the last pill-and-shadow artefacts. `ScrollRow` renders a plain scroll strip with desktop arrows that appear only when the strip can actually scroll.
- Posters now show certification, a rating chip and a `year · type` line. The invented "Movie/Series as age rating" badge was replaced by real certification data when present.
- Header navigation is a segmented control; the phone bar is a flat bar with an accent rule on the active tab. Only one navigation is visible at any width (phone bar below 64rem, header navigation at and above it).
- Search, Saved, Appearance and Settings pages dropped the Astryx `Layout` wrapper for page sections with a shared title style, so their headings match the rest of the app.
- Fixed a content bug found during the pass: addon rows printed `[object Object]` for providers whose resources are objects.

Measured in the browser (Chromium, local preview, real addons)
- Slop audit across all five routes: pill-radius elements 0, gradients 0 on every route except the hero scrim (1), blur 2 (header and phone bar only), shadows 1-3 (navigation inset hairline plus Astryx segmented control, both now flattened).
- Contrast on the shipped dark palette: poster meta 7.45, shelf subtitle 8.78, poster title 14.9, hero synopsis 8.28, heading 17.56.
- Contrast on the light palette (Catppuccin Latte): lowest 5.14. Tertiary ink is now an opaque mix rather than an alpha, which is what made the light palette fail at 3.45 before.
- Phone 375x844: no horizontal overflow; every interactive target is at least 40px (0 of 129 below 40px). Poster rail 143px wide, three visible per row. Appearance grid resolves to 2 columns.
- Tablet 885px: one navigation only (phone bar), shelf arrows present.
- Desktop 1425x900: header navigation, hero 432px with side poster 160x240, poster rail 160x240, shelf strips scroll (4116px content in 1381px viewport).
- Player unchanged from the previous pass except that it inherits the token layer.
- Build and 51 tests pass.

Not verified
- Visual review by a human. Geometry, contrast, target size and computed styles were measured programmatically; nobody has looked at the rendered result yet.
- Safari and iOS. Chromium only.
- Production. Nothing pushed, merged or deployed for this pass.

## Player chrome, subtitle placement and aspect modes (2026-11-09, local only)

Reported: cues ran off the bottom of the screen, fullscreen did nothing, no aspect/zoom control, and the player chrome still read as generated rather than designed.

Causes:
- Browser-rendered cues anchor to the video element box, not the picture. The element spans the whole viewport, so cues sat at the screen bottom, under the control bar, even when the picture was letterboxed.
- The fullscreen button toggled `document.fullscreenElement` only; iOS Safari needs `video.webkitEnterFullscreen`, and the previous state never re-synced on `fullscreenchange`.
- There was no picture control at all: `object-fit` was fixed to `contain`.

Changes:
- `web/picture.js` computes the visible picture rect from stage size, intrinsic size, fit mode and zoom. Six unit tests cover letterbox, pillarbox, crop, stretch, zoom and missing metadata.
- `web/SubtitleLayer.jsx` paints the active cue itself over that rect, so cues are bounded by the picture and lifted above the control bar while it is visible. Subtitle files are sanitised to inline emphasis only; `TextTrack.mode` stays `hidden` so the browser never draws a second copy.
- Subtitle size and height are user controls (small/medium/large, low/standard/high), persisted per browser.
- Aspect control in the Picture tab: Fit, Fill, Stretch plus zoom 100/110/125/150%, with keyboard `A` cycling fit.
- Fullscreen: `requestFullscreen` on the player, `webkitEnterFullscreen` fallback for iOS, state synced from `fullscreenchange` and `webkitfullscreenchange`.
- Chrome rebuilt as a matte instrument panel: one accent, hairline rules, no glow or gradients beyond the scrims, single 44px transport row, hover-only scrub bubble, sheet with three tabs (Tracks, Picture, Speed) instead of a stacked drawer.

Measured in the browser against a local 640x360 fixture with a real SRT through the subtitle gateway:
- Phone 375x844, Fit: picture occupies y 312-532; cue occupied y 374-427, inside the picture and 335px above the control bar.
- Phone, Fill: cue bottom 744 with the bar at 762, an 18px gap, never under the bar.
- Desktop 1425x900, Fit: picture y 49-851, cue bottom 751, bar top 818.
- Subtitle height control moves the cue from 800 to 720; size control from 34px to 41.5px.
- Phone transport: one 44px row, six controls, no horizontal overflow. Sheet rows 44px, tabs 40px, close 40px; sheet 359x426, fits without scrolling.

Not verified:
- Fullscreen engagement. The automation browser rejects `requestFullscreen` (the call never resolves), so the button path is implemented but unproven here; it needs one press on a real device.
- Audio track switching on a multi-audio HLS source, and embedded HLS subtitle tracks. No such source was available.
- Production. Nothing pushed or deployed for this change.

## Player tracks and prewarmed ranking (2026-11-09, local only)

Reported defects: no audio track switching, no subtitles from embedded tracks or the OpenSubtitles addon, a dead play button beside each episode, and Play starting the connection ranking every time.

Causes found in the code:
- The client never requested the `subtitles` addon resource, so no subtitle list existed for any source.
- `Player` rendered `<track default>` at mount and never set `TextTrack.mode`, so even a present list could not be switched.
- The episode card was a single button and the play glyph was a decorative span inside it; pressing it only re-selected the episode.
- `selectBestStream` ran inside the Play handler, so probing started after the user pressed Play.

Changes:
- `server.mjs`: `GET /api/subtitles/list/:index/:type/:id` queries a subtitle addon with `filename`/`videoSize` hints and rewrites every returned URL to an opaque same-origin handle. `GET /api/subtitles/:handle` proxies the file, converts SRT to WebVTT, decodes UTF-8 with a windows-1252 fallback, refuses HTML/JSON responses and enforces a 4 MB cap and per-user ownership. Subtitle URLs are never exposed to the client.
- `web/subtitles.js`: parallel discovery across subtitle addons, one track per addon and language, English first, failed addons counted without hiding the rest.
- `web/Player.jsx`: real track control. Addon tracks render as `<track id>` and are switched through `TextTrack.mode`; HLS embedded subtitle and audio tracks are switched through hls.js; native `audioTracks` are used when the browser exposes them. One "Playback" sheet holds Audio, Subtitles, Quality and Speed. Subtitle size persists.
- `web/App.jsx`: each episode row now has a separate 44px play button that selects the episode and starts automatic playback; the row body still selects without playing.
- `web/Sources.jsx`: ranking is warmed as soon as sources arrive, cached for ten minutes per title and episode, and deduplicated across in-flight runs. Play consumes the cached ranking instead of starting probes. Refresh sources clears the cache.

Browser evidence (local preview, real addons):
- OpenSubtitles v3 list returned 39 languages for a movie; a sampled track served `text/vtt` and parsed 1,721 cues.
- Selecting English set `TextTrack.mode = "showing"` with cues present; selecting another language disabled it.
- Prewarm: opening a title issued 3 probe requests with no Play press. Pressing Play afterwards issued 0 additional probes and used the cached result immediately.
- Play episode triggered the ranking flow and opened the stream list when no sampled source passed.
- Phone geometry at 375px: compact dock 91px tall with one 44px control row (previously 199px and three rows), no horizontal overflow; the Playback sheet fits at 359x652. Desktop at 1440px: dock 864px centered, one 44px row, nine controls.
- Build and 45 tests pass. Local preview restarted on http://127.0.0.1:4173/.

Not verified:
- Audio track switching against a multi-audio HLS source. No such source was available locally; the control path is implemented but unexercised. Progressive MP4/MKV audio tracks cannot be switched by any browser, and the sheet states that instead of offering a dead control.
- Embedded subtitle tracks from an HLS manifest, for the same reason.
- Every sampled AIOStreams playback URL from this host still returned HTTP 502 (upstream redirects to Authentik), so ranking produced an empty result and Play fell back to the stream list. This is the pre-existing provider-delivery condition, not a regression from these changes.
- Production. Nothing was pushed, merged or deployed for this change; production remains at v0.4.1.

## v0.3.1 mobile follow-up (2026-11-09)

Palette selection preserves the independently chosen typography. Hero actions use two rows on phones; pager buttons, arrows, catalogue filters and See all have 44 CSS pixel touch targets. The appearance dialog has more vertical room and its preview wraps on narrow screens. Page bottom spacing includes the device safe area. Desktop navigation waits until 64rem; theme and profile labels wait until 75rem, avoiding the observed off-screen header controls at 768px.

Removed invented hero age certifications and the unconditional Instant Streams claim. Missing metadata stays absent. Account copy now describes browser-local storage rather than cross-device sync.

Browser evidence: at a 320px viewport, hero height decreased from 488 to 418 CSS pixels; sampled action and pager targets measured 44px high. Catalogue rails remained a single horizontal row (237px scrollHeight and clientHeight with 3252px horizontal content). See all opened a grid without page overflow. Palette switching retained the selected Jakarta body font; the bundled font loaded successfully. Light and dark palettes, pager selection and the appearance close control worked locally.

Production validation is separate: the saved Kubernetes API connection timed out during this follow-up. GitOps publication alone does not establish production reconciliation or authenticated phone playback. Rollback is the previous v0.3.0 release pin. Validation entries below describe historical checks, not this release's production status.

Build, 12 tests and Astryx built-output checks pass. Header geometry was checked at 768, 1024 and 1200px with no off-screen controls after the breakpoint fix.

## Historical validation

# LibreStream Astryx rewrite: local validation

Observed 2026-11-08. Local branch: feat/browser-first. No commit, push, merge, deployment or production restart was performed.

## Playback, filters and layout follow-up (2026-11-09 IST)

This section supersedes the earlier provider observations below. Branch remains `feat/browser-first` against `libretechio/librestream`; all changes are local. Production was not accessed or changed during this follow-up. Existing source backup and production artifacts remain the rollback path.

Implemented:
- Removed forced anonymous CORS from native video. PenguPlay returned HTTP 206 video/mp4 without CORS headers; the previous crossorigin attribute caused the browser to reject it. Native video playback does not need that opt-in. HLS.js still needs provider CORS; no security checks were disabled and no media relay was introduced.
- Real PenguPlay Big Buck Bunny playback passed: the first sample reached readyState=4 with paused=false. A later check advanced from 10.863 to 12.746 seconds over a three-second observation with readyState=3 and paused=false. Provider network retries occurred, so this is sample playback evidence, not a guarantee for every title or CDN.
- AIOStreams sample links on the relay and Comet hosts redirected to Authentik and returned text/html. Frontend changes do not repair that upstream authentication path; AIOStreams playback is still blocked for these samples. No provider, proxy, firewall or production authentication setting was changed.
- Resolution, configured addon and TorBox cache filters use Astryx Selector. Recognizes numeric resolutions and UHD/4K/FHD/HD/SD labels. TorBox cache status is provider-reported, including the observed `Ready (TB)` lightning markers; it is not a direct TorBox API check. Negative cache/download markers take precedence. Unknown and other-provider results remain separately selectable.
- Browser filter check: 4K plus TorBox cached yielded two matching results; adding PenguPlay yielded the expected empty state; Clear filters restored 14 playable results. Sources requiring torrents/custom headers remain excluded with a count.
- Source list scroll fix: a bounded dialog body owns vertical scrolling. At phone width the body measured 696 CSS pixels tall with 3140 pixels of content; a scroll gesture moved scrollTop to 1200. Closing playback retains loaded sources and filters without refetching.
- Removed the 90rem page cap. At 1920 CSS pixels, main and shell both filled the full 1905-pixel document width (the remainder was the scrollbar). At 320 CSS pixels, the 273-pixel dialog stayed within the 305-pixel document with no horizontal overflow. Mobile source/filter and desktop browse screenshots were inspected.
- Addon discovery now streams each manifest as it finishes. In the observed check the first arrived at 59 ms; all 17 completed at 6050 ms. This includes existing manifest caching and is not a cold-start benchmark. Search results and stream rows also appear incrementally. Catalog placeholders reserve shelf geometry so offscreen catalogs can actually remain deferred.
- Added a monochrome ship/play-sail mark in the Astryx header. Standalone SVG: docs/librestream-mark.svg. The custom brand drawing is intentional; ordinary controls retain Astryx/Lucide icons.

Validation: build passes; nine tests pass, including early discovery delivery, composed filters, actual TorBox label formats and unknown-state handling. Astryx doctor on project source: zero failures, one styling/custom-icon advisory. Vite still reports large main/HLS chunks. Native unsupported codecs, standalone subtitle integration, physical-phone/Safari behavior and real production Authentik identity remain unverified. Earlier local MP4/HLS fixture evidence below was not rerun in this follow-up.

Local preview is bound to 127.0.0.1:4173 using the existing private runtime addon registry. Runtime credentials remain outside the repository. Files written: web app/gateway/tests, updated docs, build output and preview.log. Source archive excludes runtime config, logs, node_modules and old dist assets. No commit, push, merge, deployment or remote restart.

## Icon follow-up

The first Astryx implementation omitted navigation icons, and default Button padding truncated mobile labels. The local follow-up adds a consistent Lucide outline set through Astryx Icon: house, search, bookmark and settings. Mobile links stack icons over complete labels; desktop links arrange them inline. Search, playback, save and refresh actions have matching icons. Missing artwork uses a clapperboard placeholder instead of duplicating the title inside the image block.

Verified in the served build at 320, 390 and 1440 CSS pixels: four navigation SVGs, complete labels, no document overflow, working Browse/Search/Saved/Settings links, visible keyboard focus and focus return after closing title details. Icons inside labelled controls are decorative and hidden from assistive technology. Source and title-action icons were also checked. Build and six gateway tests pass; Astryx doctor reports zero failures and one advisory about app-specific styling. Existing provider-playback and production-authentication limits below remain unchanged. No push or deployment.

## Result

The browser-first Astryx implementation builds and its local interaction/playback checks pass. Publication is held because real-provider playback did not pass. This is a review build, not a production-ready release.

## Verified

- React 19 with Astryx 0.7.11: AppShell, Layout, Button, TextInput, Selector, Dialog/DialogHeader, Text/Heading, HStack/VStack.
- Custom built theme extends Astryx neutral; Figtree Variable is bundled from Fontsource. Browser font check returned true. No Google Fonts stylesheet is used in the final build.
- npm run build: passes. Vite warns about the sizes of the main and lazy-loaded HLS chunks.
- npm test: 6 tests pass. Covers fail-closed identity, UID isolation, JSON escaping, private registry redaction, search encoding, fixed upstream selection, failed-addon isolation, uncached stream responses, read-only APIs and static bytes.
- Astryx doctor --built .: 11 pass, 1 warning, 0 failures. The warning covers 18 app-specific className/style uses. They define media geometry, responsive navigation and source label wrapping; application controls are Astryx components.
- Actual browser viewport widths checked: 320, 375, 768 and 1440 CSS pixels. No document-level horizontal overflow in the inspected states. Mobile navigation is fixed at the bottom; larger widths use static navigation.
- Mobile and desktop MP4 playback: Big Buck Bunny trailer, Blender Foundation, CC BY 3.0. Browser currentTime advanced beyond one second with paused=false; duration 33.002667 seconds.
- Local HLS fixture: same trailer repackaged into HLS with ffmpeg, no re-encoding. Browser currentTime advanced past two seconds with paused=false, duration 32.48 seconds. This exercises the lazy-loaded HLS.js path.
- Search submit, source refresh, save/remove/save, saved list, season selector and episode source lookup checked in the Astryx build.
- Escape returns keyboard focus to the originating poster. AppShell provides one main landmark and its own skip link.
- Default-state contrast sampled from the rendered desktop navigation, headings and poster controls: minimum observed 11.08:1. This is not a claim that every possible component state was audited.
- Configured private manifest URL scan of new source/build: zero matches.

## Real addon observations

The private registry contains 17 entries: the 16 imported configured addon entries plus Cinemeta. At the manifest check, 14 answered successfully, including AIOStreams and PenguPlay; three did not. This is point-in-time connectivity evidence.

For the open movie Big Buck Bunny (IMDb tt1254207):
- AIOStreams returned 14 results, 13 with HTTP URLs.
- PenguPlay returned two results, one with an HTTP URL.
- The PenguPlay media request returned HTTP 403.
- Two AAC-labelled AIOStreams media URLs returned HTTP 200 with Content-Type text/html and no Access-Control-Allow-Origin header, rather than a video response.
- The tested real-provider streams did not play in the browser. No browser security controls were disabled and no media proxy was added to bypass that behavior.

## Limits before publication

- Resolve and retest actual provider delivery. Successful addon resolution alone is not playback verification.
- Verify a real Authentik session against a staging deployment, including trusted stable UID forwarding and prevention of direct gateway access.
- Standalone subtitle addon integration, non-VTT subtitles, embedded audio track switching, native plugins, intro skipping and native-client codec breadth are not implemented equivalents. Stream-supplied subtitle tracks are passed to the browser; they were not verified with the sample.
- Watchlists and progress are browser-local per Authentik UID, not cross-device sync. The previous browser storage format is retained only where the UID-derived scope matches; no migration of the old TV client state is claimed.
- No physical Android phone, iPhone/Safari or production playback was tested.
- Generic design-kit accuracy_report was not an app acceptance result: it targets its own reference kit. A source-HTML state runner cannot load this Vite entry without serving the built application. The browser checks above are the applicable evidence.

## Delivery gate for local review

- UI system PASS: actual Astryx imports and rendered components confirmed by doctor and browser.
- Responsive layout PASS for inspected states: measured at the widths above.
- Functionality PASS for the named local flows: MP4 and HLS played; search, saved titles, source selection and episodes were exercised.
- Content PASS: real addon metadata and explicitly labelled integration fixtures; no fabricated metrics, testimonials or promotional imagery.
- Accessibility PARTIAL: semantic controls, labelled inputs, one main landmark, focus return and sampled contrast checked. Full keyboard/state and assistive-technology audits remain unverified.
- Production gate HELD: real provider delivery failed; no push or deployment.

## Files and rollback

All work is under the agent workspace on /home. Approximate disk usage: 288 MB for the checkout/dependencies/build, 348 MB for official desktop/mobile reference checkouts and 8.6 MB for the prior TV-source backup. These figures were measured before packaging.

Private runtime addon registry: ~/.config/libretech/librestream/addons.json, mode 600. It is excluded from the source archive and repository.

Previous source snapshot: ../backups/librestream-tv-source-before-rewrite.tar.gz, mode 600. The original /tmp working directories were preserved. Existing production artifacts remain unchanged; no production rollback is required.

Local previews run on loopback ports 4173 (real configured addons) and 4174 (explicit fixture). No public route was created.
