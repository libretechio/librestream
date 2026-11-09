import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCw } from 'lucide-react';
import { Button, Chip, Spinner } from './ui.jsx';
import { resource, supports, safeURL } from './api';
import { streamInfo, filterStreams } from './streams';
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

export function Sources({
  addons,
  meta,
  videoId,
  onPlay,
  autoStart = false,
  initialPicker = false,
  addonsLoading = false,
  showActions = false,
  openPicker = 0
}) {
  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [retry, setRetry] = useState(0);
  const [filters, setFilters] = useState({ resolution: 'all', addon: 'all', cache: 'all' });
  const [showPicker, setShowPicker] = useState(initialPicker || true);
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
    stateRef.current = { rows: [], pending: 1, meta };
    return () => {
      run.controller.abort();
      selectionRef.current?.abort();
    };
  }, [videoId, meta.type, retry]);

  useEffect(() => {
    const run = discoveryRef.current;
    for (const addon of addons.filter((entry) => supports(entry, 'stream', meta.type))) {
      if (run.queried.has(addon.index)) continue;
      run.queried.add(addon.index);
      setPending((n) => n + 1);
      resource(addon, 'stream', meta.type, videoId, '', run.controller.signal)
        .then((data) => {
          if (run.controller.signal.aborted) return;
          const incoming = (Array.isArray(data.streams) ? data.streams : []).map((stream) => ({
            a: addon,
            stream,
            info: streamInfo(addon, stream)
          }));
          setRows((old) => [...old, ...incoming]);
        })
        .catch(() => {
          if (!run.controller.signal.aborted) setFailed((n) => n + 1);
        })
        .finally(() => {
          if (!run.controller.signal.aborted) setPending((n) => n - 1);
        });
    }
  }, [addons, videoId, meta.type, retry]);

  // Remember what the providers actually offer, for the poster strip.
  useEffect(() => {
    if (pending > 0 || !rows.length) return;
    rememberAvailability(
      (meta.type || 'movie') + ':' + meta.id,
      availabilityFromStreams(rows.map((row) => row.stream))
    );
  }, [pending, rows, meta.id, meta.type]);

  // Warm the ranking while the stream list is on screen.
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
        if (active) setRankState(ranked.length ? 'ready' : 'failed');
      })
      .catch(() => {
        if (active) setRankState('failed');
      });
    return () => {
      active = false;
    };
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
        setSelectionStatus('No source passed the connection check. Pick one below.');
        return;
      }
      const viable = ranked.some((row) => row.fits) ? ranked.filter((row) => row.fits) : ranked.slice(0, 1);
      const streams = viable.map((row) => ({
        ...row.stream,
        autoSelection: {
          addon: row.a.name,
          resolution: row.info.resolution,
          mbps: row.measurement.mbps,
          ttfbMs: row.measurement.ttfbMs
        }
      }));
      onPlayRef.current(streams[0], { alternatives: streams.slice(1) });
    } catch {
      if (!controller.signal.aborted) {
        setShowPicker(true);
        setSelectionStatus('Automatic selection could not finish. Pick a stream below.');
      }
    } finally {
      if (selectionRef.current === controller) setSelecting(false);
    }
  };

  useEffect(() => {
    if (autoStart) playAutomatically();
    return () => selectionRef.current?.abort();
  }, [autoStart, videoId]);

  const playable = rows.filter(({ stream }) => safeURL(stream.url));
  const visible = filterStreams(playable, filters);
  const qualities = [...new Set(playable.map((row) => row.info.resolution))].sort(
    (a, b) => (parseInt(b) || 0) - (parseInt(a) || 0)
  );
  const providers = addons.filter((addon) => supports(addon, 'stream', meta.type));
  const cachedCount = playable.filter((row) => row.info.cache === 'cached').length;
  const choose = (key, value) => setFilters((old) => ({ ...old, [key]: value }));

  return (
    <div className="ls-streams">
      {showActions && (
        <div style={{ display: 'flex', gap: 'var(--ls-2)', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            icon={<Play size={14} fill="currentColor" strokeWidth={0} />}
            label="Play"
            busy={selecting}
            onClick={playAutomatically}
          />
          <Button variant="secondary" label="Choose stream" onClick={() => setShowPicker(true)} />
        </div>
      )}

      {selectionStatus && (
        <p className="ls-streams-count" role="status" aria-live="polite">
          {selectionStatus}
        </p>
      )}

      {showPicker && (
        <>
          <div className="ls-streams-head">
            <div style={{ display: 'flex', gap: 'var(--ls-1)', flexWrap: 'wrap' }}>
              <Chip
                active={filters.resolution === 'all' && filters.cache === 'all'}
                onClick={() => setFilters({ resolution: 'all', addon: 'all', cache: 'all' })}
              >
                All
              </Chip>
              {cachedCount > 0 && (
                <Chip active={filters.cache === 'cached'} onClick={() => choose('cache', filters.cache === 'cached' ? 'all' : 'cached')}>
                  Cached {cachedCount}
                </Chip>
              )}
              {qualities
                .filter((quality) => quality !== 'unknown')
                .slice(0, 5)
                .map((quality) => (
                  <Chip
                    key={quality}
                    active={filters.resolution === quality}
                    onClick={() => choose('resolution', filters.resolution === quality ? 'all' : quality)}
                  >
                    {quality === '2160p' ? '4K' : quality}
                  </Chip>
                ))}
            </div>
            <span className="ls-streams-count">
              {visible.length} of {playable.length}
              {pending > 0 ? ` · ${pending} querying` : ''}
            </span>
            {Object.values(filters).some((value) => value !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                label="Clear"
                onClick={() => setFilters({ resolution: 'all', addon: 'all', cache: 'all' })}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCw size={13} />}
              label="Refresh"
              disabled={pending > 0}
              onClick={() => {
                rankCache.clear();
                setRetry((n) => n + 1);
              }}
            />
          </div>

          {pending > 0 && !visible.length && (
            <p className="ls-streams-count" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ls-2)' }}>
              <Spinner label="Querying addons" /> Querying {providers.length} addons…
            </p>
          )}

          {visible.map(({ a, stream, info }, index) => {
            const quality = info.resolution === '2160p' ? '4K' : info.resolution === 'unknown' ? 'AUTO' : info.resolution;
            const filename = stream.behaviorHints?.filename || stream.title || stream.name || 'Stream';
            const size = stream.behaviorHints?.videoSize
              ? `${(Number(stream.behaviorHints.videoSize) / 1024 ** 3).toFixed(1)} GB`
              : '';
            return (
              <button
                type="button"
                key={a.index + ':' + index}
                className="ls-stream"
                onClick={() => onPlay(stream)}
                aria-label={`Play ${a.name} ${filename}`}
              >
                <span className="ls-stream-tag">{quality}</span>
                <span className="ls-stream-body">
                  <span className="ls-stream-name">{filename}</span>
                  <span className="ls-stream-sub">
                    <span>{a.name}</span>
                    {size && (
                      <>
                        <span>·</span>
                        <span>{size}</span>
                      </>
                    )}
                    {info.cache === 'cached' && (
                      <>
                        <span>·</span>
                        <span className="ls-stream-dot" aria-hidden="true" />
                        <span className="ls-stream-cached">cached</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="ls-stream-play" aria-hidden="true">
                  <Play size={11} fill="currentColor" strokeWidth={0} />
                </span>
              </button>
            );
          })}

          {!visible.length && pending === 0 && (
            <p className="ls-streams-count">
              {playable.length ? 'No streams match these filters.' : 'No browser-playable streams found.'}
            </p>
          )}

          {failed > 0 && <p className="ls-streams-count">{failed} addons did not respond.</p>}
        </>
      )}
    </div>
  );
}
