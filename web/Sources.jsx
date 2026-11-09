import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Icon } from '@astryxdesign/core/Icon';
import { Selector } from '@astryxdesign/core/Selector';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { RotateCw } from 'lucide-react';
import { NuvioPlayIcon, BoltIcon } from './Icons.jsx';
import { resource, supports, safeURL, sourceLabel } from './api';
import { streamInfo, filterStreams, parseStreamMeta } from './streams';
import { selectBestStream, waitForSources } from './autoSelect.js';
import { availabilityFromStreams, rememberAvailability } from './badges.js';

// Rankings are warmed as soon as sources arrive, so Play does not start the probing.
const rankCache = new Map();
const rankPending = new Map();
const RANK_TTL = 10 * 60 * 1000;

const canPlayTypeFor = () => {
  const video = document.createElement('video');
  return (type) => video.canPlayType(type);
};

function cachedRanking(key) {
  const entry = rankCache.get(key);
  if (!entry || Date.now() - entry.at > RANK_TTL) return null;
  return entry.ranked;
}

export function clearRankingCache() {
  rankCache.clear();
  rankPending.clear();
}

function rankSources(key, rows, meta, onStatus) {
  if (rankPending.has(key)) return rankPending.get(key);
  const controller = new AbortController();
  const pending = selectBestStream(rows, {
    meta,
    signal: controller.signal,
    saveData: Boolean(navigator.connection?.saveData),
    canPlayType: canPlayTypeFor(),
    onStatus
  })
    .then((ranked) => {
      rankCache.set(key, { ranked, at: Date.now() });
      return ranked;
    })
    .finally(() => rankPending.delete(key));
  rankPending.set(key, pending);
  return pending;
}

