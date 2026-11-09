# Automatic stream selection

Implemented for release v0.4.0 on `feat/automatic-stream-selection`. Release publication and production reconciliation are verified separately.

## Behaviour

- **Play** starts automatic selection. **Choose stream**, beside it on the hero and in title/episode playback options, opens the existing manual filters and source list. The player also offers Choose stream.
- Addons resolve concurrently and appear incrementally. Each addon is queried once per title/episode rather than restarting every time another manifest arrives.
- Discovery proceeds after a brief window of eligible HTTP results, or when all providers finish. Torrent-only, known uncached TorBox and explicitly unsupported codec results do not end that window early. The discovery deadline is 19 seconds; a slow addon does not hold up already eligible sources for that entire period.
- Selection samples at most four distinct delivery URLs, including different addons and a lower-bitrate alternative. Duplicate URLs reported by multiple addons share an opaque identity and are sampled once.
- Samples travel through the same authenticated gateway used for playback, so they include both the browser-to-gateway and gateway-to-provider path. Response startup time is an HTTP latency measurement, not ICMP ping.
- Each media sample reads at most 1 MiB. Samples run sequentially, normally with a 3.5-second deadline, or up to 8 seconds when only one candidate exists. The combined probing deadline is 12 seconds. Useful partial samples of at least 64 KiB survive a probe deadline; user cancellation still discards them.
- Browser Data Saver reduces the shortlist to two sources and each sample to 128 KiB, with a 720p preference. HLS playlist requests are additional to the media-byte limits.
- Ranking balances measured throughput, startup delay, resolution, reported TorBox cache state and browser codec support. File size and runtime provide an estimated bitrate when available; otherwise conservative quality-based estimates apply. A 35% throughput margin leaves headroom.
- Known uncached TorBox results are never probed automatically. Cache labels come from addon metadata; this does not independently query the TorBox cache API.
- If there are sustainable checked candidates, automatic fallback uses those candidates only. If none fits the estimated connection budget, it tries the lowest-risk checked candidate once. This can still buffer when no suitable source exists.
- A failed automatic choice, 20-second startup timeout or sustained 15-second playback stall can advance to the next checked candidate. Position is preserved. Pausing, seeking and browser autoplay permission failures do not trigger source cycling. No candidate is retried in a loop.
- Choose stream or Cancel selection aborts sampling. Closing the title panel also cancels it. Manual stream selection bypasses automatic ranking.

## HLS and identity

HLS probes follow playlists and read an actual media segment. Multi-rendition playlists are distinguished from fixed-quality HLS; fixed-quality streams must meet the same bitrate budget as files. For adaptive HLS the lowest-bandwidth rendition is sampled. The player identifies HLS from content type even when the root URL is an opaque handle.

Playlist variants, segments, maps and encryption-key URLs are rewritten to opaque resource handles rather than revealing upstream URLs in query strings. Only resources found in the upstream playlist can be requested. Probes and child resources require the same identity as playback. Provider URLs and credentials are not compiled into client assets.

## Verification on 2026-11-09

- Production build and Astryx built-output checks pass. **35 automated tests pass.** Coverage includes quality versus bandwidth, cache/codec exclusions, duplicate delivery URLs, HTML rejection, partial samples, cancellation, discovery timing, Data Saver, fixed/adaptive HLS, byte caps and identity isolation.
- In a synthetic browser playback lab, the highest-ranked source deliberately returned a playback error. The player switched to the checked 720p alternative and played video. Request logs showed no request to the known uncached fixture URL.
- Synthetic MP4 and HLS played. Episode selection used the chosen episode. Choose stream opened the manual list; manually chosen video played without an Auto label. Cancellation left a usable picker. An all-failed case exposed the manual list instead of leaving the user waiting.
- A simulated media error at 14 seconds switched sources and resumed at 14.4 seconds. This is an injected error test, not a real-provider mid-film failure.
- At a 320px viewport, hero Play and Choose stream fit beside each other with 44px targets and no document overflow. The final phone playback check advanced from 0.42 to 1.63 seconds, readyState 4, paused false.
- **Live PenguPlay sample:** automatic selection chose the configured 1080p Big Buck Bunny stream. Video advanced from 29.565 to 31.166 seconds over a 1.6-second observation, readyState 4, paused false. The test was stopped afterward.
- **Live TorBox comparison remains unverified:** AIOStreams manifest discovery did not succeed from this local preview. This does not establish that AIOStreams is down for native clients or production.

## Limits and local artifacts

A short transfer sample is an estimate, not a guarantee of sustained bandwidth or a globally best source. Only the bounded shortlist is compared. Unknown codec metadata, changing CDN conditions, expired sessions and incorrect cache labels can still cause fallback. Native iPhone/Safari autoplay and production Authentik playback were not tested in this feature pass. Playback still uses the application's existing forward-auth and local profile model.

Local preview: http://127.0.0.1:4173/. Test-only synthetic media occupies about 7.6 MiB under `.private/auto-media` on `/home`. The disposable lab uses `tests/auto-preview.mjs` and loopback ports 4175/4176; it is stopped after validation. Runtime addon configuration was not changed. Local build output, logs and browser-local test progress were written.

Rollback reference: the published v0.3.1 release and `origin/main`. Preserve the feature working tree before restoring that source and rebuilding the local preview.

References: [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation), [browser media capability reporting](https://developer.mozilla.org/en-US/docs/Web/API/MediaCapabilities/decodingInfo), [Stremio stream response protocol](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/stream.md).
