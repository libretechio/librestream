import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Carousel } from '@astryxdesign/core/Carousel';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Icon } from '@astryxdesign/core/Icon';
import {
  Bookmark,
  BookmarkCheck,
  Clapperboard,
  RotateCw,
  ChevronRight,
  Check
} from 'lucide-react';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Sources } from './Sources.jsx';
import { Brand } from './Brand.jsx';
import { HeroBanner } from './HeroBanner.jsx';
import { Player } from './Player.jsx';
import { AppearanceSettings, AppearanceContent } from './AppearanceSettings.jsx';
import {
  NuvioHomeIcon,
  NuvioSearchIcon,
  NuvioLibraryIcon,
  NuvioPaletteIcon,
  NuvioSettingsIcon,
  NuvioPlayIcon,
  NuvioEpisodesIcon,
  ImdbBadge
} from './Icons.jsx';
import { DEFAULT_PREFERENCES, PALETTES, applyPaletteToDOM } from './palettes.js';
import {
  api,
  resource,
  supports,
  dedupe,
  safeURL,
  readState,
  writeState
} from './api';

function Message({ children }) {
  return (
    <Text as="p" role="status" color="secondary">
      {children}
    </Text>
  );
}

function PosterCard({ item, onOpen, shape = 'poster', inGrid = false }) {
  const [broken, setBroken] = useState(false);
  const rating = item.imdbRating || item.rating;
  const age =
    item.certification ||
    item.ageRating ||
    (item.type === 'series' ? 'Series' : 'Movie');
  const title = item.name || item.title || item.id;
  const year = item.year || item.releaseInfo;
  const isLandscape = shape === 'landscape' && !inGrid;
  const imgUrl = isLandscape
    ? safeURL(item.background || item.banner || item.poster)
    : safeURL(item.poster || item.background);
  const logoUrl = isLandscape ? safeURL(item.logo) : '';

  return (
    <button
      type="button"
      className={`poster-card ${isLandscape ? 'poster-card-landscape' : 'poster-card-portrait'} ${
        inGrid ? 'poster-card-grid' : 'poster-card-rail'
      }`}
      onClick={() => onOpen(item)}
      aria-label={title}
      data-media-id={item.id}
    >
      <div className="poster-media-box">
        {!broken && imgUrl ? (
          <img
            className="poster-image"
            src={imgUrl}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="poster-placeholder">
            <Icon icon={Clapperboard} size="lg" color="secondary" />
          </div>
        )}

        <div className="poster-scrim" aria-hidden="true" />

        {age && <span className="poster-badge-top-right">{age}</span>}
        {rating && (
          <span className="poster-badge-bottom">
            <span className="poster-star">★</span> {rating}
          </span>
        )}
        {isLandscape && logoUrl && (
          <img src={logoUrl} alt="" className="poster-landscape-logo" />
        )}
      </div>

      <div className="poster-info">
        <span className="poster-title">{title}</span>
        {year && <span className="poster-sub">{String(year)}</span>}
      </div>
    </button>
  );
}

