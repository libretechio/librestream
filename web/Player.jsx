import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack } from '@astryxdesign/core/HStack';
import { VStack } from '@astryxdesign/core/VStack';
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
  Settings,
  Layers,
  PictureInPicture,
  RotateCw as RefreshIcon,
  X
} from 'lucide-react';
import { safeURL, readState, writeState } from './api';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Player({
  meta,
  stream,
  user,
  playerStyle = 'compact',
  onProgress,
  onBack,
  onSwitchSource
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [feedback, setFeedback] = useState('Loading stream…');
  const [isBuffering, setIsBuffering] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [activePanel, setActivePanel] = useState(null); // 'subtitles' | 'audio' | 'speed' | 'settings'
  const [subtitles, setSubtitles] = useState(stream.subtitles || []);
  const [activeSubtitle, setActiveSubtitle] = useState(-1);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState(null); // 'left' | 'right'

  // Wake and auto-hide controls
  const wakeControls = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !activePanel) {
        setControlsVisible(false);
      }
    }, 3200);
  };

  const saveProgress = () => {
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration) && Number.isFinite(video.currentTime)) {
      onProgress?.({
        ...meta,
        position: video.currentTime,
        duration: video.duration
      });
    }
  };

  // Video and HLS engine
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls = null;
    let active = true;
    let lastSaved = 0;

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setIsBuffering(false);
      const saved = readState(user.id, 'progress', {})[meta.type + ':' + meta.id];
      if (saved?.playbackId === meta.playbackId && saved.position < video.duration - 15) {
        video.currentTime = saved.position;
      }
      video.play().catch(() => setFeedback('Click play to begin streaming.'));
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
      setFeedback('');
    };

    const handlePause = () => {
      setIsPlaying(false);
      wakeControls();
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        try {
          const end = video.buffered.end(video.buffered.length - 1);
          setBuffered(end);
        } catch {}
      }
      if (Date.now() - lastSaved > 4000) {
        saveProgress();
        lastSaved = Date.now();
      }
    };

    const handleError = () => {
      setIsBuffering(false);
      setFeedback('This stream failed to play in your browser. Switch to another source or quality.');
      setControlsVisible(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);
    window.addEventListener('pagehide', saveProgress);

    (async () => {
      const url = safeURL(stream.url);
      if (!url) {
        handleError();
        return;
      }

      if (/\.m3u8(?:\?|$)/i.test(url) && !video.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = (await import('hls.js')).default;
        if (!active) return;
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.attachMedia(video);
          hls.loadSource(url);
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) handleError();
          });
        } else {
          handleError();
        }
      } else {
        video.src = url;
      }
    })().catch(handleError);

    return () => {
      active = false;
      saveProgress();
      video.pause();
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
      window.removeEventListener('pagehide', saveProgress);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [stream]);

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
          if (video.paused) video.play();
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
          setActiveSubtitle((cur) => (cur === -1 ? 0 : -1));
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
  }, [activePanel]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
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
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch {}
  };

  const changeSpeed = (speed) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setActivePanel(null);
  };

  // Double tap to skip on mobile
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
      >
        {subtitles
          .filter((s) => safeURL(s.url))
          .map((s, i) => (
            <track
              key={i}
              kind="subtitles"
              src={s.url}
              srcLang={s.lang || 'en'}
              label={s.lang || `Track ${i + 1}`}
              default={i === activeSubtitle}
            />
          ))}
      </video>

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="player-buffering-indicator" aria-label="Buffering stream">
          <div className="ls-spinner" />
          <Text color="secondary">Buffering…</Text>
        </div>
      )}

      {/* Double-tap visual feedback */}
      {doubleTapFeedback && (
        <div className={`double-tap-ripple ${doubleTapFeedback}`}>
          <Text type="heading-3">{doubleTapFeedback === 'left' ? '⟪ 10s' : '10s ⟫'}</Text>
        </div>
      )}

      {/* Error / Status Toast */}
      {feedback && (
        <div className="player-feedback-overlay" role="alert">
          <Text type="body">{feedback}</Text>
          <HStack gap={2} vAlign="center" className="player-feedback-actions">
            <Button
              variant="primary"
              label="Switch stream source"
              icon={<Icon icon={Layers} />}
              onClick={() => onSwitchSource?.()}
            />
            <Button variant="ghost" label="Go back" icon={<Icon icon={ArrowLeft} />} onClick={onBack} />
          </HStack>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="player-top-overlay">
        <HStack gap={3} vAlign="center" className="player-top-content">
          <button
            type="button"
            className="player-icon-btn"
            aria-label="Back"
            onClick={onBack}
          >
            <ArrowLeft size={22} />
          </button>
          <VStack gap={0} className="player-title-block">
            <Heading level={3} className="player-media-title">
              {meta.name || meta.title || 'Playing media'}
            </Heading>
            <Text type="supporting" className="player-media-sub">
              {meta.playbackTitle || (meta.releaseInfo ? `${meta.releaseInfo} · ` : '')}
              <span className="player-badge">{sourceName}</span>
            </Text>
          </VStack>
          <div className="player-top-spacer" />
          <button
            type="button"
            className="player-icon-btn"
            title="Switch Source"
            aria-label="Switch Source"
            onClick={() => onSwitchSource?.()}
          >
            <Layers size={20} />
          </button>
          <button
            type="button"
            className="player-icon-btn"
            title="Fullscreen (F)"
            aria-label="Fullscreen"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </HStack>
      </div>

      {/* Right Drawer / Settings Panel (for Panel & Edge mode) */}
      {activePanel && (
        <div className="player-panel-drawer">
          <HStack vAlign="center" className="panel-header">
            <Heading level={4}>
              {activePanel === 'subtitles' && 'Subtitles'}
              {activePanel === 'speed' && 'Playback Speed'}
              {activePanel === 'settings' && 'Audio & Options'}
            </Heading>
            <button
              type="button"
              className="player-icon-btn"
              aria-label="Close panel"
              onClick={() => setActivePanel(null)}
            >
              <X size={18} />
            </button>
          </HStack>

          {activePanel === 'subtitles' && (
            <VStack gap={2} className="panel-list">
              <button
                type="button"
                className={`panel-item ${activeSubtitle === -1 ? 'active' : ''}`}
                onClick={() => {
                  setActiveSubtitle(-1);
                  setActivePanel(null);
                }}
              >
                Off
              </button>
              {subtitles.map((s, idx) => (
                <button
                  type="button"
                  key={idx}
                  className={`panel-item ${activeSubtitle === idx ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSubtitle(idx);
                    setActivePanel(null);
                  }}
                >
                  {s.lang || `Track ${idx + 1}`}
                </button>
              ))}
            </VStack>
          )}

          {activePanel === 'speed' && (
            <VStack gap={2} className="panel-list">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                <button
                  type="button"
                  key={spd}
                  className={`panel-item ${playbackSpeed === spd ? 'active' : ''}`}
                  onClick={() => changeSpeed(spd)}
                >
                  {spd}× {spd === 1.0 ? '· Normal' : ''}
                </button>
              ))}
            </VStack>
          )}

          {activePanel === 'settings' && (
            <VStack gap={3} className="panel-list">
              <button
                type="button"
                className="panel-item"
                onClick={() => setActivePanel('speed')}
              >
                Speed ({playbackSpeed}×)
              </button>
              <button
                type="button"
                className="panel-item"
                onClick={() => setActivePanel('subtitles')}
              >
                Subtitles ({activeSubtitle === -1 ? 'Off' : subtitles[activeSubtitle]?.lang || 'On'})
              </button>
              <button
                type="button"
                className="panel-item"
                onClick={() => onSwitchSource?.()}
              >
                Change source stream
              </button>
              <button type="button" className="panel-item" onClick={togglePiP}>
                Picture in Picture
              </button>
            </VStack>
          )}
        </div>
      )}

      {/* MPV Compact Bottom Toolbar (Style C) */}
      {playerStyle === 'compact' && (
        <div className="player-mpv-dock">
          <div className="player-mpv-pill">
            <div className="mpv-timeline-container">
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
              <div
                className="mpv-buffered-track"
                style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
              />
            </div>

            <HStack vAlign="center" className="mpv-controls-row">
              <button
                type="button"
                className="mpv-btn"
                title="Rewind 10s (←)"
                aria-label="Rewind 10 seconds"
                onClick={() => skip(-10)}
              >
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

              <button
                type="button"
                className="mpv-btn"
                title="Forward 10s (→)"
                aria-label="Forward 10 seconds"
                onClick={() => skip(10)}
              >
                <RotateCw size={18} />
              </button>

              <Text className="mpv-timecode">
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>

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
                className={`mpv-btn ${activeSubtitle !== -1 ? 'highlight' : ''}`}
                title="Subtitles (C)"
                aria-label="Subtitles"
                onClick={() => setActivePanel(activePanel === 'subtitles' ? null : 'subtitles')}
              >
                <Subtitles size={18} />
              </button>

              <button
                type="button"
                className="mpv-btn speed-btn"
                title="Playback Speed"
                aria-label="Playback Speed"
                onClick={() => setActivePanel(activePanel === 'speed' ? null : 'speed')}
              >
                <span>{playbackSpeed}×</span>
              </button>

              <button
                type="button"
                className="mpv-btn"
                title="Picture in Picture"
                aria-label="Picture in Picture"
                onClick={togglePiP}
              >
                <PictureInPicture size={18} />
              </button>

              <button
                type="button"
                className="mpv-btn"
                title="Fullscreen (F)"
                aria-label="Fullscreen"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </HStack>
          </div>
        </div>
      )}

      {/* Classic Edge Controls / Settings (Styles A & B) */}
      {playerStyle !== 'compact' && (
        <div className="player-bottom-overlay">
          <div className="edge-timeline-container">
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
            <div
              className="mpv-buffered-track"
              style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
            />
          </div>

          <HStack vAlign="center" className="edge-controls-row">
            <button
              type="button"
              className="player-icon-btn primary"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={togglePlay}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              type="button"
              className="player-icon-btn"
              aria-label="Rewind 10 seconds"
              onClick={() => skip(-10)}
            >
              <RotateCcw size={20} />
            </button>
            <button
              type="button"
              className="player-icon-btn"
              aria-label="Forward 10 seconds"
              onClick={() => skip(10)}
            >
              <RotateCw size={20} />
            </button>

            <Text className="mpv-timecode">
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>

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
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
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
              className="player-icon-btn"
              title="Settings"
              aria-label="Settings"
              onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}
            >
              <Settings size={20} />
            </button>

            <button
              type="button"
              className="player-icon-btn"
              title="Fullscreen"
              aria-label="Fullscreen"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </HStack>
        </div>
      )}
    </div>
  );
}
