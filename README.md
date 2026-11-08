# LibreStream browser rewrite

A browser-first client for Stremio-compatible addons, replacing the TV UI in the previous LibreStream releases. This branch is local and not a deployed release.

## Run locally

Requires Node 22 or newer.

```sh
npm ci
npm run build
LIBRESTREAM_DEV_IDENTITY=1 LIBRESTREAM_ADDONS_FILE=/absolute/private/addons.json npm start
```

Open http://127.0.0.1:4173. Development identity is an explicit local preview only. Without it the server requires trusted Authentik identity headers.

The runtime addon file is a JSON array of objects with `name` and `url` fields. URLs end with `manifest.json`. Store configured URLs outside the repository with mode 600. Never include provider credentials in frontend assets.

## Browser flows

Browse lazy-loaded catalogs, search catalogs that advertise search, select a movie or series episode, choose an HTTP stream, watch through native video controls or HLS.js. Save titles and resume playback on the same browser. Watchlists and progress are separately keyed by the hash of the Authentik stable user ID.

Direct torrents, custom HTTP headers, arbitrary native plugins, unsupported codecs and non-VTT subtitle files are not equivalent to native Nuvio features. A source requiring those features must not be presented as verified browser playback. Subtitle tracks embedded in stream responses are passed to the browser; standalone subtitle addons still need integration.

## Deployment contract

Build with `docker build -f Dockerfile.browser .`. This is a Node gateway plus static client, not a drop-in static archive for the existing nginx deployment.

Production must:
- Keep the application reachable only behind the trusted Authentik proxy.
- Strip incoming client identity headers and inject `X-Authentik-Uid`, `X-Authentik-Username` and `X-Authentik-Name` from the authenticated session.
- Mount the addon registry read-only as a Kubernetes Secret and set `LIBRESTREAM_ADDONS_FILE`.
- Leave `LIBRESTREAM_DEV_IDENTITY` unset.
- Preserve Jellyfin and its routes.

The app does not validate OIDC tokens itself. Trusting identity headers is safe only when network routing prevents bypassing the authentication proxy. No production manifests have been changed for this branch.

## Validation

Current status: local Astryx review build. The forced-CORS video bug is fixed and a real PenguPlay MP4 played in the browser. Sampled AIOStreams links still redirect to Authentik HTML, so publication remains held. See VALIDATION.md for observed facts and remaining checks.

`npm test` tests authentication failure, identity isolation, JSON escaping, registry redaction, fixed upstream routing, search encoding, failed-source isolation, uncached stream responses and static serving. Browser checks and limitations are recorded in `VALIDATION.md`.

`tests/preview-fixture.mjs` is explicit integration test data. It uses a local copy of the Big Buck Bunny trailer, credited to Blender Foundation, CC BY 3.0, obtained from https://media.w3.org/2010/05/bunny/trailer.mp4. Put that file at `build/test-video.mp4` after building, then run `node tests/preview-fixture.mjs` and open http://127.0.0.1:4174. It is not a live provider result and is never added to the production registry.

## Upstream references and rollback

Official Nuvio desktop and mobile are Kotlin Multiplatform/Compose projects:
- https://github.com/NuvioMedia/NuvioDesktop at 00e50ef
- https://github.com/NuvioMedia/NuvioMobile at de60c5a

They inform the task flow; no native player port or TV UI patch is used. Astryx 0.7.11 is the required UI system. React 19 renders its Button, TextInput, Selector, Dialog, Text, Heading, Layout and stack components with the maintained neutral theme in dark mode. App CSS only defines browser media geometry.

The unchanged previous release artifacts remain in `dist/` for comparison and rollback. They are not served by this server or copied by Dockerfile.browser. The existing production deployment is unchanged. Do not publish the legacy assets as part of this rewrite.