export function Sources({ addons, meta, videoId, onPlay, autoStart = false, initialPicker = false, onSelectingChange, addonsLoading = false, showActions = true, openPicker = 0 }) {
  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [retry, setRetry] = useState(0);
  const [filters, setFilters] = useState({ resolution: 'all', addon: 'all', cache: 'all' });

  const [showPicker, setShowPicker] = useState(initialPicker);
  const [selecting, setSelecting] = useState(false);
  const [selectionStatus, setSelectionStatus] = useState('');
  const [rankState, setRankState] = useState('idle');
  const discoveryRef = useRef(null);
  const selectionRef = useRef(null);
  const stateRef = useRef({ rows, pending, meta });
  stateRef.current = { rows, pending: pending + (addonsLoading ? 1 : 0), meta };
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;

  const rankingKey = `${meta.type}:${videoId}:${rows.length}`;

  useEffect(() => {
    const run = { controller: new AbortController(), queried: new Set() };
    discoveryRef.current = run;
    setRows([]);
    setPending(0);
    setFailed(0);
    setSelecting(false);
    setSelectionStatus('');
    setRankState('idle');
    setShowPicker(initialPicker);
    stateRef.current = { rows: [], pending: 1, meta };
    return () => {
      run.controller.abort();
      selectionRef.current?.abort();
    };
  }, [videoId, meta.type, retry]);

  useEffect(() => {
    const run = discoveryRef.current;
    for (const a of addons.filter(a => supports(a, 'stream', meta.type))) {
      if (run.queried.has(a.index)) continue;
      run.queried.add(a.index);
      setPending(n => n + 1);
      resource(a, 'stream', meta.type, videoId, '', run.controller.signal)
        .then(data => {
          if (run.controller.signal.aborted) return;
          const incoming = (Array.isArray(data.streams) ? data.streams : []).map(stream => ({ a, stream, info: streamInfo(a, stream) }));
          setRows(old => [...old, ...incoming]);
        })
        .catch(() => { if (!run.controller.signal.aborted) setFailed(n => n + 1); })
        .finally(() => { if (!run.controller.signal.aborted) setPending(n => n - 1); });
    }
  }, [addons, videoId, meta.type, retry]);

  const chooseManually = () => {
    selectionRef.current?.abort();
    setSelecting(false);
    setSelectionStatus('');
    setShowPicker(true);
  };

  // Warm the ranking while the user is still looking at the source list.
  useEffect(() => {
    if (pending > 0 || !rows.length) return;
    if (cachedRanking(rankingKey)) {
      setRankState('ready');
      return;
    }
    let active = true;
    setRankState('ranking');
    rankSources(rankingKey, rows, stateRef.current.meta)
      .then((ranked) => {
        if (!active) return;
        setRankState(ranked.length ? 'ready' : 'failed');
      })
      .catch(() => { if (active) setRankState('failed'); });
    return () => { active = false; };
  }, [pending, rows, rankingKey]);

  const playAutomatically = async () => {
    selectionRef.current?.abort();
    const controller = new AbortController();
    selectionRef.current = controller;
    setSelecting(true);
    try {
      let ranked = cachedRanking(rankingKey);
      if (!ranked) {
        setSelectionStatus('Checking sources for your connection…');
        const available = await waitForSources(() => stateRef.current, {
          signal: controller.signal,
          canPlayType: canPlayTypeFor()
        });
        if (controller.signal.aborted) return;
        ranked = await rankSources(rankingKey, available, stateRef.current.meta, setSelectionStatus);
      }
      if (controller.signal.aborted) return;
      if (!ranked?.length) {
        setShowPicker(true);
        setSelectionStatus('No source passed the connection check. Choose a stream below or refresh sources.');
        return;
      }
      const viable = ranked.some(row => row.fits) ? ranked.filter(row => row.fits) : ranked.slice(0, 1);
      const streams = viable.map(row => ({
        ...row.stream,
        autoSelection: {
          addon: row.a.name,
          resolution: row.info.resolution,
          mbps: row.measurement.mbps,
          ttfbMs: row.measurement.ttfbMs,
          saveData: Boolean(navigator.connection?.saveData)
        }
      }));
      onPlayRef.current(streams[0], { alternatives: streams.slice(1) });
    } catch {
      if (!controller.signal.aborted) {
        setShowPicker(true);
        setSelectionStatus('Automatic selection could not finish. Choose a stream below.');
      }
    } finally {
      if (selectionRef.current === controller) setSelecting(false);
    }
  };

  useEffect(() => {
    if (autoStart) playAutomatically();
    return () => selectionRef.current?.abort();
  }, [autoStart, videoId]);

  useEffect(() => { onSelectingChange?.(selecting); }, [selecting, onSelectingChange]);

  // The parent can ask for the full stream list (desktop action row lives outside).
  useEffect(() => {
    if (!openPicker) return;
    selectionRef.current?.abort();
    setSelecting(false);
    setShowPicker(true);
  }, [openPicker]);

  // Remember what the providers actually offer, so the poster can show it later.
  useEffect(() => {
    if (pending > 0 || !rows.length) return;
    const key = (meta.type || 'movie') + ':' + meta.id;
    rememberAvailability(key, availabilityFromStreams(rows.map((row) => row.stream)));
  }, [pending, rows, meta.id, meta.type]);

  const playable = rows.filter(({ stream }) => safeURL(stream.url));
  const visible = filterStreams(playable, filters);
  const unsupported = rows.length - playable.length;
  const choose = (key, value) => setFilters((old) => ({ ...old, [key]: value }));
  const qualities = [...new Set(playable.map((r) => r.info.resolution))].sort(
    (a, b) => (parseInt(b) || 0) - (parseInt(a) || 0)
  );
  const streamProviders = addons.filter((a) => supports(a, 'stream', meta.type));
  const cachedCount = playable.filter((r) => r.info.cache === 'cached').length;

  return (
    <VStack gap={4} className="sources">
      {showActions && (
        <HStack gap={3} wrap="wrap" className="playback-actions" aria-label="Playback options">
          <Button variant="primary" label="Play" icon={<NuvioPlayIcon size={16} />} onClick={playAutomatically} isLoading={selecting} />
          <Button variant="secondary" label="Choose stream" onClick={chooseManually} />
        </HStack>
      )}
      {selectionStatus && <Text role="status" aria-live="polite" aria-busy={selecting}>{selectionStatus}</Text>}
      {selecting && <Button variant="ghost" label="Cancel selection" onClick={chooseManually} />}
      {!selectionStatus && rankState === 'ranking' && (
        <Text type="supporting" color="secondary">Ranking sources for your connection…</Text>
      )}
      {!selectionStatus && rankState === 'ready' && (
        <Text type="supporting" color="secondary">A stream is ranked and ready to play.</Text>
      )}
      {!selectionStatus && rankState === 'failed' && (
        <Text type="supporting" color="secondary">No source passed the connection check. Play opens the stream list instead.</Text>
      )}
      {!showPicker && !selecting && <Text type="supporting" color="secondary">Play starts the best measured source. Choose stream opens all sources.</Text>}
      {showPicker && <>
      <HStack vAlign="center" hAlign="between" wrap="wrap" gap={2}>
        <Heading level={3}>Available Streams</Heading>
        <Text role="status" type="supporting" color="secondary">
          {visible.length} of {playable.length} streams
          {pending > 0 ? ` · ${pending} addons querying…` : ''}
        </Text>
      </HStack>

      {/* Nuvio ProviderFilterRow quick-tap pills */}
      <div className="nuvio-stream-chips" role="group" aria-label="Quick stream filters">
        <button
          type="button"
          className={`nuvio-chip ${
            filters.resolution === 'all' && filters.cache === 'all' && filters.addon === 'all'
              ? 'active'
              : ''
          }`}
          onClick={() => setFilters({ resolution: 'all', addon: 'all', cache: 'all' })}
        >
          All ({playable.length})
        </button>
        {cachedCount > 0 && (
          <button
            type="button"
            className={`nuvio-chip chip-cached ${filters.cache === 'cached' ? 'active' : ''}`}
            onClick={() => choose('cache', filters.cache === 'cached' ? 'all' : 'cached')}
          >
            <BoltIcon size={13} />
            TorBox Instant ({cachedCount})
          </button>
        )}
        {qualities
          .filter((q) => q !== 'unknown')
          .map((q) => (
            <button
              key={q}
              type="button"
              className={`nuvio-chip ${filters.resolution === q ? 'active' : ''}`}
              onClick={() => choose('resolution', filters.resolution === q ? 'all' : q)}
            >
              {q === '2160p' ? '4K UHD' : q}
            </button>
          ))}
      </div>

      {/* Astryx Structured Filter Selectors */}
      <HStack gap={3} wrap="wrap" className="source-filters">
        <Selector
          label="Resolution"
          presentation="popover"
          value={filters.resolution}
          onChange={(v) => choose('resolution', v)}
          options={[
            { value: 'all', label: 'All resolutions' },
            ...qualities.map((value) => ({
              value,
              label:
                value === 'unknown'
                  ? 'Unknown resolution'
                  : value === '2160p'
                  ? '4K · 2160p'
                  : value
            }))
          ]}
        />
        <Selector
          label="Addon"
          presentation="popover"
          value={filters.addon}
          onChange={(v) => choose('addon', v)}
          options={[
            { value: 'all', label: 'All addons' },
            ...streamProviders.map((a) => ({ value: String(a.index), label: a.name }))
          ]}
        />
        <Selector
          label="TorBox cache"
          presentation="popover"
          value={filters.cache}
          onChange={(v) => choose('cache', v)}
          options={[
            { value: 'all', label: 'All cache states' },
            { value: 'cached', label: 'Cached on TorBox' },
            { value: 'uncached', label: 'Uncached on TorBox' },
            { value: 'unknown', label: 'Unknown / other provider' }
          ]}
        />
      </HStack>

      {/* Nuvio StreamCard List */}
      <div className="source-results" aria-label="Stream results">
        {visible.map(({ a, stream, info }, i) => {
          const parsed = parseStreamMeta(a, stream, info);
          const is4k = info.resolution === '2160p' || info.resolution === '4320p';
          const isCached = info.cache === 'cached';
          return (
            <button
              type="button"
              key={a.index + ':' + i}
              className={`nuvio-stream-card ${isCached ? 'stream-cached' : ''}`}
              aria-label={sourceLabel(a, stream) || 'Play stream'}
              onClick={() => onPlay(stream)}
            >
              <div className="stream-card-main">
                <div className="stream-badge-row">
                  <Badge
                    variant={is4k ? 'yellow' : info.resolution === '1080p' ? 'blue' : 'neutral'}
                    label={parsed.resolutionLabel}
                  />
                  {isCached && (
                    <Badge
                      variant="green"
                      icon={<BoltIcon size={12} />}
                      label="TorBox Instant"
                    />
                  )}
                  {info.cache === 'uncached' && <Badge variant="orange" label="Uncached" />}
                  {parsed.size && <Badge variant="neutral" label={parsed.size} />}
                  {parsed.tags.map((t) => (
                    <Badge key={t} variant="purple" label={t} />
                  ))}
                </div>
                <span className="stream-primary-title">{parsed.primaryTitle}</span>
                <span className="stream-secondary-sub">
                  {a.name}
                  {parsed.secondaryLine && parsed.secondaryLine !== a.name
                    ? ` · ${parsed.secondaryLine}`
                    : ''}
                </span>
              </div>
              <div className="stream-card-action">
                <span className="stream-addon-tag">{a.name}</span>
                <span className="stream-play-circle" aria-hidden="true">
                  <NuvioPlayIcon size={16} />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {!visible.length && (
        <Text role="status" color="secondary">
          {pending
            ? 'Querying addon providers for streams…'
            : playable.length
            ? 'No streams match these filters.'
            : 'No browser-playable streams found for this title.'}
        </Text>
      )}

      <HStack gap={3} wrap="wrap">
        {Object.values(filters).some((v) => v !== 'all') && (
          <Button
            variant="secondary"
            label="Clear filters"
            onClick={() => setFilters({ resolution: 'all', addon: 'all', cache: 'all' })}
          />
        )}
        <Button
          variant="ghost"
          icon={<Icon icon={RotateCw} />}
          label="Refresh sources"
          onClick={() => {
            clearRankingCache();
            setRetry(retry + 1);
          }}
          isDisabled={pending > 0}
        />
      </HStack>

      {unsupported > 0 && (
        <Text type="supporting" color="secondary">
          {unsupported} P2P torrent magnet links omitted in web mode.
        </Text>
      )}
      {failed > 0 && (
        <Text type="supporting" color="secondary">
          {failed} addons timed out or did not respond.
        </Text>
      )}
      </>}
    </VStack>
  );
}
