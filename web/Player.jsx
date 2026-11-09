import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Check,
  Layers,
  PictureInPicture,
  RectangleHorizontal,
  X
} from 'lucide-react';
import { Button, IconButton } from './ui.jsx';
import { safeURL, readState, writeState } from './api';
import { fetchSubtitles, mergeSubtitleTracks, languageName } from './subtitles.js';
import { SubtitleLayer } from './SubtitleLayer.jsx';
import { pictureRect, FIT_CSS } from './picture.js';
import { resumePosition } from './progress.js';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const FITS = {
  fit: { label: 'Fit', hint: 'Whole picture, bars where needed', css: FIT_CSS.fit },
  fill: { label: 'Fill', hint: 'Crops the edges to fill the screen', css: FIT_CSS.fill },
  stretch: { label: 'Stretch', hint: 'Distorts to fill the screen', css: FIT_CSS.stretch }
};
const ZOOMS = [1, 1.1, 1.25, 1.5];
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SUB_SCALES = { small: 0.82, medium: 1, large: 1.22 };
const SUB_OFFSETS = { low: 0.03, standard: 0.09, high: 0.2 };

function readPref(key, fallback, allowed) {
  try {
    const value = localStorage.getItem('librestream:' + key);
    return value && (!allowed || allowed.includes(value)) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key, value) {
  try { localStorage.setItem('librestream:' + key, value); } catch {}
}

export function Player({
  meta,
  stream,
  user,
  addons = [],
  videoId,
  onProgress,
  onBack,
  onFailure,
  onSwitchSource
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const chromeRef = useRef(null);
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
  const [activePanel, setActivePanel] = useState(null); // 'tracks' | 'picture' | 'speed'
  const [addonSubs, setAddonSubs] = useState([]);
  const [builtinSubs, setBuiltinSubs] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsNotice, setSubsNotice] = useState('');
  const [activeSubId, setActiveSubId] = useState('off');
  const [activeTrack, setActiveTrack] = useState(null);
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudio, setActiveAudio] = useState(-1);
  const [levels, setLevels] = useState([]);
  const [activeLevel, setActiveLevel] = useState(-1);
  const [subScale, setSubScale] = useState(() => readPref('sub_scale', 'medium', Object.keys(SUB_SCALES)));
  const [subOffset, setSubOffset] = useState(() => readPref('sub_offset', 'standard', Object.keys(SUB_OFFSETS)));
  const [fit, setFit] = useState(() => readPref('fit', 'fit', Object.keys(FITS)));
  const [zoom, setZoom] = useState(() => Number(readPref('zoom', '1')) || 1);
  const [picture, setPicture] = useState(null);
  const [chromeHeight, setChromeHeight] = useState(0);
  const [scrub, setScrub] = useState(null);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState(null);

  const subtitleTracks = useMemo(() => mergeSubtitleTracks(builtinSubs, addonSubs), [builtinSubs, addonSubs]);

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
        setAudioTracks(hls.audioTracks.map((track, index) => ({
          index,
          label: track.name || track.lang || `Track ${index + 1}`,
          language: languageName(track.lang || track.name)
        })));
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
            language: languageName(track.language)
          });
        }
        setAudioTracks(list);
        for (let index = 0; index < native.length; index += 1) {
          if (native[index].enabled) setActiveAudio(index);
        }
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
      const position = resumePosition(meta, saved);
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
        // Cues are painted by the app, so hls.js must not paint them too.
        hls = new Hls({ enableWorker: true, capLevelToPlayerSize: Boolean(stream.autoSelection), subtitleDisplay: false });
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
          setBuiltinSubs(hls.subtitleTracks.map((track, index) => ({
            kind: 'builtin',
            index,
            lang: String(track.lang || 'und').toLowerCase(),
            language: track.name || languageName(track.lang),
            addon: 'Stream'
          })));
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

  // Tracks are kept hidden: the app paints the cues itself.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    let chosen = null;
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      const selected = activeSubId !== 'off' && track.id === activeSubId;
      track.mode = selected ? 'hidden' : 'disabled';
      if (selected) chosen = track;
    }
    setActiveTrack(chosen);
  }, [activeSubId, addonSubs, builtinSubs]);

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (activeSubId.startsWith('builtin:')) {
      const index = Number(activeSubId.split(':')[1]);
      if (hls.subtitleTrack !== index) hls.subtitleTrack = index;
    } else if (hls.subtitleTrack !== -1) {
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

  useEffect(() => { writePref('sub_scale', subScale); }, [subScale]);
  useEffect(() => { writePref('sub_offset', subOffset); }, [subOffset]);
  useEffect(() => { writePref('fit', fit); }, [fit]);
  useEffect(() => { writePref('zoom', String(zoom)); }, [zoom]);

  // Track the picture rect and the chrome height so cues land inside the picture.
  useEffect(() => {
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!stage) return;
    const update = () => {
      const box = stage.getBoundingClientRect();
      setPicture(pictureRect(box.width, box.height, video?.videoWidth, video?.videoHeight, fit, zoom));
      setChromeHeight(chromeRef.current?.getBoundingClientRect().height || 0);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    if (chromeRef.current) observer.observe(chromeRef.current);
    video?.addEventListener('loadedmetadata', update);
    video?.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      observer.disconnect();
      video?.removeEventListener('loadedmetadata', update);
      video?.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [fit, zoom, controlsVisible]);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

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
        case 'a':
          e.preventDefault();
          setFit((current) => {
            const keys = Object.keys(FITS);
            return keys[(keys.indexOf(current) + 1) % keys.length];
          });
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
    const video = videoRef.current;
    if (!container || !video) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (container.requestFullscreen) {
        await container.requestFullscreen();
        return;
      }
      // iOS Safari exposes fullscreen on the media element only.
      if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } catch {
      if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    }
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
  const addonTracks = subtitleTracks.filter(track => track.kind === 'addon');
  const played = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? Math.min(100, (buffered / duration) * 100) : 0;

  // Cues sit above the control bar when it is showing, and stay inside the picture.
  const cueInset = picture
    ? controlsVisible && chromeHeight
      ? Math.max(chromeHeight + 18, picture.height * SUB_OFFSETS[subOffset])
      : Math.max(18, picture.height * SUB_OFFSETS[subOffset])
    : 0;

  const openPanel = (panel) => {
    setActivePanel(activePanel === panel ? null : panel);
    setControlsVisible(true);
  };

  const timelinePointer = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    return { ratio, time: ratio * duration };
  };

  const audioLabel = activeAudio >= 0 && audioTracks[activeAudio] ? audioTracks[activeAudio].language : 'Audio';
  const subLabel = activeSub ? activeSub.language : 'Subs off';

  return (
    <div
      ref={containerRef}
      className={`ls-player ${controlsVisible ? 'is-awake' : 'is-idle'}`}
      data-fit={fit}
      onMouseMove={wakeControls}
      onTouchStart={wakeControls}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={toggleFullscreen}
    >
      <div className="ls-stage" ref={stageRef}>
        <video
          ref={videoRef}
          id="video"
          className="ls-video"
          playsInline
          preload="auto"
          onClick={togglePlay}
          style={{ objectFit: FITS[fit].css, transform: `scale(${zoom})` }}
        >
          {addonTracks
            .filter((track) => safeURL(track.url))
            .map((track) => (
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
        <SubtitleLayer track={activeTrack} rect={picture} bottomInset={cueInset} scale={SUB_SCALES[subScale]} />
      </div>

      {isBuffering && (
        <div className="ls-buffering" aria-label="Buffering">
          <span className="ls-spinner" />
        </div>
      )}

      {doubleTapFeedback && (
        <div className={`ls-tap-feedback is-${doubleTapFeedback}`} aria-hidden="true">
          {doubleTapFeedback === 'left' ? '−10s' : '+10s'}
        </div>
      )}

      {feedback && (
        <div className="ls-player-notice" role={needsGesture ? 'status' : 'alert'}>
          <p>{feedback}</p>
          <div style={{ display: 'flex', gap: 'var(--ls-2)', flexWrap: 'wrap' }}>
            {needsGesture && <Button variant="primary" size="sm" label="Play" onClick={togglePlay} />}
            <Button variant="secondary" size="sm" label="Choose stream" onClick={() => onSwitchSource?.()} />
            <Button variant="ghost" size="sm" label="Go back" onClick={onBack} />
          </div>
        </div>
      )}

      <header className="ls-player-top">
        <IconButton icon={<ArrowLeft size={18} />} label="Back" onClick={onBack} />
        <div className="ls-player-title">
          <b>{meta.name || meta.title || 'Playing'}</b>
          <span>
            {[meta.playbackTitle || meta.releaseInfo, sourceName].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="ls-player-pills">
          <button type="button" className="ls-pill" onClick={() => openPanel('tracks')}>
            {audioLabel}
            <span className="sep">·</span>
            {subLabel}
          </button>
          <button type="button" className="ls-pill" onClick={() => onSwitchSource?.()}>
            <Layers size={14} />
            {sourceName.length > 24 ? sourceName.slice(0, 24) + '…' : sourceName}
          </button>
        </div>
      </header>

      {activePanel === 'tracks' && (
        <div className="ls-popover" style={{ right: 'var(--ls-4)', top: '4.75rem', maxHeight: '60dvh', overflowY: 'auto' }}>
          <span className="ls-popover-label">Audio</span>
          <div className="ls-popover-rows">
            {audioTracks.length === 0 && (
              <p className="ls-popover-label" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                Single track
              </p>
            )}
            {audioTracks.map((track) => (
              <button
                key={track.index}
                type="button"
                className={`ls-popover-row ${activeAudio === track.index ? 'is-active' : ''}`}
                onClick={() => setActiveAudio(track.index)}
              >
                <span>{track.language}</span>
                {activeAudio === track.index && <Check size={14} />}
              </button>
            ))}
          </div>

          <span className="ls-popover-label">Subtitles</span>
          <div className="ls-popover-rows">
            <button
              type="button"
              className={`ls-popover-row ${activeSubId === 'off' ? 'is-active' : ''}`}
              onClick={() => setActiveSubId('off')}
            >
              <span>Off</span>
              {activeSubId === 'off' && <Check size={14} />}
            </button>
            {subtitleTracks.map((track) => {
              const key = track.kind === 'addon' ? track.id : `builtin:${track.index}`;
              return (
                <button
                  key={key}
                  type="button"
                  className={`ls-popover-row ${activeSubId === key ? 'is-active' : ''}`}
                  onClick={() => setActiveSubId(key)}
                >
                  <span>{track.language}</span>
                  {activeSubId === key && <Check size={14} />}
                </button>
              );
            })}
          </div>
          {subsLoading && <span className="ls-popover-label">Searching subtitles…</span>}
          {!subsLoading && subsNotice && (
            <span className="ls-popover-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
              {subsNotice}
            </span>
          )}

          <span className="ls-popover-label">Subtitle size</span>
          <div className="ls-popover-seg">
            {Object.keys(SUB_SCALES).map((size) => (
              <button
                key={size}
                type="button"
                className={subScale === size ? 'is-active' : ''}
                onClick={() => setSubScale(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'picture' && (
        <div className="ls-popover is-picture">
          <span className="ls-popover-label">Aspect</span>
          <div className="ls-popover-rows">
            {Object.entries(FITS).map(([key, value]) => (
              <button
                key={key}
                type="button"
                className={`ls-popover-row ${fit === key ? 'is-active' : ''}`}
                onClick={() => setFit(key)}
              >
                <span>{value.label}</span>
                {fit === key && <Check size={14} />}
              </button>
            ))}
          </div>
          <span className="ls-popover-label">Zoom</span>
          <div className="ls-popover-seg">
            {ZOOMS.map((value) => (
              <button
                key={value}
                type="button"
                className={zoom === value ? 'is-active' : ''}
                onClick={() => setZoom(value)}
              >
                {Math.round(value * 100)}%
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'speed' && (
        <div className="ls-popover is-picture">
          <span className="ls-popover-label">Speed</span>
          <div className="ls-popover-rows">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={`ls-popover-row ${playbackSpeed === speed ? 'is-active' : ''}`}
                onClick={() => changeSpeed(speed)}
              >
                <span>{speed}×</span>
                {playbackSpeed === speed && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ls-player-deck" ref={chromeRef}>
        <div
          className="ls-timeline"
          onPointerMove={(event) => {
            if (duration) setScrub(timelinePointer(event));
          }}
          onPointerLeave={() => setScrub(null)}
        >
          <div className="ls-timeline-track">
            <div className="ls-timeline-buffer" style={{ width: `${bufferedPct}%` }} />
            <div className="ls-timeline-played" style={{ width: `${played}%` }} />
            <div className="ls-timeline-knob" style={{ left: `${played}%` }} />
          </div>
          {scrub && (
            <span className="ls-scrub-bubble" style={{ left: `${scrub.ratio * 100}%` }}>
              {formatTime(scrub.time)}
            </span>
          )}
          <input
            type="range"
            className="ls-timeline-input"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Seek"
          />
        </div>

        <div className="ls-transport">
          <button
            type="button"
            className="ls-play-btn"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={togglePlay}
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" strokeWidth={0} />}
          </button>
          <button type="button" className="ls-chrome-btn" aria-label="Rewind 10 seconds" onClick={() => skip(-10)}>
            <RotateCcw size={16} />
          </button>
          <button type="button" className="ls-chrome-btn" aria-label="Forward 10 seconds" onClick={() => skip(10)}>
            <RotateCw size={16} />
          </button>

          <span className="ls-timecode">
            {formatTime(currentTime)}
            <em>/ {formatTime(duration)}</em>
          </span>

          <div className="ls-transport-spacer" />

          <div className="ls-volume">
            <button
              type="button"
              className="ls-chrome-btn"
              aria-label="Mute"
              onClick={() => {
                const video = videoRef.current;
                if (video) {
                  video.muted = !video.muted;
                  setIsMuted(video.muted);
                }
              }}
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              className="ls-volume-input"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                if (videoRef.current) {
                  videoRef.current.volume = next;
                  videoRef.current.muted = false;
                  setIsMuted(false);
                }
              }}
              aria-label="Volume"
            />
          </div>

          <button
            type="button"
            className={`ls-chrome-btn ${activeSub ? 'is-on' : ''}`}
            aria-label="Audio and subtitles"
            title="Audio and subtitles (C)"
            onClick={() => openPanel('tracks')}
          >
            <Subtitles size={16} />
          </button>
          <button
            type="button"
            className={`ls-chrome-btn ${activePanel === 'picture' ? 'is-on' : ''}`}
            aria-label={`Aspect ratio: ${FITS[fit].label}`}
            title={`Aspect: ${FITS[fit].label} (A)`}
            onClick={() => openPanel('picture')}
          >
            <RectangleHorizontal size={16} />
          </button>
          <button
            type="button"
            className="ls-chrome-btn"
            aria-label="Playback speed"
            title="Playback speed"
            onClick={() => openPanel('speed')}
          >
            {playbackSpeed}×
          </button>
          <button type="button" className="ls-chrome-btn" aria-label="Picture in picture" onClick={togglePiP}>
            <PictureInPicture size={16} />
          </button>
          <button type="button" className="ls-chrome-btn" aria-label="Fullscreen" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