function Shelf({
  title,
  subtitle,
  items,
  onOpen,
  onViewAll,
  shape = 'poster',
  grid = false
}) {
  if (!items || !items.length) return null;
  return (
    <section className="shelf">
      <div className="shelf-header">
        <div className="shelf-title-group">
          <Heading level={2} className="shelf-heading">
            {title}
          </Heading>
          {subtitle && <span className="shelf-subtitle">{subtitle}</span>}
        </div>
        {!grid && onViewAll && (
          <button
            type="button"
            className="nuvio-view-all-pill"
            onClick={onViewAll}
            aria-label={`See all in ${title}`}
          >
            <span>See all</span>
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {grid ? (
        <div className="poster-grid">
          {items.map((item) => (
            <PosterCard
              key={(item.type || 'media') + ':' + item.id}
              item={item}
              onOpen={onOpen}
              shape="poster"
              inGrid
            />
          ))}
        </div>
      ) : (
        <Carousel
          gap={3}
          hasSnap
          hasEdgeFade
          hasButtons
          aria-label={title}
          className="nuvio-shelf-carousel"
        >
          {items.map((item) => (
            <PosterCard
              key={(item.type || 'media') + ':' + item.id}
              item={item}
              onOpen={onOpen}
              shape={shape}
            />
          ))}
        </Carousel>
      )}
    </section>
  );
}

function ContinueWatchingShelf({ items, onOpen }) {
  if (!items || !items.length) return null;
  return (
    <section className="shelf continue-shelf">
      <div className="shelf-header">
        <div className="shelf-title-group">
          <Heading level={2} className="shelf-heading">
            Continue Watching
          </Heading>
          <span className="shelf-subtitle">Pick up right where you left off</span>
        </div>
      </div>
      <Carousel
        gap={3}
        hasSnap
        hasEdgeFade
        hasButtons
        aria-label="Continue watching"
        className="nuvio-shelf-carousel"
      >
        {items.map((item) => {
          const pct = Math.min(100, Math.max(1, (item.position / (item.duration || 1)) * 100));
          const backdrop = safeURL(item.background || item.poster);
          return (
            <button
              type="button"
              key={(item.type || 'media') + ':' + item.id}
              className="continue-card"
              onClick={() => onOpen(item)}
            >
              <div
                className="continue-media-box"
                style={{
                  backgroundImage: backdrop ? `url(${backdrop})` : 'none'
                }}
              >
                <span className="continue-play-badge" aria-hidden="true">
                  <NuvioPlayIcon size={16} />
                </span>
                <div className="continue-progress-track">
                  <div className="continue-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="continue-meta">
                <span className="poster-title">{item.name || item.id}</span>
                <span className="poster-sub">
                  {item.playbackTitle || (item.releaseInfo ? `${item.releaseInfo} · ` : '')}
                  {Math.round(pct)}% watched
                </span>
              </div>
            </button>
          );
        })}
      </Carousel>
    </section>
  );
}

function Catalog({ addon, catalog, shape, onOpen, onViewAll, onFeaturedItems }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '420px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setError(false);
    resource(addon, 'catalog', catalog.type, catalog.id)
      .then((d) => {
        if (!active) return;
        const metas = dedupe(
          (d.metas || []).map((m) => ({ ...m, type: m.type || catalog.type }))
        ).slice(0, 24);
        setData(metas);
        if (metas.length > 0 && onFeaturedItems) {
          onFeaturedItems(metas.slice(0, 6));
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [visible, attempt, addon, catalog]);

  const typeText =
    catalog.type === 'movie' ? 'Movies' : catalog.type === 'series' ? 'Series' : catalog.type;
  const label = `${catalog.name || catalog.id} · ${typeText}`;

  return (
    <div ref={ref} className="catalog-slot">
      {data ? (
        <Shelf
          title={label}
          subtitle={addon.name}
          items={data}
          shape={shape}
          onOpen={onOpen}
          onViewAll={() => onViewAll({ title: label, subtitle: addon.name, items: data })}
        />
      ) : (
        <section className="shelf" aria-busy={visible && !error}>
          <div className="shelf-header">
            <div className="shelf-title-group">
              <Heading level={2} className="shelf-heading">
                {label}
              </Heading>
              <span className="shelf-subtitle">{addon.name}</span>
            </div>
          </div>
          {error ? (
            <HStack gap={3} vAlign="center">
              <Message>Catalog unavailable.</Message>
              <Button
                variant="secondary"
                icon={<Icon icon={RotateCw} />}
                label="Try again"
                onClick={() => setAttempt((a) => a + 1)}
              />
            </HStack>
          ) : (
            <div className="skeleton-poster-row" aria-label="Loading catalog">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div key={idx} className="skeleton-poster-item">
                  <Skeleton width="100%" height={186} radius={3} index={idx} />
                  <Skeleton width="78%" height={14} radius={1} index={idx} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Search({ addons, onOpen }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const current = useRef(0);

  useEffect(
    () => () => {
      current.current++;
    },
    []
  );

  async function run(event) {
    event?.preventDefault();
    if (!query.trim()) return;
    const token = ++current.current;
    setBusy(true);
    setFailed(false);
    const catalogs = addons.flatMap((a) =>
      (a.catalogs || [])
        .filter((c) => (c.extra || []).some((e) => e.name === 'search'))
        .map((c) => ({ a, c }))
    );
    setItems([]);
    let results = [];
    await Promise.allSettled(
      catalogs.map(async ({ a, c }) => {
        try {
          const data = await resource(
            a,
            'catalog',
            c.type,
            c.id,
            '?search=' + encodeURIComponent(query.trim())
          );
          if (token !== current.current) return;
          results = dedupe([
            ...results,
            ...(data.metas || []).map((m) => ({ ...m, type: m.type || c.type }))
          ]);
          setItems(
            [...results]
              .sort(
                (x, y) =>
                  Number(y.name?.toLowerCase() === query.toLowerCase()) -
                  Number(x.name?.toLowerCase() === query.toLowerCase())
              )
              .slice(0, 120)
          );
        } catch {
          if (token === current.current) setFailed(true);
        }
      })
    );
    if (token === current.current) setBusy(false);
  }

  return (
    <VStack gap={5} className="page-section">
      <HStack as="form" className="search-form" gap={3} vAlign="end" onSubmit={run}>
        <TextInput
          startIcon={NuvioSearchIcon}
          containerClassName="search-field"
          label="Movie or series title"
          type="search"
          value={query}
          onChange={setQuery}
          hasClear
          enterKeyHint="search"
          placeholder="Search movies, series, anime, directors…"
          autoComplete="off"
        />
        <Button
          icon={<NuvioSearchIcon size={16} />}
          type="submit"
          label="Search"
          variant="primary"
          isLoading={busy}
          isDisabled={!query.trim()}
        />
      </HStack>
      <VStack gap={4} aria-live="polite" aria-busy={busy}>
        {failed && <Message>Some addon catalogs did not respond.</Message>}
        {busy && <Message>Searching across {addons.length} addons…</Message>}
        {items?.length ? (
          <Shelf title={`Results (${items.length})`} items={items} grid onOpen={onOpen} />
        ) : items ? (
          <Message>No matches found. Try another title.</Message>
        ) : (
          <Text color="secondary">
            Enter a title above to search Cinemeta, AIOStreams, TMDB, IMDb, and anime catalogs simultaneously.
          </Text>
        )}
      </VStack>
    </VStack>
  );
}

function TitleDialog({ item, addons, saved, onSave, onPlayStream, onClose, autoStart = false, initialPicker = false, addonsLoading = false }) {
  const [selectingStream, setSelectingStream] = useState(false);
  const [meta, setMeta] = useState(item);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState('');
  const [autoPlayId, setAutoPlayId] = useState(null);
  const [selected, setSelected] = useState(
    item.playbackId ? { id: item.playbackId, playbackTitle: item.playbackTitle } : item.type !== 'series' ? { id: item.id } : null
  );

  useEffect(() => {
    let active = true;
    Promise.any(
      addons
        .filter((a) => supports(a, 'meta', item.type))
        .map(async (a) => {
          const data = await resource(a, 'meta', item.type, item.id);
          if (!data.meta) throw Error('No metadata');
          return data.meta;
        })
    )
      .then((data) => {
        if (!active) return;
        const merged = { ...item, ...data };
        setMeta(merged);
        const vids = (merged.videos || []).filter((v) => v.id);
        if (merged.type !== 'series' && !vids.length) {
          setSelected({ id: merged.id });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [item, addons]);

  const episodes = (meta.videos || []).filter((v) => v.id);
  const seasons = [...new Set(episodes.map((v) => String(v.season ?? 0)))].sort(
    (a, b) => Number(a) - Number(b)
  );
  const activeSeason = season || seasons.find((s) => Number(s) > 0) || seasons[0] || '';
  const isSaved = saved.some((s) => s.type === meta.type && s.id === meta.id);
  const movie = meta.type !== 'series' && !episodes.length;
  const backdrop = safeURL(meta.background || meta.banner || meta.poster);
  const logo = safeURL(meta.logo);
  const rating = meta.imdbRating || meta.rating;
  const cast = Array.isArray(meta.cast) ? meta.cast.slice(0, 6) : [];

  return (
    <Dialog
      className="title-dialog"
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width="var(--ls-detail-width)"
      maxHeight="92dvh"
      padding={4}
    >
      <DialogHeader
        title={meta.name || meta.title || meta.id}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />
      {selectingStream && <Text type="supporting" color="secondary">Checking sources for your connection. Close this panel to cancel.</Text>}
      <VStack className="dialog-scroll" gap={4}>
        {/* Nuvio DetailHero Banner */}
        <div
          className="detail-hero-card"
          style={{
            backgroundImage: backdrop ? `url(${backdrop})` : 'none'
          }}
        >
          <div className="detail-hero-scrim" />
          <div className="detail-hero-content">
            {logo ? (
              <img src={logo} alt={meta.name || ''} className="detail-clearlogo" />
            ) : (
              <Heading level={2} className="detail-hero-title">
                {meta.name || meta.title || meta.id}
              </Heading>
            )}
            <div className="hero-meta-facts">
              {rating && <ImdbBadge rating={rating} size="sm" />}
              {(meta.releaseInfo || meta.year) && (
                <span className="hero-fact-item">{meta.releaseInfo || meta.year}</span>
              )}
              {meta.runtime && (
                <>
                  <span className="hero-fact-dot" />
                  <span className="hero-fact-item">{meta.runtime}</span>
                </>
              )}
              {(meta.genres || []).slice(0, 3).map((g) => (
                <span key={g} className="hero-pill-subtle">
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>

        <VStack gap={3} className="title-body">
          <Text as="p">
            {meta.description || meta.synopsis || 'No description available.'}
          </Text>

          {cast.length > 0 && (
            <div className="detail-cast-row">
              <span className="detail-cast-label">Cast:</span>
              {cast.map((person) => (
                <span key={person} className="detail-cast-chip">
                  {person}
                </span>
              ))}
            </div>
          )}

          <HStack gap={3} wrap="wrap">
            <Button
              variant="secondary"
              icon={<Icon icon={isSaved ? BookmarkCheck : Bookmark} />}
              label={isSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
              onClick={() => onSave(meta)}
              aria-pressed={isSaved}
            />
          </HStack>

          {loading && <Message>Loading full metadata…</Message>}

          {!movie && (
            <VStack gap={3} className="series-episodes-block">
              <HStack vAlign="center" hAlign="between" wrap="wrap" gap={2}>
                <HStack gap={2} vAlign="center">
                  <NuvioEpisodesIcon size={18} />
                  <Heading level={3}>Episodes</Heading>
                </HStack>
                <Selector
                  label="Season"
                  presentation="adaptive"
                  value={activeSeason}
                  onChange={(value) => {
                    setSeason(value);
                    setSelected(null);
                  }}
                  options={seasons.map((value) => ({
                    value,
                    label: value === '0' ? 'Specials' : `Season ${value}`
                  }))}
                />
              </HStack>

              {/* Quick season pill tabs */}
              {seasons.length > 1 && (
                <div className="nuvio-stream-chips" role="tablist" aria-label="Seasons">
                  {seasons.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="tab"
                      aria-selected={activeSeason === s}
                      className={`nuvio-chip ${activeSeason === s ? 'active' : ''}`}
                      onClick={() => {
                        setSeason(s);
                        setSelected(null);
                      }}
                    >
                      {s === '0' ? 'Specials' : `Season ${s}`}
                    </button>
                  ))}
                </div>
              )}

              <div className="nuvio-episodes-list">
                {episodes
                  .filter((v) => String(v.season ?? 0) === activeSeason)
                  .map((v) => {
                    const isEpSelected = selected?.id === v.id;
                    const thumb = safeURL(v.thumbnail || meta.background || meta.poster);
                    const epTitle = v.title || v.name || `Episode ${v.episode || ''}`;
                    const episodeEntry = {
                      ...v,
                      playbackTitle: `${meta.name || meta.title} · S${v.season || 1}:E${v.episode || 1}`
                    };
                    return (
                      <div key={v.id} className={`nuvio-episode-card ${isEpSelected ? 'active' : ''}`}>
                        <button
                          type="button"
                          className="episode-main"
                          aria-pressed={isEpSelected}
                          onClick={() => {
                            setSelected(episodeEntry);
                            setAutoPlayId(null);
                          }}
                        >
                          {thumb && (
                            <span className="episode-thumb-box">
                              <img src={thumb} alt="" className="episode-thumb-img" loading="lazy" />
                              <span className="episode-num-pill">
                                S{v.season || 1} · E{v.episode || 1}
                              </span>
                            </span>
                          )}
                          <span className="episode-info-box">
                            <span className="episode-title-text">
                              Episode {v.episode || ''} · {epTitle}
                            </span>
                            {v.overview && (
                              <span className="episode-overview-text">{v.overview}</span>
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="episode-play-btn"
                          aria-label={`Play episode ${v.episode || ''} ${epTitle}`}
                          title="Play this episode"
                          onClick={() => {
                            setSelected(episodeEntry);
                            setAutoPlayId(v.id);
                          }}
                        >
                          <NuvioPlayIcon size={16} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </VStack>
          )}

          {selected && (
            <Sources
              addons={addons}
              meta={{ ...meta, runtime: selected.runtime || meta.runtime }}
              videoId={selected.id}
              autoStart={autoStart || autoPlayId === selected.id}
              initialPicker={initialPicker}
              onSelectingChange={setSelectingStream}
              addonsLoading={addonsLoading}
              onPlay={(streamObj, selection) =>
                onPlayStream(streamObj, {
                  ...meta,
                  playbackId: selected.id,
                  playbackTitle: selected.playbackTitle
                }, selection)
              }
            />
          )}
        </VStack>
      </VStack>
    </Dialog>
  );
}

export function App({ onThemeChange }) {
  const [user, setUser] = useState(null);
  const [addons, setAddons] = useState(null);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(location.hash.slice(1) || 'home');
  const [item, setItem] = useState(null);
  const [playbackIntent, setPlaybackIntent] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const openTitle = (target, intent = null) => {
    setPlaybackIntent(intent);
    setItem(target);
  };
  const [expandedCatalog, setExpandedCatalog] = useState(null);
  const [activeStream, setActiveStream] = useState(null);
  const [playingMeta, setPlayingMeta] = useState(null);
  const [saved, setSaved] = useState([]);
  const [progress, setProgress] = useState({});
  const [featuredItems, setFeaturedItems] = useState([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [collectionFilter, setCollectionFilter] = useState('all');

  async function boot() {
    setError('');
    setAddonsLoading(true);
    try {
      const me = await api('/api/me');
      setUser(me);
      setSaved(readState(me.id, 'saved', []));
      setProgress(readState(me.id, 'progress', {}));

      const savedPrefs = {
        ...DEFAULT_PREFERENCES,
        ...readState(me.id, 'preferences', DEFAULT_PREFERENCES)
      };
      setPreferences(savedPrefs);
      applyPaletteToDOM(savedPrefs);
      onThemeChange?.(savedPrefs);

      setAddons(null);
      const response = await fetch('/api/addons?live=1', { credentials: 'same-origin' });
      if (!response.ok) throw Error('Could not load addons. Reload to try again.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const found = [];

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let end;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          if (line) {
            found.push(JSON.parse(line));
            setAddons([...found].sort((a, b) => a.index - b.index));
          }
        }
        if (done) break;
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setAddonsLoading(false);
    }
  }

  useEffect(() => {
    boot();
    const handleHash = () => {
      setRoute(location.hash.slice(1) || 'home');
      setItem(null);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleApplyPreferences = (newPrefs) => {
    setPreferences(newPrefs);
    applyPaletteToDOM(newPrefs);
    onThemeChange?.(newPrefs);
    try {
      localStorage.setItem('librestream:active_palette', newPrefs.palette);
      localStorage.setItem('librestream:active_accent', newPrefs.accent);
      localStorage.setItem('librestream:active_font', newPrefs.font || 'nuvio');
      if (user?.id) {
        writeState(user.id, 'preferences', newPrefs);
      }
    } catch {}
  };

  const toggleSave = (meta) => {
    setSaved((old) => {
      const exists = old.some((x) => x.id === meta.id && x.type === meta.type);
      const next = exists
        ? old.filter((x) => x.id !== meta.id || x.type !== meta.type)
        : [...old, meta];
      if (user?.id) writeState(user.id, 'saved', next);
      return next;
    });
  };

  const saveProgress = (entry) => {
    setProgress((old) => {
      const next = { ...old, [entry.type + ':' + entry.id]: entry };
      if (user?.id) writeState(user.id, 'progress', next);
      return next;
    });
  };

  const startPlayback = (streamObj, mediaMeta, selection) => {
    setAlternatives(selection?.alternatives || []);
    setActiveStream(streamObj);
    setPlayingMeta(mediaMeta);
    setItem(null);
  };

  const handleFeaturedItems = (incoming) => {
    setFeaturedItems((old) => dedupe([...old, ...incoming]).slice(0, 8));
  };

  const allCatalogs = (addons || []).flatMap((a) =>
    (a.catalogs || [])
      .filter((c) => !(c.extra || []).some((e) => e.isRequired))
      .map((c) => ({ a, c }))
  );

  const catalogs = allCatalogs.filter(({ c }) => {
    if (collectionFilter === 'movies') return c.type === 'movie';
    if (collectionFilter === 'series') return c.type === 'series';
    return true;
  });

  const resume = Object.values(progress).filter(
    (x) => x.position > 10 && x.position < x.duration - 30
  );

  const activePalette = PALETTES.find((p) => p.id === preferences.palette) || PALETTES[0];

  if (activeStream && playingMeta) {
    return (
      <Player
        meta={playingMeta}
        stream={activeStream}
        user={user}
        addons={addons || []}
        videoId={playingMeta.playbackId}
        playerStyle={preferences.player}
        onProgress={saveProgress}
        onBack={() => { setActiveStream(null); setAlternatives([]); }}
        onFailure={(position) => {
          if (!alternatives.length) return false;
          setActiveStream(alternatives[0]);
          setAlternatives(old => old.slice(1));
          setPlayingMeta(old => ({ ...old, resumePosition: position || old.resumePosition }));
          return true;
        }}
        onSwitchSource={() => {
          setActiveStream(null);
          setAlternatives([]);
          openTitle(playingMeta, 'choose');
        }}
      />
    );
  }

  const navDestinations = [
    ['home', 'Browse', NuvioHomeIcon],
    ['search', 'Search', NuvioSearchIcon],
    ['library', 'Saved', NuvioLibraryIcon],
    ['themes', 'Themes', NuvioPaletteIcon],
    ['settings', 'Settings', NuvioSettingsIcon]
  ];

  return (
    <AppShell
      height="auto"
      mobileNav={false}
      variant="wash"
      contentPadding={0}
      topNav={
        <header className="nuvio-top-bar">
          <a href="#home" className="brand-link" aria-label="LibreStream Home">
            <Brand />
          </a>

          {/* Desktop Center Navigation */}
          <nav className="desktop-nav-pills" aria-label="Desktop navigation">
            {navDestinations.map(([id, label, Glyph]) => {
              const active = route === id;
              return (
                <a
                  key={id}
                  href={'#' + id}
                  className={`desktop-nav-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Glyph size={17} />
                  <span>{label}</span>
                </a>
              );
            })}
          </nav>

          {/* Right Quick Actions (Never truncates brand on mobile) */}
          <div className="header-actions-group">
            <button
              type="button"
              className="header-theme-trigger"
              onClick={() => setShowSettingsModal(true)}
              aria-label="Appearance & Themes"
              title={`Theme: ${activePalette.name}`}
            >
              <span
                className="header-theme-dot"
                style={{ backgroundColor: preferences.accent || activePalette.accent }}
              />
              <NuvioPaletteIcon size={16} />
              <span className="header-theme-label">{activePalette.name}</span>
            </button>

            <a
              href="#settings"
              className="header-user-pill"
              title={`Signed in as ${user?.name || 'LibreStream'}`}
            >
              <span className="header-user-avatar">
                {(user?.name || 'L').slice(0, 1).toUpperCase()}
              </span>
              <span className="header-user-name">{user?.name || 'Profile'}</span>
            </a>
          </div>
        </header>
      }
    >
      {/* Nuvio Mobile Floating Glass Pill Navigation Bar (4 primary tabs so labels never clip at 320px) */}
      <nav className="app-nav" aria-label="Main navigation">
        {navDestinations
          .filter(([id]) => id !== 'themes')
          .map(([id, label, Glyph]) => {
            const active = route === id || (id === 'settings' && route === 'themes');
            return (
              <a
                key={id}
                href={'#' + id}
                className={`mobile-nav-tab ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="mobile-nav-icon">
                  <Glyph size={19} />
                </span>
                <span className="mobile-nav-label">{label}</span>
              </a>
            );
          })}
      </nav>

      <div className="app-main">
        {error ? (
          <VStack gap={4} className="page-section">
            <Message>{error}</Message>
            <Button icon={<Icon icon={RotateCw} />} label="Try again" onClick={boot} />
          </VStack>
        ) : !addons ? (
          <VStack gap={4} className="page-section">
            <Message>Loading your streaming catalogs…</Message>
            <div className="skeleton-poster-row">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-poster-item">
                  <Skeleton width="100%" height={186} radius={3} index={i} />
                  <Skeleton width="75%" height={14} radius={1} index={i} />
                </div>
              ))}
            </div>
          </VStack>
        ) : route === 'search' ? (
          <Layout
            height="auto"
            padding={4}
            header={
              <LayoutHeader hasDivider={false}>
                <Heading level={1}>Search Catalogs</Heading>
              </LayoutHeader>
            }
            content={
              <LayoutContent>
                <Search addons={addons} onOpen={openTitle} />
              </LayoutContent>
            }
          />
        ) : route === 'library' ? (
          <Layout
            height="auto"
            padding={4}
            header={
              <LayoutHeader hasDivider={false}>
                <Heading level={1}>Saved Watchlist</Heading>
              </LayoutHeader>
            }
            content={
              <LayoutContent>
                {saved.length ? (
                  <Shelf title="Saved titles" items={saved} grid onOpen={openTitle} />
                ) : (
                  <VStack gap={3} className="page-section">
                    <Message>
                      Your watchlist is empty. Open any movie or series and tap Add to Watchlist.
                    </Message>
                  </VStack>
                )}
              </LayoutContent>
            }
          />
        ) : route === 'themes' ? (
          <Layout
            height="auto"
            padding={4}
            header={
              <LayoutHeader hasDivider={false}>
                <Heading level={1}>Appearance & Themes</Heading>
              </LayoutHeader>
            }
            content={
              <LayoutContent>
                <div className="page-section">
                  <AppearanceContent
                    currentPreferences={preferences}
                    onApply={handleApplyPreferences}
                  />
                </div>
              </LayoutContent>
            }
          />
        ) : route === 'settings' ? (
          <Layout
            height="auto"
            padding={4}
            header={
              <LayoutHeader hasDivider={false}>
                <Heading level={1}>Settings & Addons</Heading>
              </LayoutHeader>
            }
            content={
              <LayoutContent>
                <VStack gap={6} className="page-section">
                  <div className="settings-profile-banner">
                    <div className="settings-avatar-lg">
                      {(user?.name || 'L').slice(0, 1).toUpperCase()}
                    </div>
                    <VStack gap={1}>
                      <Heading level={3}>{user?.name || 'Authenticated User'}</Heading>
                      <Text type="supporting" color="secondary">
                        Signed in with Authentik. Watchlist, resume points and appearance are saved in this browser for your account.
                      </Text>
                    </VStack>
                  </div>

                  {/* Direct inline Appearance & Theme Customizer */}
                  <AppearanceContent
                    currentPreferences={preferences}
                    onApply={handleApplyPreferences}
                  />

                  <VStack gap={3}>
                    <HStack vAlign="center" hAlign="between" wrap="wrap">
                      <Heading level={2}>Connected Addon Providers ({addons.length})</Heading>
                      <Button
                        variant="secondary"
                        icon={<Icon icon={RotateCw} />}
                        label="Refresh addons"
                        onClick={async () => setAddons(await api('/api/addons'))}
                      />
                    </HStack>

                    <div className="addons-grid">
                      {addons.map((a) => (
                        <div key={a.index} className="addon-status-card">
                          <div className="addon-card-info">
                            <span className="addon-card-title">{a.name}</span>
                            <span className="addon-card-sub">
                              {a.catalogs?.length || 0} catalogs · {(a.resources || []).join(', ')}
                            </span>
                          </div>
                          <Badge
                            variant={a.ok ? 'green' : 'red'}
                            label={a.ok ? 'Connected' : 'Offline'}
                          />
                        </div>
                      ))}
                    </div>
                  </VStack>
                </VStack>
              </LayoutContent>
            }
          />
        ) : (
          /* Browse / Home Route */
          <VStack gap={0} width="100%">
            {featuredItems.length > 0 && (
              <HeroBanner
                items={featuredItems}
                item={featuredItems[0]}
                layout={preferences.layout}
                onPlay={(target) => openTitle(target, 'auto')}
                onChooseStream={(target) => openTitle(target, 'choose')}
                onDetails={(target) => openTitle(target)}
                saved={saved}
                onToggleSave={toggleSave}
              />
            )}

            {/* Category Filter Chip Bar (Nuvio Home filter strip) */}
            <div className="filter-pills-row" role="group" aria-label="Catalog filter">
              {[
                ['all', 'All Catalogs'],
                ['movies', 'Movies'],
                ['series', 'Series']
              ].map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  className={`filter-pill ${collectionFilter === id ? 'active' : ''}`}
                  onClick={() => setCollectionFilter(id)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className={`filter-pill ${preferences.posterShape === 'landscape' ? 'active' : ''}`}
                onClick={() =>
                  handleApplyPreferences({
                    ...preferences,
                    posterShape: preferences.posterShape === 'landscape' ? 'poster' : 'landscape'
                  })
                }
              >
                {preferences.posterShape === 'landscape' ? '✓ Widescreen Cards' : 'Widescreen Cards'}
              </button>
              <button
                type="button"
                className="filter-pill"
                onClick={() => setShowSettingsModal(true)}
              >
                Theme: {activePalette.name}
              </button>
            </div>

            {resume.length > 0 && <ContinueWatchingShelf items={resume} onOpen={openTitle} />}

            {catalogs.map(({ a, c }, idx) => (
              <Catalog
                key={a.index + ':' + c.type + ':' + c.id}
                addon={a}
                catalog={c}
                shape={preferences.posterShape || 'poster'}
                onOpen={openTitle}
                onViewAll={setExpandedCatalog}
                onFeaturedItems={idx < 3 ? handleFeaturedItems : undefined}
              />
            ))}
          </VStack>
        )}
      </div>

      {/* Expanded Catalog Full Grid Modal ("See all") */}
      {expandedCatalog && (
        <Dialog
          isOpen
          onOpenChange={(open) => {
            if (!open) setExpandedCatalog(null);
          }}
          width="68rem"
          maxHeight="90dvh"
          padding={4}
        >
          <DialogHeader
            title={expandedCatalog.title}
            onOpenChange={(open) => {
              if (!open) setExpandedCatalog(null);
            }}
          />
          <div className="dialog-scroll">
            <Shelf
              title={expandedCatalog.subtitle || 'All titles'}
              items={expandedCatalog.items}
              grid
              onOpen={(picked) => {
                setExpandedCatalog(null);
                openTitle(picked);
              }}
            />
          </div>
        </Dialog>
      )}

      {/* Title Details & Stream Picker Dialog */}
      {item && (
        <TitleDialog
          key={(item.type || 'media') + ':' + item.id}
          item={item}
          addons={addons}
          addonsLoading={addonsLoading}
          saved={saved}
          onSave={toggleSave}
          onPlayStream={startPlayback}
          autoStart={playbackIntent === 'auto'}
          initialPicker={playbackIntent === 'choose'}
          onClose={() => setItem(null)}
        />
      )}

      {/* Appearance Settings Modal */}
      {showSettingsModal && (
        <AppearanceSettings
          isOpen={showSettingsModal}
          currentPreferences={preferences}
          onApply={handleApplyPreferences}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </AppShell>
  );
}
