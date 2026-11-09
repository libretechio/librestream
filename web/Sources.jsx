import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCw } from 'lucide-react';
import { Button, Chip, Spinner } from './ui.jsx';
import { resource, supports, safeURL } from './api';
import { streamInfo, filterStreams } from './streams';
import { availabilityFromStreams, rememberAvailability } from './badges.js';
import { rankByProfile, readRanking, writeRanking, rankingKey, ensureConnectionProfile, warmTitle, clearRankings } from './connection.js';

export function Sources({
  addons,
  meta,
  videoId,
  onPlay,
  autoStart = false,
  initialPicker = false,
  addonsLoading = false,
  showActions = false,
  openPicker = 0,
  playRequest = 0,
  onRankReady
}) {
  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [retry, setRetry] = useState(0);
  const [filters, setFilters] = useState({ resolution: 'all', addon: 'all', cache: 'all' });
  const [showPicker, setShowPicker] = useState(Boolean(initialPicker));
  const [selecting, setSelecting] = useState(false);
  const [selectionStatus, setSelectionStatus] = useState('');
  const [rankState, setRankState] = useState('idle');

  const discoveryRef = useRef(null);
  const selectionRef = useRef(null);
  const stateRef = useRef({ rows, pending, meta });
  stateRef.current = { rows, pending: pending + (addonsLoading ? 1 : 0), meta };
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;

  const cacheKey = rankingKey(meta, videoId, meta.type);

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

  // One fetch per title: reuse the warm ranking instead of querying providers again.
  useEffect(() => {
    const run = discoveryRef.current;
    let active = true;
    setPending(1);
    warmTitle({
      key: cacheKey,
      addons,
      type: meta.type,
      videoId,
      meta,
      signal: run.controller.signal
    })
      .then((entry) => {
        if (!active || run.controller.signal.aborted) return;
        if (!entry) {
          setFailed((n) => n + 1);
          return;
        }
        setRows(entry.rows);
        setRankState(entry.ranked?.length ? 'ready' : 'failed');
      })
      .catch(() => {
        if (active && !run.controller.signal.aborted) setFailed((n) => n + 1);
      })
      .finally(() => {
        if (active && !run.controller.signal.aborted) setPending(0);
      });
    return () => {
      active = false;
    };
  }, [cacheKey, addons, videoId, meta.type, retry]);

  // Remember what the providers actually offer, for the poster strip.
  useEffect(() => {
    if (pending > 0 || !rows.length) return;
    rememberAvailability(
      (meta.type || 'movie') + ':' + meta.id,
      availabilityFromStreams(rows.map((row) => row.stream))
    );
  }, [pending, rows, meta.id, meta.type]);

  // Rank as soon as the sources are in, using the connection measured at start-up.
  useEffect(() => {
    if (pending > 0 || !rows.length) return;
    if (readRanking(cacheKey)?.ranked?.length) {
      setRankState('ready');
      return;
    }
    let active = true;
    setRankState('ranking');
    ensureConnectionProfile()
      .then((measured) => {
        if (!active) return;
        const ranked = rankByProfile(rows, { meta, profile: measured });
        writeRanking(cacheKey, { rows, ranked, profile: measured });
        setRankState(ranked.length ? 'ready' : 'failed');
        if (ranked.length) onRankReady?.(ranked);
      })
      .catch(() => {
        if (active) setRankState('failed');
      });
    return () => {
      active = false;
    };
  }, [pending, rows, cacheKey]);

  // Play: use the warm ranking. Never opens the list, never measures again.
  const playAutomatically = async () => {
    selectionRef.current?.abort();
    const controller = new AbortController();
    selectionRef.current = controller;
    setSelecting(true);
    try {
      let entry = readRanking(cacheKey);
      if (!entry?.ranked?.length) {
        setSelectionStatus('Choosing a source…');
        const measured = await ensureConnectionProfile();
        // Wait for the in-flight warm fetch rather than starting another one.
        const warmed = await Promise.race([
          warmTitle({ key: cacheKey, addons, type: meta.type, videoId, meta, signal: controller.signal }),
          new Promise((resolve) => setTimeout(() => resolve(null), 4000))
        ]).catch(() => null);
        entry = readRanking(cacheKey) || warmed;
        if (controller.signal.aborted) return;
        const available = entry?.rows?.length ? entry.rows : stateRef.current.rows;
        if (controller.signal.aborted) return;
        if (!available.length) {
          setSelectionStatus('No source is available yet. Choose a stream to see the list.');
          setShowPicker(true);
          return;
        }
        const ranked = rankByProfile(available, { meta: stateRef.current.meta, profile: measured });
        entry = { rows: available, ranked, profile: measured };
        writeRanking(cacheKey, entry);
      }
      if (controller.signal.aborted) return;
      const ranked = entry.ranked;
      if (!ranked?.length) {
        setShowPicker(true);
        setSelectionStatus('No playable source. Pick one from the list.');
        return;
      }
      const streams = ranked.map((row) => ({
        ...row.stream,
        autoSelection: {
          addon: row.a?.name || row.a?.index,
          resolution: row.info?.resolution || `${row.resolution || ''}p`,
          bitrate: Math.round(row.bitrate || 0),
          pingMs: entry.profile?.pingMs || 0
        }
      }));
      onPlayRef.current(streams[0], { alternatives: streams.slice(1) });
    } catch {
      if (!controller.signal.aborted) {
        setShowPicker(true);
        setSelectionStatus('Could not pick a source automatically.');
      }
    } finally {
      if (selectionRef.current === controller) setSelecting(false);
    }
  };

  useEffect(() => {
    if (autoStart) playAutomatically();
    return () => selectionRef.current?.abort();
  }, [autoStart, videoId]);

  // An explicit Play press re-runs selection, even when autoStart is unchanged.
  useEffect(() => {
    if (!playRequest) return;
    playAutomatically();
    return () => selectionRef.current?.abort();
  }, [playRequest]);

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
                clearRankings();
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
