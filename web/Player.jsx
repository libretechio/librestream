import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Subtitles,
  Languages,
  Gauge,
  Signal,
  Check,
  Layers,
  PictureInPicture,
  X
} from 'lucide-react';
import { safeURL, readState, writeState } from './api';
import { fetchSubtitles, mergeSubtitleTracks, languageName } from './subtitles.js';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const CUE_SIZES = { small: '0.85em', medium: '1.05em', large: '1.35em' };
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function readCueSize() {
  try {
    const value = localStorage.getItem('librestream:cue_size');
    return CUE_SIZES[value] ? value : 'medium';
  } catch {
    return 'medium';
  }
}

export function Player({
  meta,
  stream,
  user,
  addons = [],
  videoId,
  playerStyle = 'compact',
  onProgress,
  onBack,
  onFailure,
  onSwitchSource
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const hlsRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [needsGesture, setNeedsGesture] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [activePanel, setActivePanel] = useState(null); // 'tracks' | 'speed' | 'quality'
  const [addonSubs, setAddonSubs] = useState([]);
  const [builtinSubs, setBuiltinSubs] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsNotice, setSubsNotice] = useState('');
  const [activeSubId, setActiveSubId] = useState('off');
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudio, setActiveAudio] = useState(-1);
  const [levels, setLevels] = useState([]);
  const [activeLevel, setActiveLevel] = useState(-1);
  const [cueSize, setCueSize] = useState(readCueSize);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState(null);

  const subtitleTracks = useMemo(
    () => mergeSubtitleTracks(builtinSubs, addonSubs),
    [builtinSubs, addonSubs]
  );

  const wakeControls = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !activePanel) setControlsVisible(false);
    }, 3200);
  };

  const saveProgress = () => {
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration) && Number.isFinite(video.currentTime)) {
      onProgress?.({ ...meta, position: video.currentTime, duration: video.duration });
    }
  };

  // Playback source setup, resume, stall detection and bounded fallback.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const controller = new AbortController();
    let hls = null;
    let active = true;
    let failing = false;
    let lastSaved = 0;
    let lastPosition = meta.resumePosition || 0;
    let stallTimer;
    let startupTimer;
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setIsPlaying(false);
    setIsBuffering(true);
    setNeedsGesture(false);
    setFeedback('');
    setBuiltinSubs([]);
    setAudioTracks([]);
    setLevels([]);
    setActiveAudio(-1);
    setActiveLevel(-1);

    const readAudioTracks = () => {
      if (!active) return;
      if (hls?.audioTracks?.length) {
        setAudioTracks(
          hls.audioTracks.map((track, index) => ({
            index,
            label: track.name || track.lang || `Track ${index + 1}`,
            language: languageName(track.lang || track.name),
            current: hls.audioTrack === index
          }))
        );
        setActiveAudio(hls.audioTrack);
        return;
      }
      const native = video.audioTracks;
      if (native && native.length) {
        const list = [];
        for (let index = 0; index < native.length; index += 1) {
          const track = native[index];
          list.push({
            index,
            label: track.label || track.language || `Track ${index + 1}`,
            language: languageName(track.language),
            current: Boolean(track.enabled)
          });
        }
        setAudioTracks(list);
      }
    };

    const handleError = () => {
      if (!active || failing) return;
      failing = true;
      clearTimeout(startupTimer);
      clearTimeout(stallTimer);
      setControlsVisible(true);
      if (onFailure?.(video.currentTime || lastPosition)) {
        setIsBuffering(true);
        return;
      }
      setIsBuffering(false);
      setFeedback('This stream could not play smoothly. Choose another stream.');
    };
    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      const saved = readState(user.id, 'progress', {})[meta.type + ':' + meta.id];
      const position = meta.resumePosition || (saved?.playbackId === meta.playbackId ? saved.position : 0);
      if (position > 0 && position < video.duration - (meta.resumePosition ? 0.25 : 15)) video.currentTime = position;
      readAudioTracks();
      video.play().catch(error => {
        if (!active) return;
        if (error.name === 'NotAllowedError') {
          clearTimeout(startupTimer);
          clearTimeout(stallTimer);
          setIsBuffering(false);
          setNeedsGesture(true);
          setFeedback('Tap Play to begin.');
        } else if (error.name !== 'AbortError') handleError();
      });
    };
    const handlePlaying = () => {
      clearTimeout(startupTimer);
      clearTimeout(stallTimer);
      setIsPlaying(true);
      setIsBuffering(false);
      setNeedsGesture(false);
      setFeedback('');
    };
    const handlePause = () => {
      clearTimeout(startupTimer);
      clearTimeout(stallTimer);
      setIsPlaying(false);
      wakeControls();
    };
    const handleWaiting = () => {
      if (video.paused || video.seeking) return;
      setIsBuffering(true);
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (active && !video.paused && !video.seeking && !document.hidden) handleError();
      }, 15000);
    };
    const handleSeeking = () => clearTimeout(stallTimer);
    const handleTimeUpdate = () => {
      if (video.currentTime > lastPosition + 0.1) clearTimeout(stallTimer);
      lastPosition = video.currentTime;
      setCurrentTime(video.currentTime);
      if (video.buffered.length) {
        try { setBuffered(video.buffered.end(video.buffered.length - 1)); } catch {}
      }
      if (Date.now() - lastSaved > 4000) { saveProgress(); lastSaved = Date.now(); }
    };
    startupTimer = setTimeout(() => {
      if (!document.hidden) handleError();
    }, 20000);
    const events = {
      loadedmetadata: handleLoadedMetadata,
      playing: handlePlaying,
      pause: handlePause,
      waiting: handleWaiting,
      stalled: handleWaiting,
      seeking: handleSeeking,
      timeupdate: handleTimeUpdate,
      error: handleError
    };
    for (const [name, handler] of Object.entries(events)) video.addEventListener(name, handler);
    window.addEventListener('pagehide', saveProgress);

    (async () => {
      const url = safeURL(stream.url);
      if (!url) return handleError();
      let mimeType = stream.mimeType || '';
      if (!mimeType && url.startsWith('/api/playback/')) {
        try {
          const head = await fetch(url, { method: 'HEAD', credentials: 'same-origin', signal: controller.signal });
          if (head.ok) mimeType = head.headers.get('content-type') || '';
        } catch { if (!active) return; }
      }
      if (!active) return;
      const isHls = /mpegurl/.test(mimeType) || /\.m3u8(?:\?|$)/i.test(url);
      if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = (await import('hls.js')).default;
        if (!active) return;
        if (!Hls.isSupported()) return handleError();
        hls = new Hls({ enableWorker: true, capLevelToPlayerSize: Boolean(stream.autoSelection) });
        hlsRef.current = hls;
        if (stream.autoSelection?.saveData) {
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const allowed = hls.levels.map((level, index) => ({ level, index })).filter(({ level }) => !level.height || level.height <= 720);
            hls.autoLevelCapping = allowed.length ? allowed[allowed.length - 1].index : 0;
          });
        }
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!active) return;
          readAudioTracks();
          setLevels(hls.levels.map((level, index) => ({ index, height: level.height, bitrate: level.bitrate })));
          setActiveLevel(hls.autoLevelEnabled ? -1 : hls.currentLevel);
        });
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
          if (!active) return;
          setBuiltinSubs(
            hls.subtitleTracks.map((track, index) => ({
              kind: 'builtin',
              index,
              lang: String(track.lang || 'und').toLowerCase(),
              language: track.name || languageName(track.lang),
              addon: 'Stream'
            }))
          );
        });
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, readAudioTracks);
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, readAudioTracks);
        hls.attachMedia(video);
        hls.loadSource(url);
        hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) handleError(); });
      } else video.src = url;
    })().catch(handleError);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(startupTimer);
      clearTimeout(stallTimer);
      saveProgress();
      for (const [name, handler] of Object.entries(events)) video.removeEventListener(name, handler);
      video.pause();
      hls?.destroy();
      hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
      window.removeEventListener('pagehide', saveProgress);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [stream]);

  // Subtitle addons: queried once per stream, in parallel with playback.
  useEffect(() => {
    const controller = new AbortController();
    setAddonSubs([]);
    setSubsNotice('');
    setActiveSubId('off');
    const providers = addons.filter(addon =>
      addon.resources?.some(resource =>
        typeof resource === 'string' ? resource === 'subtitles' : resource.name === 'subtitles'
      )
    );
    if (!providers.length) {
      setSubsNotice('No subtitle addon is configured.');
      return () => controller.abort();
    }
    setSubsLoading(true);
    fetchSubtitles(addons, { type: meta.type, videoId: videoId || meta.id, stream, signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        setAddonSubs(result.tracks);
        if (!result.tracks.length) {
          setSubsNotice(result.failed ? 'Subtitle addons did not respond.' : 'No subtitles found for this file.');
        }
      })
      .catch(() => { if (!controller.signal.aborted) setSubsNotice('Subtitle search failed.'); })
      .finally(() => { if (!controller.signal.aborted) setSubsLoading(false); });
    return () => controller.abort();
  }, [stream, addons, meta.type, meta.id, videoId]);

  // Track modes are imperative: the default attribute never updates after mount.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      track.mode = activeSubId !== 'off' && track.id === activeSubId ? 'showing' : 'disabled';
    }
  }, [activeSubId, addonSubs]);

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (activeSubId.startsWith('builtin:')) {
      hls.subtitleDisplay = true;
      hls.subtitleTrack = Number(activeSubId.split(':')[1]);
    } else if (hls.subtitleTrack !== -1) {
      hls.subtitleDisplay = false;
      hls.subtitleTrack = -1;
    }
  }, [activeSubId]);

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || activeAudio < 0 || !hls.audioTracks?.length) return;
    if (hls.audioTrack !== activeAudio) hls.audioTrack = activeAudio;
  }, [activeAudio]);

  useEffect(() => {
    const video = videoRef.current;
    const native = video?.audioTracks;
    if (!native || !native.length || activeAudio < 0) return;
    for (let index = 0; index < native.length; index += 1) native[index].enabled = index === activeAudio;
  }, [activeAudio]);

  useEffect(() => {
    try { localStorage.setItem('librestream:cue_size', cueSize); } catch {}
  }, [cueSize]);

  const toggleSubtitleShortcut = () => {
    if (activeSubId !== 'off') return setActiveSubId('off');
    const english = subtitleTracks.find(track => track.lang.startsWith('en'));
    const first = english || subtitleTracks[0];
    if (first) setActiveSubId(first.kind === 'addon' ? first.id : `builtin:${first.index}`);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const video = videoRef.current;
      if (!video) return;
      wakeControls();
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video.paused) video.play().catch(() => {});
          else video.pause();
          break;
        case 'arrowleft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'arrowright':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume((v) => {
            const next = Math.min(1, v + 0.1);
            video.volume = next;
            return next;
          });
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume((v) => {
            const next = Math.max(0, v - 0.1);
            video.volume = next;
            return next;
          });
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          break;
        case 'c':
          e.preventDefault();
          toggleSubtitleShortcut();
          break;
        case 'escape':
          if (activePanel) {
            e.preventDefault();
            setActivePanel(null);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, activeSubId, subtitleTracks]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const seek = (time) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, time));
    wakeControls();
  };

  const skip = (delta) => {
    const video = videoRef.current;
    if (!video) return;
    seek(video.currentTime + delta);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled) await video.requestPictureInPicture();
    } catch {}
  };

  const changeSpeed = (speed) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const chooseLevel = (index) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index;
    setActiveLevel(index);
  };

  let lastTap = 0;
  const handleTouchEnd = (e) => {
    const now = Date.now();
    const touch = e.changedTouches[0];
    if (now - lastTap < 300 && touch) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const isLeft = touch.clientX < rect.left + rect.width / 2;
        skip(isLeft ? -10 : 10);
        setDoubleTapFeedback(isLeft ? 'left' : 'right');
        setTimeout(() => setDoubleTapFeedback(null), 600);
      }
    }
    lastTap = now;
    wakeControls();
  };

  const sourceName = stream.name || stream.title || 'Direct Stream';
  const activeSub = subtitleTracks.find(track =>
    activeSubId === (track.kind === 'addon' ? track.id : `builtin:${track.index}`)
  );
  const audioCount = audioTracks.length;
  const addonTracks = subtitleTracks.filter(track => track.kind === 'addon');

  const openPanel = (panel) => {
    setActivePanel(activePanel === panel ? null : panel);
    setControlsVisible(true);
  };

  const panelButton = (panel, label, icon) => (
    <button
      type="button"
      className={`track-tab ${activePanel === panel ? 'active' : ''}`}
      aria-pressed={activePanel === panel}
      onClick={() => openPanel(panel)}
    >
      <Icon icon={icon} />
      <span>{label}</span>
    </button>
  );

  return (
    <div
      ref={containerRef}
      className={`ls-player-viewport ${controlsVisible ? 'controls-active' : 'controls-hidden'} player-${playerStyle}`}
      onMouseMove={wakeControls}
      onTouchStart={wakeControls}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        id="video"
        className="ls-video-canvas"
        playsInline
        preload="auto"
        onClick={togglePlay}
        style={{ '--ls-cue-size': CUE_SIZES[cueSize] }}
      >
        {addonTracks
          .filter(track => safeURL(track.url))
          .map(track => (
            <track
              key={track.id}
              id={track.id}
              kind="subtitles"
              src={track.url}
              srcLang={track.lang || 'und'}
              label={track.language}
            />
          ))}
      </video>

      {isBuffering && (
        <div className="player-buffering-indicator" aria-label="Buffering stream">
          <div className="ls-spinner" />
          <Text color="secondary">Buffering…</Text>
        </div>
      )}

      {doubleTapFeedback && (
        <div className={`double-tap-ripple ${doubleTapFeedback}`}>
          <Text type="heading-3">{doubleTapFeedback === 'left' ? '⟪ 10s' : '10s ⟫'}</Text>
        </div>
      )}

      {feedback && (
        <div className="player-feedback-overlay" role={needsGesture ? 'status' : 'alert'}>
          <Text type="body">{feedback}</Text>
          <HStack gap={2} vAlign="center" className="player-feedback-actions">
            {needsGesture && <Button variant="primary" label="Play" icon={<Icon icon={Play} />} onClick={togglePlay} />}
            <Button variant="primary" label="Choose stream" icon={<Icon icon={Layers} />} onClick={() => onSwitchSource?.()} />
            <Button variant="ghost" label="Go back" icon={<Icon icon={ArrowLeft} />} onClick={onBack} />
          </HStack>
        </div>
      )}

      <header className="player-top-overlay">
        <div className="player-top-content">
          <button type="button" className="player-icon-btn" aria-label="Back" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <div className="player-title-block">
            <Heading level={3} className="player-media-title">
              {meta.name || meta.title || 'Playing media'}
            </Heading>
            <Text type="supporting" className="player-media-sub">
              {meta.playbackTitle || meta.releaseInfo || ''}
              <span className="player-badge">{sourceName}</span>
            </Text>
          </div>
          <div className="player-top-spacer" />
          <button type="button" className="player-icon-btn" title="Choose stream" aria-label="Choose stream" onClick={() => onSwitchSource?.()}>
            <Layers size={18} />
          </button>
          <button type="button" className="player-icon-btn" title="Fullscreen (F)" aria-label="Fullscreen" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {activePanel && (
        <section className="player-tracks-sheet" aria-label="Playback settings">
          <div className="sheet-head">
            <Heading level={4}>Playback</Heading>
            <button type="button" className="player-icon-btn" aria-label="Close settings" onClick={() => setActivePanel(null)}>
              <X size={16} />
            </button>
          </div>

          <div className="sheet-tabs" role="tablist">
            {panelButton('tracks', 'Audio & subtitles', Languages)}
            {panelButton('quality', 'Quality', Signal)}
            {panelButton('speed', 'Speed', Gauge)}
          </div>

          <div className="sheet-body">
            {activePanel === 'tracks' && (
              <>
                <div className="sheet-group">
                  <span className="sheet-group-title">Audio</span>
                  {audioTracks.length === 0 && (
                    <p className="sheet-note">
                      {subsLoading ? 'Reading tracks…' : 'This file exposes one audio track. Browsers cannot switch audio inside MP4 or MKV files.'}
                    </p>
                  )}
                  {audioTracks.map(track => (
                    <button
                      key={track.index}
                      type="button"
                      className={`sheet-row ${activeAudio === track.index ? 'active' : ''}`}
                      onClick={() => setActiveAudio(track.index)}
                    >
                      <span className="sheet-row-text">
                        <span className="sheet-row-title">{track.language}</span>
                        <span className="sheet-row-sub">{track.label}</span>
                      </span>
                      {activeAudio === track.index && <Check size={16} className="sheet-check" />}
                    </button>
                  ))}
                </div>

                <div className="sheet-group">
                  <span className="sheet-group-title">Subtitles</span>
                  <button
                    type="button"
                    className={`sheet-row ${activeSubId === 'off' ? 'active' : ''}`}
                    onClick={() => setActiveSubId('off')}
                  >
                    <span className="sheet-row-text">
                      <span className="sheet-row-title">Off</span>
                    </span>
                    {activeSubId === 'off' && <Check size={16} className="sheet-check" />}
                  </button>
                  {subtitleTracks.map(track => {
                    const key = track.kind === 'addon' ? track.id : `builtin:${track.index}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`sheet-row ${activeSubId === key ? 'active' : ''}`}
                        onClick={() => setActiveSubId(key)}
                      >
                        <span className="sheet-row-text">
                          <span className="sheet-row-title">{track.language}</span>
                          <span className="sheet-row-sub">{track.kind === 'addon' ? track.addon : 'Embedded in stream'}</span>
                        </span>
                        {activeSubId === key && <Check size={16} className="sheet-check" />}
                      </button>
                    );
                  })}
                  {subsLoading && <p className="sheet-note">Searching subtitle addons…</p>}
                  {!subsLoading && subsNotice && <p className="sheet-note">{subsNotice}</p>}

                  <div className="sheet-inline">
                    <span className="sheet-inline-label">Size</span>
                    <div className="sheet-segmented" role="group" aria-label="Subtitle size">
                      {Object.keys(CUE_SIZES).map(size => (
                        <button
                          key={size}
                          type="button"
                          className={`segmented-option ${cueSize === size ? 'active' : ''}`}
                          aria-pressed={cueSize === size}
                          onClick={() => setCueSize(size)}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activePanel === 'quality' && (
              <div className="sheet-group">
                <span className="sheet-group-title">Quality</span>
                {!levels.length && (
                  <p className="sheet-note">
                    This source is delivered as a single file, so quality is fixed by the stream you picked.
                  </p>
                )}
                {levels.length > 0 && (
                  <>
                    <button
                      type="button"
                      className={`sheet-row ${activeLevel === -1 ? 'active' : ''}`}
                      onClick={() => chooseLevel(-1)}
                    >
                      <span className="sheet-row-text">
                        <span className="sheet-row-title">Auto</span>
                        <span className="sheet-row-sub">Follows bandwidth</span>
                      </span>
                      {activeLevel === -1 && <Check size={16} className="sheet-check" />}
                    </button>
                    {[...levels].reverse().map(level => (
                      <button
                        key={level.index}
                        type="button"
                        className={`sheet-row ${activeLevel === level.index ? 'active' : ''}`}
                        onClick={() => chooseLevel(level.index)}
                      >
                        <span className="sheet-row-text">
                          <span className="sheet-row-title">
                            {level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`}
                          </span>
                          <span className="sheet-row-sub">{Math.round(level.bitrate / 1000)} kbps</span>
                        </span>
                        {activeLevel === level.index && <Check size={16} className="sheet-check" />}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {activePanel === 'speed' && (
              <div className="sheet-group">
                <span className="sheet-group-title">Speed</span>
                {SPEEDS.map(speed => (
                  <button
                    key={speed}
                    type="button"
                    className={`sheet-row ${playbackSpeed === speed ? 'active' : ''}`}
                    onClick={() => changeSpeed(speed)}
                  >
                    <span className="sheet-row-text">
                      <span className="sheet-row-title">{speed}×</span>
                      {speed === 1 && <span className="sheet-row-sub">Normal</span>}
                    </span>
                    {playbackSpeed === speed && <Check size={16} className="sheet-check" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {playerStyle === 'compact' ? (
        <div className="player-mpv-dock">
          <div className="player-mpv-pill">
            <div className="mpv-timeline-container">
              <div className="mpv-buffered-track" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
              <input
                type="range"
                className="mpv-progress-bar"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Seek timeline"
              />
            </div>

            <div className="mpv-controls-row">
              <button type="button" className="mpv-btn" title="Rewind 10s (←)" aria-label="Rewind 10 seconds" onClick={() => skip(-10)}>
                <RotateCcw size={18} />
              </button>
              <button
                type="button"
                className="mpv-btn primary-play"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                onClick={togglePlay}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button type="button" className="mpv-btn" title="Forward 10s (→)" aria-label="Forward 10 seconds" onClick={() => skip(10)}>
                <RotateCw size={18} />
              </button>

              <span className="mpv-timecode">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="mpv-spacer" />

              <div className="mpv-volume-group">
                <button
                  type="button"
                  className="mpv-btn"
                  title="Mute (M)"
                  aria-label="Mute"
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) {
                      video.muted = !video.muted;
                      setIsMuted(video.muted);
                    }
                  }}
                >
                  {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  className="mpv-volume-slider"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    if (videoRef.current) {
                      videoRef.current.volume = v;
                      videoRef.current.muted = false;
                      setIsMuted(false);
                    }
                  }}
                  aria-label="Volume"
                />
              </div>

              <button
                type="button"
                className={`mpv-btn ${audioCount > 1 ? 'has-badge' : ''}`}
                title="Audio tracks"
                aria-label="Audio tracks"
                onClick={() => openPanel('tracks')}
              >
                <Languages size={18} />
                {audioCount > 1 && <span className="mpv-count">{audioCount}</span>}
              </button>

              <button
                type="button"
                className={`mpv-btn ${activeSub ? 'highlight' : ''}`}
                title="Subtitles (C)"
                aria-label="Subtitles"
                onClick={() => openPanel('tracks')}
              >
                <Subtitles size={18} />
              </button>

              <button type="button" className="mpv-btn speed-btn" title="Playback speed" aria-label="Playback speed" onClick={() => openPanel('speed')}>
                <span>{playbackSpeed}×</span>
              </button>

              <button type="button" className="mpv-btn" title="Picture in picture" aria-label="Picture in picture" onClick={togglePiP}>
                <PictureInPicture size={18} />
              </button>

              <button type="button" className="mpv-btn" title="Fullscreen (F)" aria-label="Fullscreen" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="player-bottom-overlay">
          <div className="edge-timeline-container">
            <div className="mpv-buffered-track" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
            <input
              type="range"
              className="mpv-progress-bar"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Seek timeline"
            />
          </div>

          <HStack vAlign="center" className="edge-controls-row">
            <button type="button" className="player-icon-btn primary" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
              {isPlaying ? <Pause size={22} /> : <Play size={22} />}
            </button>
            <button type="button" className="player-icon-btn" aria-label="Rewind 10 seconds" onClick={() => skip(-10)}>
              <RotateCcw size={19} />
            </button>
            <button type="button" className="player-icon-btn" aria-label="Forward 10 seconds" onClick={() => skip(10)}>
              <RotateCw size={19} />
            </button>

            <span className="mpv-timecode">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="mpv-spacer" />

            <div className="mpv-volume-group">
              <button
                type="button"
                className="player-icon-btn"
                aria-label="Mute"
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    video.muted = !video.muted;
                    setIsMuted(video.muted);
                  }
                }}
              >
                {isMuted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </button>
              <input
                type="range"
                className="mpv-volume-slider"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = false;
                    setIsMuted(false);
                  }
                }}
                aria-label="Volume"
              />
            </div>

            <button type="button" className="player-icon-btn" title="Audio tracks" aria-label="Audio tracks" onClick={() => openPanel('tracks')}>
              <Languages size={19} />
            </button>
            <button type="button" className="player-icon-btn" title="Subtitles" aria-label="Subtitles" onClick={() => openPanel('tracks')}>
              <Subtitles size={19} />
            </button>
            <button type="button" className="player-icon-btn" title="Fullscreen" aria-label="Fullscreen" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
            </button>
          </HStack>
        </div>
      )}
    </div>
  );
}
