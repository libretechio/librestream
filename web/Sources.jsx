import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCw } from 'lucide-react';
import { Button, Chip, Spinner } from './ui.jsx';
import { resource, supports, safeURL } from './api';
import { streamInfo, filterStreams } from './streams';
import { availabilityFromStreams, rememberAvailability } from './badges.js';
import { readRanking, rankingKey, warmTitle, clearRankings } from './connection.js';

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

  // Play: use the warm ranking and start synchronously, inside the tap, so the
  // browser counts it as user activation. Never opens the list, never measures.
  const playAutomatically = () => {
    setShowPicker(false);
    setSelectionStatus('');
    const ready = readRanking(cacheKey);
    if (ready?.ranked?.length) {
      const streams = ready.ranked.map((row) => ({
        ...row.stream,
        autoSelection: {
          addon: row.a?.name || row.a?.index,
          resolution: row.info?.resolution || `${row.resolution || ''}p`,
          bitrate: Math.round(row.bitrate || 0),
          pingMs: ready.profile?.pingMs || 0
        }
      }));
      onPlayRef.current(streams[0], { alternatives: streams.slice(1) });
      return;
    }
    playAfterDiscovery();
  };

  // Cold path only: discovery has not finished, so wait for it once.
  const playAfterDiscovery = async () => {
    selectionRef.current?.abort();
    const controller = new AbortController();
    selectionRef.current = controller;
    setSelecting(true);
    try {
      setSelectionStatus('Choosing a source…');
      const warmed = await warmTitle({ key: cacheKey, addons, type: meta.type, videoId, meta, signal: controller.signal }).catch(() => null);
      if (controller.signal.aborted) return;
      const entry = readRanking(cacheKey) || warmed;
      const available = entry?.rows?.length ? entry.rows : stateRef.current.rows;
      if (!available.length) {
        setSelectionStatus('No source is available yet. Pick one from the list.');
        return;
      }
      const ranked = entry?.verified ? entry.ranked : [];
      if (!ranked.length) {
        setSelectionStatus('No playable source. Pick one from the list.');
        return;
      }
      const streams = ranked.map((row) => ({
        ...row.stream,
        autoSelection: {
          addon: row.a?.name || row.a?.index,
          resolution: row.info?.resolution || `${row.resolution || ''}p`,
          bitrate: Math.round(row.bitrate || 0),
          pingMs: entry?.profile?.pingMs || 0
        }
      }));
      onPlayRef.current(streams[0], { alternatives: streams.slice(1) });
    } catch {
      if (!controller.signal.aborted) {
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

  useEffect(() => {
    if (!openPicker) return;
    selectionRef.current?.abort();
    setSelecting(false);
    setSelectionStatus('');
    setShowPicker(true);
  }, [openPicker]);

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
