import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Play,
  Search as SearchIcon
} from 'lucide-react';
import { Button, IconButton, Badge, Chip, Field, Select, Segmented, Modal, ModalHeader, Skeleton } from './ui.jsx';
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
  ImdbBadge
} from './Icons.jsx';
import { DEFAULT_PREFERENCES, PALETTES, applyPaletteToDOM } from './palettes.js';
import { api, resource, supports, dedupe, safeURL, readState, writeState } from './api';
import {
  posterMetaLine,
  certificationOf,
  awardsBadge,
  isNew,
  episodeSummary,
  runtimeLabel,
  availabilityBadges,
  formatSize,
  rottenTomatoesOf,
  rememberTitleMeta,
  readAvailabilityStore,
  titlesNeedingAvailability,
  prefetchAvailability
} from './badges.js';

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

/* ------------------------------ poster card ------------------------------ */

function PosterCard({ item, onOpen, onPlay, saved = false, progress = 0, availability = null, inGrid = false }) {
  const [broken, setBroken] = useState(false);
  const remembered = availability || {};
  const imdb = item.imdbRating || item.rating;
  const rt = rottenTomatoesOf(item) || (remembered.rt ? { score: remembered.rt } : null);
  const cert = certificationOf(item) || remembered.cert || '';
  const title = item.name || item.title || item.id;
  const poster = safeURL(item.poster || item.background);
  const metaLine = posterMetaLine(item);
  const pct = Math.round(Math.min(100, Math.max(0, progress)));

  const strip = [
    ...availabilityBadges(remembered),
    remembered.size ? formatSize(remembered.size) : '',
    remembered.cached > 0 ? 'cached' : '',
    isNew(item) ? 'new' : '',
    saved ? 'saved' : ''
  ].filter(Boolean);

  return (
    <article className="ls-poster" data-media-id={item.id}>
      <div className="ls-poster-art">
        <button
          type="button"
          className="ls-poster-hit"
          onClick={() => onOpen(item)}
          aria-label={`${title}${metaLine ? ', ' + metaLine : ''}`}
        >
          <div className="ls-poster-media">
            {!broken && poster ? (
              <img className="ls-poster-img" src={poster} alt="" loading="lazy" onError={() => setBroken(true)} />
            ) : (
              <div className="ls-poster-empty">
                <Clapperboard size={22} strokeWidth={1.5} />
              </div>
            )}

            {(imdb || rt) && (
              <span className="ls-poster-ratings">
                {imdb && (
                  <Badge tone="gold">
                    ★ {Number(imdb) ? Number(imdb).toFixed(1) : imdb}
                  </Badge>
                )}
                {rt && (
                  <Badge aria-label={`Rotten Tomatoes ${rt.score} percent`}>{rt.score}%</Badge>
                )}
              </span>
            )}

            {cert && (
              <span className="ls-poster-cert">
                <Badge>{cert}</Badge>
              </span>
            )}

            {pct > 0 && (
              <div className="ls-poster-progress" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        </button>

        {onPlay && (
          <button
            type="button"
            className="ls-poster-play"
            aria-label={`Play ${title}`}
            title="Play best stream"
            onClick={(event) => {
              event.stopPropagation();
              onPlay(item);
            }}
          >
            <Play size={15} fill="currentColor" strokeWidth={0} />
          </button>
        )}
      </div>

      <button type="button" className="ls-poster-caption" onClick={() => onOpen(item)}>
        <span className="ls-poster-title">{title}</span>
        {metaLine && <span className="ls-poster-meta">{metaLine}</span>}
        {strip.length > 0 && (
          <span className="ls-poster-strip">
            {strip.map((label) => (
              <i
                key={label}
                className={`ls-strip-item${
                  /^(4K|DV|HDR|Atmos|REMUX|\d+p)$/i.test(label) ? ' is-quality' : ''
                }${label === 'cached' ? ' is-cached' : ''}`}
              >
                {label}
              </i>
            ))}
          </span>
        )}
      </button>
    </article>
  );
}

/* ------------------------------ rows & shelves ------------------------------ */

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
    <div className="ls-row">
      <div className="ls-row-scroll" ref={ref} onScroll={measure} aria-label={label}>
        {children}
      </div>
      {edges.start && (
        <button type="button" className="ls-row-arrow is-start" aria-label={`Scroll ${label} back`} onClick={() => nudge(-1)}>
          <ChevronLeft size={16} />
        </button>
      )}
      {edges.end && (
        <button type="button" className="ls-row-arrow is-end" aria-label={`Scroll ${label} forward`} onClick={() => nudge(1)}>
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

function Shelf({ title, subtitle, items, onOpen, onPlay, onViewAll, grid = false, savedIds, progressMap, availabilityStore }) {
  if (!items?.length) return null;
  const cards = items.map((item) => (
    <PosterCard
      key={(item.type || 'media') + ':' + item.id}
      item={item}
      onOpen={onOpen}
      onPlay={onPlay}
      inGrid={grid}
      saved={savedIds?.has((item.type || 'movie') + ':' + item.id)}
      progress={
        progressMap?.[(item.type || 'movie') + ':' + item.id]?.position
          ? (progressMap[(item.type || 'movie') + ':' + item.id].position /
              (progressMap[(item.type || 'movie') + ':' + item.id].duration || 1)) * 100
          : 0
      }
      availability={availabilityStore?.[(item.type || 'movie') + ':' + item.id]}
    />
  ));

  return (
    <section className="ls-shelf">
      <div className="ls-shelf-head">
        <h2 className="ls-shelf-title">{title}</h2>
        {subtitle && <span className="ls-shelf-sub">{subtitle}</span>}
        {!grid && onViewAll && (
          <button type="button" className="ls-shelf-more" onClick={onViewAll} aria-label={`See all in ${title}`}>
            See all <ChevronRight size={14} />
          </button>
        )}
      </div>
      {grid ? <div className="ls-grid">{cards}</div> : <ScrollRow label={title}>{cards}</ScrollRow>}
    </section>
  );
}

function ContinueWatching({ items, onOpen }) {
  if (!items?.length) return null;
  return (
    <section className="ls-shelf">
      <div className="ls-shelf-head">
        <h2 className="ls-shelf-title">Continue watching</h2>
        <span className="ls-shelf-sub">{items.length} in progress</span>
      </div>
      <ScrollRow label="Continue watching">
        {items.map((item) => {
          const pct = Math.min(100, Math.max(1, (item.position / (item.duration || 1)) * 100));
          const backdrop = safeURL(item.background || item.poster);
          const left = Math.max(0, (item.duration || 0) - (item.position || 0));
          const mins = Math.round(left / 60);
          const label = !mins ? 'Almost done' : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m left` : `${mins}m left`;
          return (
            <button
              type="button"
              key={(item.type || 'media') + ':' + item.id}
              className="ls-wide-card"
              onClick={() => onOpen(item)}
            >
              <div className="ls-wide-media" style={{ backgroundImage: backdrop ? `url(${backdrop})` : 'none' }}>
                <span className="ls-wide-play" aria-hidden="true">
                  <Play size={11} fill="currentColor" strokeWidth={0} />
                </span>
                <span className="ls-wide-badge">{label}</span>
                <span className="ls-wide-bar" aria-hidden="true">
                  <i style={{ width: `${pct}%` }} />
                </span>
              </div>
              <div className="ls-wide-meta">
                <span className="ls-poster-title">{item.name || item.id}</span>
                <span className="ls-poster-meta">{item.playbackTitle || item.releaseInfo || `${Math.round(pct)}% watched`}</span>
              </div>
            </button>
          );
        })}
      </ScrollRow>
    </section>
  );
}

function Catalog({ addon, catalog, onOpen, onPlay, onViewAll, onFeaturedItems, savedIds, progressMap, availabilityStore }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
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
      .then((result) => {
        if (!active) return;
        const metas = dedupe((result.metas || []).map((meta) => ({ ...meta, type: meta.type || catalog.type }))).slice(0, 24);
        setData(metas);
        if (metas.length && onFeaturedItems) onFeaturedItems(metas.slice(0, 6));
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [visible, attempt, addon, catalog]);

  const typeText = catalog.type === 'movie' ? 'Movies' : catalog.type === 'series' ? 'Series' : catalog.type;
  const label = `${catalog.name || catalog.id} · ${typeText}`;

  return (
    <div ref={ref}>
      {data ? (
        <Shelf
          title={label}
          subtitle={addon.name}
          items={data}
          onOpen={onOpen}
          onPlay={onPlay}
          onViewAll={() => onViewAll({ title: label, subtitle: addon.name, items: data })}
          savedIds={savedIds}
          progressMap={progressMap}
          availabilityStore={availabilityStore}
        />
      ) : (
        <section className="ls-shelf" aria-busy={visible && !error}>
          <div className="ls-shelf-head">
            <h2 className="ls-shelf-title">{label}</h2>
            <span className="ls-shelf-sub">{addon.name}</span>
          </div>
          {error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ls-3)' }}>
              <p className="ls-note" style={{ padding: 'var(--ls-3)' }}>Catalog unavailable.</p>
              <Button variant="secondary" size="sm" icon={<RotateCw size={14} />} label="Try again" onClick={() => setAttempt((n) => n + 1)} />
            </div>
          ) : (
            <div className="ls-row-scroll" aria-label="Loading catalog">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div key={index} style={{ flex: '0 0 var(--ls-rail)', width: 'var(--ls-rail)' }}>
                  <Skeleton height={Math.round(9.5 * 16 * 1.5)} radius={14} />
                  <div style={{ height: 8 }} />
                  <Skeleton height={12} width="78%" radius={4} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ------------------------------ search ------------------------------ */

function Search({ addons, onOpen, onPlay, savedIds, progressMap, availabilityStore }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const current = useRef(0);

  useEffect(() => () => { current.current++; }, []);

  async function run(event) {
    event?.preventDefault();
    if (!query.trim()) return;
    const token = ++current.current;
    setBusy(true);
    setFailed(false);
    const catalogs = addons.flatMap((addon) =>
      (addon.catalogs || [])
        .filter((catalog) => (catalog.extra || []).some((extra) => extra.name === 'search'))
        .map((catalog) => ({ addon, catalog }))
    );
    setItems([]);
    let results = [];
    await Promise.allSettled(
      catalogs.map(async ({ addon, catalog }) => {
        try {
          const data = await resource(addon, 'catalog', catalog.type, catalog.id, '?search=' + encodeURIComponent(query.trim()));
          if (token !== current.current) return;
          results = dedupe([...results, ...(data.metas || []).map((meta) => ({ ...meta, type: meta.type || catalog.type }))]);
          setItems(
            [...results]
              .sort(
                (a, b) =>
                  Number(b.name?.toLowerCase() === query.toLowerCase()) -
                  Number(a.name?.toLowerCase() === query.toLowerCase())
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
    <div>
      <form className="ls-search-bar" onSubmit={run}>
        <Field label="Title" value={query} onChange={setQuery} placeholder="Search movies, series, anime…" />
        <Button type="submit" variant="primary" icon={<SearchIcon size={16} />} label="Search" busy={busy} disabled={!query.trim()} />
      </form>
      {failed && <p className="ls-note" style={{ marginBottom: 'var(--ls-3)' }}>Some addon catalogs did not respond.</p>}
      {busy && !items?.length && <p className="ls-note">Searching {addons.length} addons…</p>}
      {items?.length ? (
        <Shelf
          title={`Results (${items.length})`}
          items={items}
          grid
          onOpen={onOpen}
          onPlay={onPlay}
          savedIds={savedIds}
          progressMap={progressMap}
          availabilityStore={availabilityStore}
        />
      ) : items ? (
        <p className="ls-note">No matches. Try another title.</p>
      ) : (
        <p className="ls-note">Enter a title to search every configured catalog at once.</p>
      )}
    </div>
  );
}

/* ------------------------------ title takeover ------------------------------ */

function TitlePage({
  item,
  addons,
  saved,
  onSave,
  onPlayStream,
  onClose,
  autoStart = false,
  initialPicker = false,
  addonsLoading = false,
  onEpisode
}) {
  const wide = useMediaQuery('(min-width: 48rem)');
  const [meta, setMeta] = useState(item);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState('');
  const [showStreams, setShowStreams] = useState(initialPicker || autoStart);
  const [pickerRequest, setPickerRequest] = useState(initialPicker ? 1 : 0);
  const [autoPlayId, setAutoPlayId] = useState(null);
  const [selected, setSelected] = useState(
    item.playbackId
      ? { id: item.playbackId, playbackTitle: item.playbackTitle }
      : item.type !== 'series'
        ? { id: item.id }
        : null
  );

  useEffect(() => {
    let active = true;
    Promise.allSettled(
      addons
        .filter((addon) => supports(addon, 'meta', item.type))
        .map(async (addon) => {
          const data = await resource(addon, 'meta', item.type, item.id);
          if (!data.meta) throw Error('No metadata');
          return data.meta;
        })
    )
      .then((results) => {
        if (!active) return;
        const answers = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
        if (!answers.length) throw Error('No metadata');
        const merged = answers.reduce((acc, next) => {
          for (const [key, value] of Object.entries(next)) {
            const empty =
              acc[key] === undefined || acc[key] === null || acc[key] === '' ||
              (Array.isArray(acc[key]) && !acc[key].length);
            if (empty) acc[key] = value;
            else if (key === 'app_extras' && value && typeof value === 'object') acc[key] = { ...value, ...acc[key] };
          }
          return acc;
        }, {});
        const combined = { ...item, ...merged };
        setMeta(combined);
        rememberTitleMeta(
          (combined.type || 'movie') + ':' + combined.id,
          { cert: certificationOf(combined), rt: rottenTomatoesOf(combined) }
        );
        if (combined.type !== 'series') setSelected({ id: combined.id });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [item, addons]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const episodes = (meta.videos || []).filter((video) => video.id);
  const seasons = [...new Set(episodes.map((video) => String(video.season ?? 0)))].sort((a, b) => Number(a) - Number(b));
  const activeSeason = season || seasons.find((value) => Number(value) > 0) || seasons[0] || '';
  const isSaved = saved.some((entry) => entry.type === meta.type && entry.id === meta.id);
  const isSeries = meta.type === 'series' && episodes.length > 0;
  const backdrop = safeURL(meta.background || meta.banner || meta.poster);
  const logo = safeURL(meta.logo);
  const title = meta.name || meta.title || meta.id;
  const rating = meta.imdbRating || meta.rating;
  const cert = certificationOf(meta);
  const awards = awardsBadge(meta.awards);
  const runtime = runtimeLabel(meta.runtime);
  const cast = Array.isArray(meta.cast) ? meta.cast.slice(0, 6) : [];
  const genres = (meta.genres || meta.genre || []).slice(0, 3);

  const facts = (
    <div className="ls-hero-facts">
      {rating && <ImdbBadge rating={rating} size="sm" />}
      {(meta.releaseInfo || meta.year) && <span>{meta.releaseInfo || meta.year}</span>}
      {runtime && <span>{runtime}</span>}
      {cert && <span className="is-cert">{cert}</span>}
      {isSeries && <span>{episodeSummary(episodes)}</span>}
      {awards && <span className="is-accent">{awards}</span>}
      {genres.length > 0 && (
        <>
          <span className="sep">·</span>
          <span>{genres.join(', ')}</span>
        </>
      )}
    </div>
  );

  const actions = (
    <div className="ls-takeover-actions">
      {!isSeries && (
        <>
          <Button
            variant="primary"
            icon={<Play size={15} fill="currentColor" strokeWidth={0} />}
            label="Play"
            onClick={() => {
              setSelected({ id: meta.id });
              setShowStreams(true);
              setAutoPlayId(meta.id);
            }}
          />
          <Button
            variant="secondary"
            label="Choose stream"
            onClick={() => {
              setShowStreams(true);
              setPickerRequest((n) => n + 1);
            }}
          />
        </>
      )}
      <Button
        variant="secondary"
        icon={isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        label={isSaved ? 'Saved' : 'Watchlist'}
        aria-pressed={isSaved}
        onClick={() => onSave(meta)}
      />
      <IconButton icon={<ChevronLeft size={18} />} label="Back" onClick={onClose} />
    </div>
  );

  const sourcesBlock = showStreams && selected && (
    <div className="ls-takeover-section">
      <h2 className="ls-section-title">
        Streams
        {isSeries && selected.playbackTitle ? <span className="ls-shelf-sub">{selected.playbackTitle}</span> : null}
      </h2>
      <Sources
        addons={addons}
        meta={{ ...meta, runtime: selected.runtime || meta.runtime }}
        videoId={selected.id}
        autoStart={autoStart || autoPlayId === selected.id}
        openPicker={pickerRequest}
        showActions={false}
        addonsLoading={addonsLoading}
        onPlay={(streamObj, selection) =>
          onPlayStream(streamObj, { ...meta, playbackId: selected.id, playbackTitle: selected.playbackTitle }, selection)
        }
      />
    </div>
  );

  return (
    <div className="ls-takeover">
      <section className="ls-takeover-hero">
        {backdrop && <img className="ls-hero-art" src={backdrop} alt="" />}
        <div className="ls-hero-scrim" aria-hidden="true" />
        <div className="ls-takeover-body">
          <button type="button" className="ls-btn ls-btn--ghost ls-btn--sm" onClick={onClose} style={{ alignSelf: 'flex-start' }}>
            <ChevronLeft size={15} /> Back
          </button>
          {logo ? <img className="ls-hero-logo" src={logo} alt={title} /> : <h1 className="ls-hero-title">{title}</h1>}
          {facts}
          {(meta.description || meta.synopsis) && (
            <p className="ls-hero-synopsis">{meta.description || meta.synopsis}</p>
          )}
          {actions}
        </div>
      </section>

      {!isSeries && !showStreams && (
        <div className="ls-takeover-section">
          {cast.length > 0 && (
            <div className="ls-cast">
              <span className="ls-cast-label">Cast</span>
              {cast.map((person) => (
                <span key={person} className="ls-cast-item">{person}</span>
              ))}
            </div>
          )}
          {loading && <p className="ls-note" style={{ marginTop: 'var(--ls-3)' }}>Loading full metadata…</p>}
        </div>
      )}

      {isSeries && (
        <div className="ls-takeover-section">
          <div className="ls-section-title">
            Episodes
            {seasons.length > 1 && (
              <span className="ls-season-tabs">
                {seasons.map((value) => (
                  <Chip
                    key={value}
                    active={activeSeason === value}
                    onClick={() => {
                      setSeason(value);
                      setSelected(null);
                    }}
                  >
                    {value === '0' ? 'Specials' : `S${value}`}
                  </Chip>
                ))}
              </span>
            )}
          </div>
          <div className="ls-episode-list">
            {episodes
              .filter((video) => String(video.season ?? 0) === activeSeason)
              .map((video) => {
                const thumb = safeURL(video.thumbnail || meta.background || meta.poster);
                const epTitle = video.title || video.name || `Episode ${video.episode || ''}`;
                const entry = {
                  ...video,
                  playbackTitle: `${title} · S${video.season || 1}:E${video.episode || 1}`
                };
                return (
                  <div key={video.id} className="ls-episode">
                    <button type="button" className="ls-episode-main" onClick={() => onEpisode(entry)}>
                      {thumb && (
                        <span className="ls-episode-thumb">
                          <img src={thumb} alt="" loading="lazy" />
                          <span className="ls-episode-num">S{video.season || 1}·E{video.episode || 1}</span>
                        </span>
                      )}
                      <span className="ls-episode-info">
                        <span className="ls-episode-title">{epTitle}</span>
                        {video.overview && <span className="ls-episode-overview">{video.overview}</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="ls-episode-play"
                      aria-label={`Play episode ${video.episode || ''} ${epTitle}`}
                      title="Play best stream"
                      onClick={() => onEpisode(entry, { play: true })}
                    >
                      <Play size={14} fill="currentColor" strokeWidth={0} />
                    </button>
                  </div>
                );
              })}
          </div>
          {cast.length > 0 && (
            <div className="ls-cast" style={{ marginTop: 'var(--ls-5)' }}>
              <span className="ls-cast-label">Cast</span>
              {cast.map((person) => (
                <span key={person} className="ls-cast-item">{person}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {sourcesBlock}
    </div>
  );
}

function EpisodePage({ episode, showTitle, addons, onPlayStream, onBack, onChooseStream, autoStart = false, initialPicker = false, addonsLoading = false }) {
  const backdrop = safeURL(episode.thumbnail || episode.background || episode.poster);
  const [showStreams, setShowStreams] = useState(initialPicker || autoStart);
  const [pickerRequest, setPickerRequest] = useState(initialPicker ? 1 : 0);
  const [autoPlay, setAutoPlay] = useState(autoStart);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <div className="ls-takeover">
      <section className="ls-takeover-hero" style={{ minHeight: '18rem' }}>
        {backdrop && <img className="ls-hero-art" src={backdrop} alt="" />}
        <div className="ls-hero-scrim" aria-hidden="true" />
        <div className="ls-takeover-body">
          <button type="button" className="ls-btn ls-btn--ghost ls-btn--sm" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
            <ChevronLeft size={15} /> {showTitle}
          </button>
          <h1 className="ls-hero-title" style={{ fontSize: 'clamp(1.5rem,3.4vw,2.25rem)' }}>
            {episode.title || episode.name || `Episode ${episode.episode || ''}`}
          </h1>
          <div className="ls-hero-facts">
            <span>S{episode.season || 1} · E{episode.episode || 1}</span>
            {episode.runtime && (
              <>
                <span className="sep">·</span>
                <span>{runtimeLabel(episode.runtime)}</span>
              </>
            )}
          </div>
          {episode.overview && <p className="ls-hero-synopsis">{episode.overview}</p>}
          <div className="ls-takeover-actions">
            <Button
              variant="primary"
              icon={<Play size={15} fill="currentColor" strokeWidth={0} />}
              label="Play"
              onClick={() => {
                setAutoPlay(true);
                setShowStreams(true);
                setPickerRequest((n) => n + 1);
              }}
            />
            <Button
              variant="secondary"
              label="Choose stream"
              onClick={() => {
                setShowStreams(true);
                setPickerRequest((n) => n + 1);
              }}
            />
          </div>
        </div>
      </section>

      {showStreams && (
        <div className="ls-takeover-section">
          <h2 className="ls-section-title">Streams</h2>
          <Sources
            addons={addons}
            meta={{ ...episode, type: episode.type || 'series' }}
            videoId={episode.id}
            autoStart={autoPlay}
            openPicker={pickerRequest}
            showActions={false}
            addonsLoading={addonsLoading}
            onPlay={(streamObj, selection) => onPlayStream(streamObj, episode, selection)}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------ app ------------------------------ */

export function App({ onThemeChange }) {
  const [user, setUser] = useState(null);
  const [addons, setAddons] = useState(null);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(location.hash.slice(1) || 'home');
  const [item, setItem] = useState(null);
  const [playbackIntent, setPlaybackIntent] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [expandedCatalog, setExpandedCatalog] = useState(null);
  const [activeStream, setActiveStream] = useState(null);
  const [playingMeta, setPlayingMeta] = useState(null);
  const [saved, setSaved] = useState([]);
  const [progress, setProgress] = useState({});
  const [featuredItems, setFeaturedItems] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [availabilityStore, setAvailabilityStore] = useState(() => readAvailabilityStore());

  const savedIds = useMemo(
    () => new Set(saved.map((entry) => (entry.type || 'movie') + ':' + entry.id)),
    [saved]
  );

  const openTitle = (target, intent = null) => {
    setPlaybackIntent(intent);
    setEpisode(null);
    setItem(target);
  };

  async function boot() {
    setError('');
    setAddonsLoading(true);
    try {
      const me = await api('/api/me');
      setUser(me);
      setSaved(readState(me.id, 'saved', []));
      setProgress(readState(me.id, 'progress', {}));
      const savedPrefs = { ...DEFAULT_PREFERENCES, ...readState(me.id, 'preferences', DEFAULT_PREFERENCES) };
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
      setEpisode(null);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleApplyPreferences = (next) => {
    setPreferences(next);
    applyPaletteToDOM(next);
    onThemeChange?.(next);
    try {
      localStorage.setItem('librestream:active_palette', next.palette);
      localStorage.setItem('librestream:active_accent', next.accent);
      localStorage.setItem('librestream:active_font', next.font || 'graphite');
      if (user?.id) writeState(user.id, 'preferences', next);
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
    setActiveStream(streamObj);
    setPlayingMeta(mediaMeta);
    setItem(null);
    setEpisode(null);
  };

  const handleFeaturedItems = (incoming) => {
    setFeaturedItems((old) => dedupe([...old, ...incoming]).slice(0, 8));
  };

  const prefetchRef = useRef({ controller: null, seen: new Set() });
  useEffect(() => {
    if (!addons?.length || !featuredItems.length) return;
    if (!prefetchRef.current.controller) prefetchRef.current.controller = new AbortController();
    const controller = prefetchRef.current.controller;
    const timer = setTimeout(() => {
      if (controller.signal.aborted) return;
      const targets = titlesNeedingAvailability(featuredItems.slice(0, 16), readAvailabilityStore(), 12).filter(
        (target) => !prefetchRef.current.seen.has(target.key)
      );
      if (!targets.length) return;
      targets.forEach((target) => prefetchRef.current.seen.add(target.key));
      prefetchAvailability(targets, {
        addons,
        signal: controller.signal,
        concurrency: 2,
        onResult: () => setAvailabilityStore(readAvailabilityStore())
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [addons, featuredItems]);

  useEffect(() => () => prefetchRef.current.controller?.abort(), []);

  const allCatalogs = (addons || []).flatMap((addon) =>
    (addon.catalogs || [])
      .filter((catalog) => !(catalog.extra || []).some((extra) => extra.isRequired))
      .map((catalog) => ({ addon, catalog }))
  );

  const catalogs = allCatalogs.filter(({ catalog }) => {
    if (collectionFilter === 'movies') return catalog.type === 'movie';
    if (collectionFilter === 'series') return catalog.type === 'series';
    return true;
  });

  const resume = Object.values(progress).filter((entry) => entry.position > 10 && entry.position < entry.duration - 30);
  const activePalette = PALETTES.find((palette) => palette.id === preferences.palette) || PALETTES[0];

  if (activeStream && playingMeta) {
    return (
      <Player
        meta={playingMeta}
        stream={activeStream}
        user={user}
        addons={addons || []}
        videoId={playingMeta.playbackId}
        onProgress={saveProgress}
        onBack={() => {
          setActiveStream(null);
          setAvailabilityStore(readAvailabilityStore());
        }}
        onSwitchSource={() => {
          const target = playingMeta;
          setActiveStream(null);
          openTitle({ ...target, id: target.playbackId ? target.id : target.id, type: target.type }, 'choose');
        }}
      />
    );
  }

  const nav = [
    ['home', 'Browse', NuvioHomeIcon],
    ['search', 'Search', NuvioSearchIcon],
    ['library', 'Saved', NuvioLibraryIcon],
    ['appearance', 'Appearance', NuvioPaletteIcon],
    ['settings', 'Settings', NuvioSettingsIcon]
  ];

  const shelfProps = {
    onOpen: openTitle,
    onPlay: (target) => openTitle(target, 'auto'),
    savedIds,
    progressMap: progress,
    availabilityStore
  };

  return (
    <div className="ls-app">
      <a className="skip-link" href="#content">Skip to content</a>

      <header className="ls-dock-top">
        <a className="ls-brand" href="#home" aria-label="LibreStream home">
          <span className="ls-brand-mark">L</span>
          <Brand wordmark />
        </a>
        <nav className="ls-nav" aria-label="Main">
          {nav
            .filter(([id]) => id !== 'appearance')
            .map(([id, label]) => (
              <a key={id} href={`#${id}`} className={route === id ? 'active' : ''} aria-current={route === id ? 'page' : undefined}>
                {label}
              </a>
            ))}
        </nav>
        <div className="ls-dock-actions">
          <button type="button" className="ls-dock-pill" onClick={() => setShowSettings(true)} title="Appearance">
            <span className="ls-dock-dot" style={{ background: activePalette.accentSecondary }} />
            {activePalette.name}
          </button>
          <a className="ls-avatar" href="#settings" title={user?.name || 'Profile'}>
            {(user?.name || 'L').slice(0, 1).toUpperCase()}
          </a>
        </div>
      </header>

      <main className="ls-main" id="content">
        {error ? (
          <div className="ls-page">
            <p className="ls-note" style={{ marginBottom: 'var(--ls-3)' }}>{error}</p>
            <Button variant="secondary" icon={<RotateCw size={15} />} label="Try again" onClick={boot} />
          </div>
        ) : !addons ? (
          <div className="ls-page">
            <Skeleton height={280} radius={18} />
            <div style={{ height: 24 }} />
            <div className="ls-row-scroll">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div key={index} style={{ flex: '0 0 var(--ls-rail)', width: 'var(--ls-rail)' }}>
                  <Skeleton height={228} radius={14} />
                </div>
              ))}
            </div>
          </div>
        ) : route === 'search' ? (
          <div className="ls-page">
            <h1 className="ls-page-title">Search</h1>
            <Search addons={addons} {...shelfProps} />
          </div>
        ) : route === 'library' ? (
          <div className="ls-page">
            <h1 className="ls-page-title">Saved</h1>
            {saved.length ? (
              <Shelf title="Watchlist" subtitle={`${saved.length} titles`} items={saved} grid {...shelfProps} />
            ) : (
              <p className="ls-note">Nothing saved yet. Open a title and choose Watchlist.</p>
            )}
          </div>
        ) : route === 'appearance' ? (
          <div className="ls-page">
            <h1 className="ls-page-title">Appearance</h1>
            <AppearanceContent currentPreferences={preferences} onApply={handleApplyPreferences} />
          </div>
        ) : route === 'settings' ? (
          <div className="ls-page">
            <h1 className="ls-page-title">Settings</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ls-6)' }}>
              <div className="ls-profile">
                <div className="ls-profile-avatar">{(user?.name || 'L').slice(0, 1).toUpperCase()}</div>
                <div>
                  <b>{user?.name || 'Signed in'}</b>
                  <span>Authentik identity. Watchlist, resume points and appearance are stored in this browser for your account.</span>
                </div>
              </div>

              <AppearanceContent currentPreferences={preferences} onApply={handleApplyPreferences} />

              <div>
                <div className="ls-shelf-head">
                  <h2 className="ls-shelf-title">Addons</h2>
                  <span className="ls-shelf-sub">{addons.length} configured</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RotateCw size={14} />}
                    label="Refresh"
                    onClick={async () => setAddons(await api('/api/addons'))}
                    style={{ marginInlineStart: 'auto' }}
                  />
                </div>
                <div className="ls-addons">
                  {addons.map((addon) => {
                    const names = (addon.resources || [])
                      .map((resourceItem) => (typeof resourceItem === 'string' ? resourceItem : resourceItem?.name))
                      .filter(Boolean);
                    return (
                      <div key={addon.index} className="ls-addon">
                        <div style={{ minWidth: 0 }}>
                          <b>{addon.name}</b>
                          <span>
                            {addon.catalogs?.length || 0} catalogs
                            {names.length ? ` · ${[...new Set(names)].join(', ')}` : ''}
                          </span>
                        </div>
                        <span className={`ls-status ${addon.ok ? 'is-ok' : 'is-off'}`}>
                          {addon.ok ? 'Connected' : 'Offline'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {featuredItems.length > 0 && (
              <HeroBanner
                items={featuredItems}
                onPlay={(target) => openTitle(target, 'auto')}
                onChooseStream={(target) => openTitle(target, 'choose')}
                onDetails={openTitle}
                saved={saved}
                onToggleSave={toggleSave}
              />
            )}

            <div className="ls-shelf" style={{ marginBottom: 'var(--ls-2)' }}>
              <div className="ls-row-scroll" style={{ gap: 'var(--ls-2)' }}>
                {[
                  ['all', 'All'],
                  ['movies', 'Movies'],
                  ['series', 'Series']
                ].map(([id, label]) => (
                  <Chip key={id} active={collectionFilter === id} onClick={() => setCollectionFilter(id)}>
                    {label}
                  </Chip>
                ))}
                <Chip
                  active={preferences.posterShape === 'landscape'}
                  onClick={() =>
                    handleApplyPreferences({
                      ...preferences,
                      posterShape: preferences.posterShape === 'landscape' ? 'poster' : 'landscape'
                    })
                  }
                >
                  Widescreen cards
                </Chip>
              </div>
            </div>

            {resume.length > 0 && <ContinueWatching items={resume} onOpen={openTitle} />}

            {catalogs.map(({ addon, catalog }, index) => (
              <Catalog
                key={addon.index + ':' + catalog.type + ':' + catalog.id}
                addon={addon}
                catalog={catalog}
                onViewAll={setExpandedCatalog}
                onFeaturedItems={index < 3 ? handleFeaturedItems : undefined}
                {...shelfProps}
              />
            ))}
          </>
        )}
      </main>

      <nav className="ls-dock-bottom" aria-label="Main">
        {nav
          .filter(([id]) => id !== 'appearance')
          .map(([id, label, Glyph]) => (
            <a key={id} href={`#${id}`} className={route === id ? 'active' : ''} aria-current={route === id ? 'page' : undefined}>
              <Glyph size={19} />
              <span>{label}</span>
            </a>
          ))}
      </nav>

      {expandedCatalog && (
        <Modal open wide onClose={() => setExpandedCatalog(null)} labelledBy="catalog-title">
          <ModalHeader title={expandedCatalog.title} id="catalog-title" onClose={() => setExpandedCatalog(null)} />
          <div className="ls-modal-body">
            <Shelf
              title={expandedCatalog.subtitle || 'All titles'}
              items={expandedCatalog.items}
              grid
              onOpen={(picked) => {
                setExpandedCatalog(null);
                openTitle(picked);
              }}
              {...shelfProps}
            />
          </div>
        </Modal>
      )}

      {item && !episode && (
        <Modal open bare wide onClose={() => setItem(null)} labelledBy="title-page">
          <div className="ls-modal-body" style={{ padding: 0 }}>
            <h2 id="title-page" className="ls-visually-hidden" style={{ position: 'absolute', left: -9999 }}>
              {item.name || item.id}
            </h2>
            <TitlePage
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
              onEpisode={(entry, options) => {
                setEpisode(entry);
                if (options?.play) setPlaybackIntent('auto');
              }}
            />
          </div>
        </Modal>
      )}

      {episode && (
        <Modal open bare wide onClose={() => setEpisode(null)} labelledBy="episode-page">
          <div className="ls-modal-body" style={{ padding: 0 }}>
            <h2 id="episode-page" style={{ position: 'absolute', left: -9999 }}>
              {episode.title || 'Episode'}
            </h2>
            <EpisodePage
              episode={episode}
              showTitle={item?.name || item?.title || 'Back'}
              addons={addons}
              addonsLoading={addonsLoading}
              autoStart={playbackIntent === 'auto'}
              initialPicker={playbackIntent === 'choose'}
              onBack={() => setEpisode(null)}
              onPlayStream={startPlayback}
            />
          </div>
        </Modal>
      )}

      {showSettings && (
        <AppearanceSettings
          isOpen={showSettings}
          currentPreferences={preferences}
          onApply={handleApplyPreferences}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
