import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Icon } from '@astryxdesign/core/Icon';
import {
  Bookmark,
  BookmarkCheck,
  Clapperboard,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { AppShell } from '@astryxdesign/core/AppShell';
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
  posterMetaLine,
  certificationOf,
  awardsBadge,
  isNew,
  episodeSummary,
  runtimeLabel,
  availabilityBadges,
  readAvailabilityStore
} from './badges.js';
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

function PosterCard({
  item,
  onOpen,
  shape = 'poster',
  inGrid = false,
  saved = false,
  progress = 0,
  availability = null,
  onPlay
}) {
  const [broken, setBroken] = useState(false);
  const rating = item.imdbRating || item.rating;
  const certification = certificationOf(item);
  const title = item.name || item.title || item.id;
  const isLandscape = shape === 'landscape' && !inGrid;
  const imgUrl = isLandscape
    ? safeURL(item.background || item.banner || item.poster)
    : safeURL(item.poster || item.background);
  const logoUrl = isLandscape ? safeURL(item.logo) : '';

  const metaLine = posterMetaLine(item);
  const fresh = isNew(item);
  const pct = Math.round(Math.min(100, Math.max(0, progress)));

  // The strip carries quality, language count and cache. Hover reveals the rest.
  const quality = availabilityBadges(availability);
  const shown = quality.slice(0, 3);
  const trimmed = quality.slice(3);
  const langCount = availability?.languages?.length || 0;

  return (
    <div
      className={`poster-card ${isLandscape ? 'poster-card-landscape' : 'poster-card-portrait'} ${
        inGrid ? 'poster-card-grid' : 'poster-card-rail'
      }`}
      data-media-id={item.id}
    >
      <div className="poster-art-wrap">
        <button
          type="button"
          className="poster-hit"
          onClick={() => onOpen(item)}
          aria-label={`${title}${metaLine ? ', ' + metaLine : ''}`}
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

            <div className="poster-badges-top">
              {certification && <span className="poster-badge">{certification}</span>}
              {fresh && <span className="poster-badge is-new">New</span>}
            </div>

            {rating && (
              <span className="poster-badge is-rating">
                <span className="poster-star">★</span>
                {Number(rating) ? Number(rating).toFixed(1) : rating}
              </span>
            )}

            {isLandscape && logoUrl && (
              <img src={logoUrl} alt="" className="poster-landscape-logo" />
            )}

            {pct > 0 && (
              <div className="poster-progress" aria-hidden="true">
                <div style={{ width: `${pct}%` }} />
              </div>
            )}

            {trimmed.length > 0 && (
              <div className="poster-reveal" aria-hidden="true">
                {trimmed.map((badge) => (
                  <span key={badge} className="poster-badge is-quality">
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>

        {onPlay && (
          <button
            type="button"
            className="poster-quick-play"
            aria-label={`Play ${title}`}
            title="Play best source"
            onClick={(event) => {
              event.stopPropagation();
              onPlay(item);
            }}
          >
            <NuvioPlayIcon size={15} />
          </button>
        )}
      </div>

      <button type="button" className="poster-caption" onClick={() => onOpen(item)}>
        <span className="poster-title">{title}</span>
        {metaLine && <span className="poster-sub">{metaLine}</span>}
        {(shown.length > 0 || langCount > 0 || saved) && (
          <span className="poster-strip">
            {shown.map((badge) => (
              <i key={badge} className="poster-chip is-quality">
                {badge}
              </i>
            ))}
            {langCount > 0 && <i className="poster-chip">{langCount} lang</i>}
            {availability?.cached > 0 && <i className="poster-chip is-cache">cached</i>}
            {saved && <i className="poster-chip is-saved">saved</i>}
          </span>
        )}
      </button>
    </div>
  );
}

function ScrollRow({ label, children }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft > 4,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    });
  };

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  const nudge = (direction) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <div className="scroll-row">
      <div className="poster-row" ref={ref} onScroll={measure} aria-label={label}>
        {children}
      </div>
      {edges.start && (
        <button
          type="button"
          className="row-arrow is-start"
          aria-label={`Scroll ${label} back`}
          onClick={() => nudge(-1)}
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {edges.end && (
        <button
          type="button"
          className="row-arrow is-end"
          aria-label={`Scroll ${label} forward`}
          onClick={() => nudge(1)}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

function Shelf({
  title,
  subtitle,
  items,
  onOpen,
  onViewAll,
  shape = 'poster',
  grid = false,
  savedIds,
  progressMap,
  availabilityStore,
  onPlay
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
              saved={savedIds?.has((item.type || 'movie') + ':' + item.id)}
              progress={progressMap?.[(item.type || 'movie') + ':' + item.id]?.position
                ? (progressMap[(item.type || 'movie') + ':' + item.id].position /
                    (progressMap[(item.type || 'movie') + ':' + item.id].duration || 1)) * 100
                : 0}
              availability={availabilityStore?.[item.type + ':' + item.id]}
              onPlay={onPlay}
            />
          ))}
        </div>
      ) : (
        <ScrollRow label={title}>
          {items.map((item) => (
            <PosterCard
              key={(item.type || 'media') + ':' + item.id}
              item={item}
              onOpen={onOpen}
              shape={shape}
              saved={savedIds?.has((item.type || 'movie') + ':' + item.id)}
              progress={progressMap?.[(item.type || 'movie') + ':' + item.id]?.position
                ? (progressMap[(item.type || 'movie') + ':' + item.id].position /
                    (progressMap[(item.type || 'movie') + ':' + item.id].duration || 1)) * 100
                : 0}
              availability={availabilityStore?.[item.type + ':' + item.id]}
              onPlay={onPlay}
            />
          ))}
        </ScrollRow>
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
      <ScrollRow label="Continue watching">
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
      </ScrollRow>
    </section>
  );
}

function Catalog({ addon, catalog, shape, onOpen, onViewAll, onFeaturedItems, savedIds, progressMap, availabilityStore, onPlay }) {
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
          savedIds={savedIds}
          progressMap={progressMap}
          availabilityStore={availabilityStore}
          onPlay={onPlay}
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
    <VStack gap={5} className="search-page">
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
          <Shelf
            title={`Results (${items.length})`}
            items={items}
            grid
            savedIds={savedIds}
            progressMap={progressMap}
            availabilityStore={availabilityStore}
            onOpen={onOpen}
            onPlay={onPlay}
          />
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

function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener('change', sync);
    return () => list.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

function TitleDialog({ item, addons, saved, onSave, onPlayStream, onClose, autoStart = false, initialPicker = false, addonsLoading = false }) {
  const wide = useMediaQuery('(min-width: 48rem)');
  const [selectingStream, setSelectingStream] = useState(false);
  const [meta, setMeta] = useState(item);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState('');
  const [tab, setTab] = useState('episodes');
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
  const poster = safeURL(meta.poster || meta.background);
  const logo = safeURL(meta.logo);
  const rating = meta.imdbRating || meta.rating;
  const cast = Array.isArray(meta.cast) ? meta.cast.slice(0, 6) : [];
  const title = meta.name || meta.title || meta.id;
  const certification = certificationOf(meta);
  const awards = awardsBadge(meta.awards);
  const runtime = runtimeLabel(meta.runtime);

  const facts = (
    <div className="detail-facts">
      {rating && <ImdbBadge rating={rating} size="sm" />}
      {(meta.releaseInfo || meta.year) && (
        <span className="detail-fact">{meta.releaseInfo || meta.year}</span>
      )}
      {runtime && <span className="detail-fact">{runtime}</span>}
      {certification && <span className="detail-fact is-boxed">{certification}</span>}
      {awards && <span className="detail-fact is-accent">{awards}</span>}
      {meta.type === 'series' && episodes.length > 0 && (
        <span className="detail-fact">{episodeSummary(episodes)}</span>
      )}
    </div>
  );

  const actions = (
    <div className="detail-actions">
      {selected && (
        <button
          type="button"
          className="detail-btn is-primary"
          onClick={() => {
            setAutoPlayId(selected.id);
            if (!wide) setTab('streams');
          }}
        >
          <NuvioPlayIcon size={15} />
          {movie ? 'Play' : 'Play episode'}
        </button>
      )}
      <button
        type="button"
        className="detail-btn"
        onClick={() => {
          setAutoPlayId(null);
          setTab('streams');
          if (!selected) setSelected({ id: meta.id });
        }}
      >
        Choose stream
      </button>
      <button
        type="button"
        className="detail-btn is-ghost"
        aria-pressed={isSaved}
        onClick={() => onSave(meta)}
      >
        <Icon icon={isSaved ? BookmarkCheck : Bookmark} size="sm" />
        {isSaved ? 'Saved' : 'Watchlist'}
      </button>
    </div>
  );

  const overview = (
    <>
      <p className="detail-synopsis">{meta.description || meta.synopsis || 'No description available.'}</p>
      {cast.length > 0 && (
        <div className="detail-cast-row">
          <span className="detail-cast-label">Cast</span>
          {cast.map((person) => (
            <span key={person} className="detail-cast-chip">{person}</span>
          ))}
        </div>
      )}
      {(meta.genres || []).length > 0 && (
        <div className="detail-cast-row">
          <span className="detail-cast-label">Genre</span>
          {meta.genres.map((g) => (
            <span key={g} className="detail-cast-chip">{g}</span>
          ))}
        </div>
      )}
    </>
  );

  const episodeList = !movie && (
    <div className="episode-block">
      <div className="episode-block-head">
        <h3>Episodes</h3>
        {seasons.length > 1 && (
          <div className="season-tabs" role="tablist" aria-label="Season">
            {seasons.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeSeason === value}
                className={activeSeason === value ? 'is-active' : ''}
                onClick={() => {
                  setSeason(value);
                  setSelected(null);
                }}
              >
                {value === '0' ? 'Specials' : `S${value}`}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="episode-list">
        {episodes
          .filter((v) => String(v.season ?? 0) === activeSeason)
          .map((v) => {
            const isEpSelected = selected?.id === v.id;
            const thumb = safeURL(v.thumbnail || meta.background || meta.poster);
            const epTitle = v.title || v.name || `Episode ${v.episode || ''}`;
            const episodeEntry = {
              ...v,
              playbackTitle: `${title} · S${v.season || 1}:E${v.episode || 1}`
            };
            return (
              <div key={v.id} className={`episode-row ${isEpSelected ? 'is-active' : ''}`}>
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
                        S{v.season || 1}·E{v.episode || 1}
                      </span>
                    </span>
                  )}
                  <span className="episode-info-box">
                    <span className="episode-title-text">{epTitle}</span>
                    {v.overview && <span className="episode-overview-text">{v.overview}</span>}
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
                    if (!wide) setTab('streams');
                  }}
                >
                  <NuvioPlayIcon size={15} />
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );

  const sources = selected && (
    <Sources
      addons={addons}
      meta={{ ...meta, runtime: selected.runtime || meta.runtime }}
      videoId={selected.id}
      autoStart={autoStart || autoPlayId === selected.id}
      initialPicker={initialPicker}
      showActions={!wide}
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
  );

  return (
    <Dialog
      className={`title-dialog ${wide ? 'is-wide' : 'is-narrow'}`}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width={wide ? 'var(--ls-detail-width)' : 'min(100vw, 34rem)'}
      maxHeight="92dvh"
      padding={0}
    >
      <DialogHeader
        title={title}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />
      {selectingStream && (
        <Text type="supporting" color="secondary" className="dialog-status">
          Checking sources for your connection. Close this panel to cancel.
        </Text>
      )}

      {wide ? (
        <div className="dialog-scroll detail-wide">
          <div className="detail-aside">
            {poster && <img src={poster} alt="" className="detail-poster" />}
            {facts}
            {actions}
          </div>
          <div className="detail-main">
            {overview}
            {loading && <Message>Loading full metadata…</Message>}
            {episodeList}
            {sources}
          </div>
        </div>
      ) : (
        <div className="dialog-scroll detail-narrow">
          <div
            className="detail-banner"
            style={{ backgroundImage: backdrop ? `url(${backdrop})` : 'none' }}
          >
            <div className="detail-banner-scrim" />
            <div className="detail-banner-body">
              {logo ? <img src={logo} alt="" className="detail-clearlogo" /> : <h2>{title}</h2>}
              {facts}
            </div>
          </div>
          {actions}
          <div className="detail-tabs" role="tablist">
            {[
              ['episodes', 'Episodes', !movie],
              ['overview', 'Overview', true],
              ['streams', 'Streams', Boolean(selected)]
            ]
              .filter(([, , show]) => show)
              .map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? 'is-active' : ''}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
          </div>
          <div className="detail-pane">
            {tab === 'episodes' && episodeList}
            {tab === 'overview' && overview}
            {tab === 'streams' && sources}
            {tab === 'episodes' && movie && overview}
          </div>
        </div>
      )}
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
  const [availabilityStore, setAvailabilityStore] = useState(() => readAvailabilityStore());

  const savedIds = useMemo(
    () => new Set(saved.map((entry) => (entry.type || 'movie') + ':' + entry.id)),
    [saved]
  );
  const refreshAvailability = () => setAvailabilityStore(readAvailabilityStore());

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
    refreshAvailability();
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
          <section className="page-section">
            <h1 className="page-title">Search</h1>
            <Search addons={addons} onOpen={openTitle} />
          </section>
        ) : route === 'library' ? (
          <section className="page-section">
            <h1 className="page-title">Saved</h1>
            {saved.length ? (
              <div className="shelf shelf-inline">
                <Shelf
                  title="Watchlist"
                  subtitle={`${saved.length} saved`}
                  items={saved}
                  grid
                  savedIds={savedIds}
                  progressMap={progress}
                  availabilityStore={availabilityStore}
                  onOpen={openTitle}
                  onPlay={(target) => openTitle(target, 'auto')}
                />
              </div>
            ) : (
              <p className="empty-note">
                Nothing saved yet. Open a title and choose Add to Watchlist.
              </p>
            )}
          </section>
        ) : route === 'themes' ? (
          <section className="page-section">
            <h1 className="page-title">Appearance</h1>
            <AppearanceContent
              currentPreferences={preferences}
              onApply={handleApplyPreferences}
            />
          </section>
        ) : route === 'settings' ? (
          <section className="page-section">
            <h1 className="page-title">Settings</h1>
            <VStack gap={6}>
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
                              {a.catalogs?.length || 0} catalogs
                              {(() => {
                                const names = (a.resources || [])
                                  .map((r) => (typeof r === 'string' ? r : r?.name))
                                  .filter(Boolean);
                                return names.length ? ` · ${[...new Set(names)].join(', ')}` : '';
                              })()}
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
          </section>
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
                savedIds={savedIds}
                progressMap={progress}
                availabilityStore={availabilityStore}
                onPlay={(target) => openTitle(target, 'auto')}
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
              savedIds={savedIds}
              progressMap={progress}
              availabilityStore={availabilityStore}
              onPlay={(target) => {
                setExpandedCatalog(null);
                openTitle(target, 'auto');
              }}
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
          onClose={() => {
            setItem(null);
            refreshAvailability();
          }}
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
