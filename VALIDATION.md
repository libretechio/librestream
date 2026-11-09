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
## v0.3.1 mobile follow-up (2026-11-09)

Palette selection preserves the independently chosen typography. Hero actions use two rows on phones; pager buttons, arrows, catalogue filters and See all have 44 CSS pixel touch targets. The appearance dialog has more vertical room and its preview wraps on narrow screens. Page bottom spacing includes the device safe area. Desktop navigation waits until 64rem; theme and profile labels wait until 75rem, avoiding the observed off-screen header controls at 768px.

Removed invented hero age certifications and the unconditional Instant Streams claim. Missing metadata stays absent. Account copy now describes browser-local storage rather than cross-device sync.

Browser evidence: at a 320px viewport, hero height decreased from 488 to 418 CSS pixels; sampled action and pager targets measured 44px high. Catalogue rails remained a single horizontal row (237px scrollHeight and clientHeight with 3252px horizontal content). See all opened a grid without page overflow. Palette switching retained the selected Jakarta body font; the bundled font loaded successfully. Light and dark palettes, pager selection and the appearance close control worked locally.

Production validation is separate: the saved Kubernetes API connection timed out during this follow-up. GitOps publication alone does not establish production reconciliation or authenticated phone playback. Rollback is the previous v0.3.0 release pin. Existing validation entries below describe historical checks, not this release's production status.

