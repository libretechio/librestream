import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import {
  House,
  Search as SearchIcon,
  Bookmark,
  BookmarkCheck,
  Settings as SettingsIcon,
  Play,
  Clapperboard,
  RotateCw,
  ArrowLeft,
  Palette,
  Film,
  Sparkles,
  Layers,
  Info
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
import { AppearanceSettings } from './AppearanceSettings.jsx';
import { DEFAULT_PREFERENCES } from './palettes.js';
import {
  api,
  resource,
  supports,
  dedupe,
  safeURL,
  readState,
  writeState,
  sourceLabel
} from './api';

function Message({ children }) {
  return (
    <Text as="p" role="status" color="secondary">
      {children}
    </Text>
  );
}

function PosterCard({ item, onOpen }) {
  const [broken, setBroken] = useState(false);
  const rating = item.imdbRating || item.rating;
  const age = item.certification || item.ageRating || (item.type === 'movie' ? 'PG-13' : '16+');
  const title = item.name || item.title || item.id;
  const year = item.year || item.releaseInfo;

  return (
    <button
      type="button"
      className="poster-card"
      onClick={() => onOpen(item)}
      aria-label={title}
      data-media-id={item.id}
    >
      <div className="poster-media-box">
        {!broken && safeURL(item.poster) ? (
          <img
            className="poster-image"
            src={safeURL(item.poster)}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="poster-placeholder">
            <Icon icon={Clapperboard} size="lg" color="secondary" />
          </div>
        )}

        {/* Badges */}
        {age && <span className="poster-badge-top-right">{age}</span>}
        {rating && (
          <span className="poster-badge-bottom">
            <span>★</span> {rating}
          </span>
        )}
      </div>

      <div className="poster-info">
        <span className="poster-title">{title}</span>
        {year && <span className="poster-sub">{String(year)}</span>}
      </div>
    </button>
  );
}

function Shelf({ title, items, onOpen, grid = false }) {
  if (!items || !items.length) return null;
  return (
    <VStack as="section" gap={3} className="shelf">
      <div className="shelf-header">
        <Heading level={2}>{title}</Heading>
      </div>
      <div className={grid ? 'poster-grid' : 'poster-row'}>
        {items.map((item) => (
          <PosterCard
            key={(item.type || 'media') + ':' + item.id}
            item={item}
            onOpen={onOpen}
          />
        ))}
      </div>
    </VStack>
  );
}

function ContinueWatchingShelf({ items, onOpen }) {
  if (!items || !items.length) return null;
  return (
    <VStack as="section" gap={3} className="shelf continue-shelf">
      <div className="shelf-header">
        <Heading level={2}>Continue watching</Heading>
      </div>
      <div className="poster-row">
        {items.map((item) => {
          const pct = Math.min(100, Math.max(0, (item.position / (item.duration || 1)) * 100));
          const backdrop = safeURL(item.background || item.poster);
          return (
            <div
              key={(item.type || 'media') + ':' + item.id}
              className="continue-card"
              onClick={() => onOpen(item)}
              role="button"
              tabIndex={0}
            >
              <div
                className="continue-media-box"
                style={{
                  backgroundImage: backdrop ? `url(${backdrop})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="continue-progress-track">
                  <div className="continue-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div style={{ padding: '0.6rem 0.8rem' }}>
                <span className="poster-title">{item.name || item.id}</span>
                <span className="poster-sub">
                  {item.playbackTitle || (item.releaseInfo ? `${item.releaseInfo} · ` : '')}
                  {Math.round(pct)}% watched
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </VStack>
  );
}

function Catalog({ addon, catalog, onOpen, onFeaturedFound }) {
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
      { rootMargin: '300px' }
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
        const metas = dedupe((d.metas || []).map((m) => ({ ...m, type: m.type || catalog.type }))).slice(0, 24);
        setData(metas);
        if (metas.length > 0 && onFeaturedFound) {
          onFeaturedFound(metas[0]);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [visible, attempt, addon, catalog]);

  const label = `${catalog.name || catalog.id} · ${
    catalog.type === 'movie' ? 'Movies' : catalog.type === 'series' ? 'Series' : catalog.type
  }`;

  return (
    <div ref={ref} className="catalog-slot">
      {data ? (
        <Shelf title={label} items={data} onOpen={onOpen} />
      ) : (
        <VStack gap={3} as="section" className="shelf" aria-busy={visible && !error}>
          <Heading level={2}>{label}</Heading>
          <Message>{error ? 'Catalog unavailable.' : 'Loading titles…'}</Message>
          {error && (
            <Button
              icon={<Icon icon={RotateCw} />}
              label="Try again"
              onClick={() => setAttempt((a) => a + 1)}
            />
          )}
        </VStack>
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

  useEffect(() => () => {
    current.current++;
  }, []);

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
          results = dedupe([...results, ...(data.metas || []).map((m) => ({ ...m, type: m.type || c.type }))]);
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
    <VStack gap={6} style={{ padding: '0 var(--spacing-6)' }}>
      <HStack as="form" className="search-form" gap={3} vAlign="end" onSubmit={run}>
        <TextInput
          startIcon={SearchIcon}
          containerClassName="search-field"
          label="Movie or series title"
          type="search"
          value={query}
          onChange={setQuery}
          hasClear
          enterKeyHint="search"
          placeholder="Search movies, series, titles…"
          autoComplete="off"
        />
        <Button
          icon={<Icon icon={SearchIcon} />}
          type="submit"
          label="Search"
          variant="primary"
          isLoading={busy}
          isDisabled={!query.trim()}
        />
      </HStack>
      <VStack gap={4} aria-live="polite" aria-busy={busy}>
        {failed && <Message>Some sources could not be reached.</Message>}
        {busy && <Message>Searching your sources…</Message>}
        {items?.length ? (
          <Shelf title="Search results" items={items} grid onOpen={onOpen} />
        ) : items ? (
          <Message>No matches found. Try a different title.</Message>
        ) : null}
      </VStack>
    </VStack>
  );
}

function TitleDialog({ item, addons, saved, onSave, onPlayStream, onClose }) {
  const [meta, setMeta] = useState(item);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState('');
  const [selected, setSelected] = useState(null);

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
        if (active) setMeta({ ...item, ...data });
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
      <VStack className="dialog-scroll" gap={4}>
        <VStack gap={3} className="title-body">
          <Text type="supporting">
            {[meta.releaseInfo || meta.year, meta.imdbRating ? `★ IMDb ${meta.imdbRating}` : null, ...(meta.genres || [])]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text as="p">{meta.description || meta.synopsis || 'No description available.'}</Text>
          <HStack gap={3} wrap="wrap">
            <Button
              icon={<Icon icon={isSaved ? BookmarkCheck : Bookmark} />}
              label={isSaved ? 'Remove from saved' : 'Save'}
              onClick={() => onSave(meta)}
              aria-pressed={isSaved}
            />
            {movie && (
              <Button
                icon={<Icon icon={Play} />}
                label="Find streams"
                variant="primary"
                onClick={() => setSelected({ id: meta.id })}
              />
            )}
          </HStack>
          {loading && <Message>Loading details…</Message>}
          {!movie && (
            <>
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
              <VStack gap={2} className="episodes">
                {episodes
                  .filter((v) => String(v.season ?? 0) === activeSeason)
                  .map((v) => (
                    <Button
                      icon={<Icon icon={Play} />}
                      key={v.id}
                      label={`Episode ${v.episode || ''} · ${v.title || v.name || 'Play episode'}`}
                      onClick={() =>
                        setSelected({
                          ...v,
                          playbackTitle: `${meta.name || meta.title} · S${v.season || 1}:E${v.episode || 1}`
                        })
                      }
                    />
                  ))}
              </VStack>
            </>
          )}

          {selected && (
            <Sources
              addons={addons}
              meta={meta}
              videoId={selected.id}
              onPlay={(streamObj) => onPlayStream(streamObj, { ...meta, playbackId: selected.id, playbackTitle: selected.playbackTitle })}
            />
          )}
        </VStack>
      </VStack>
    </Dialog>
  );
}

export function App() {
  const [user, setUser] = useState(null);
  const [addons, setAddons] = useState(null);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(location.hash.slice(1) || 'home');
  const [item, setItem] = useState(null);
  const [activeStream, setActiveStream] = useState(null);
  const [playingMeta, setPlayingMeta] = useState(null);
  const [saved, setSaved] = useState([]);
  const [progress, setProgress] = useState({});
  const [featuredItem, setFeaturedItem] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [collectionFilter, setCollectionFilter] = useState('all');

  async function boot() {
    setError('');
    try {
      const me = await api('/api/me');
      setUser(me);
      setSaved(readState(me.id, 'saved', []));
      setProgress(readState(me.id, 'progress', {}));

      // Load user preferences
      const savedPrefs = readState(me.id, 'preferences', DEFAULT_PREFERENCES);
      setPreferences(savedPrefs);
      document.documentElement.setAttribute('data-palette', savedPrefs.palette || 'libre-sand');
      document.documentElement.style.setProperty('--ls-accent', savedPrefs.accent || '#edc894');

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
    document.documentElement.setAttribute('data-palette', newPrefs.palette);
    document.documentElement.style.setProperty('--ls-accent', newPrefs.accent);
    if (user?.id) {
      writeState(user.id, 'preferences', newPrefs);
      localStorage.setItem('librestream:active_palette', newPrefs.palette);
      localStorage.setItem('librestream:active_accent', newPrefs.accent);
    }
  };

  const toggleSave = (meta) => {
    setSaved((old) => {
      const exists = old.some((x) => x.id === meta.id && x.type === meta.type);
      const next = exists
        ? old.filter((x) => x.id !== meta.id || x.type !== meta.type)
        : [...old, meta];
      writeState(user.id, 'saved', next);
      return next;
    });
  };

  const saveProgress = (entry) => {
    setProgress((old) => {
      const next = { ...old, [entry.type + ':' + entry.id]: entry };
      writeState(user.id, 'progress', next);
      return next;
    });
  };

  const startPlayback = (streamObj, mediaMeta) => {
    setActiveStream(streamObj);
    setPlayingMeta(mediaMeta);
    setItem(null); // close dialog to enter full player
  };

  const catalogs = (addons || [])
    .flatMap((a) =>
      (a.catalogs || [])
        .filter((c) => !(c.extra || []).some((e) => e.isRequired))
        .map((c) => ({ a, c }))
    );

  const resume = Object.values(progress).filter(
    (x) => x.position > 10 && x.position < x.duration - 30
  );

  // If player is active, render full-screen video player view
  if (activeStream && playingMeta) {
    return (
      <Player
        meta={playingMeta}
        stream={activeStream}
        user={user}
        playerStyle={preferences.player}
        onProgress={saveProgress}
        onBack={() => setActiveStream(null)}
        onSwitchSource={() => {
          setActiveStream(null);
          setItem(playingMeta);
        }}
      />
    );
  }

  const titles = {
    home: 'Browse',
    search: 'Search',
    library: 'Saved Watchlist',
    settings: 'Settings & Appearance'
  };

  return (
    <AppShell
      height="auto"
      mobileNav={false}
      variant="wash"
      contentPadding={0}
      topNav={
        <VStack gap={0}>
          <HStack as="header" className="app-header" hAlign="between" vAlign="center">
            <Button href="#home" label="LibreStream" variant="ghost">
              <Brand />
            </Button>
            <HStack gap={3} vAlign="center">
              <Button
                variant="ghost"
                icon={<Icon icon={Palette} />}
                label="Appearance"
                onClick={() => setShowSettingsModal(true)}
              />
              <Text type="supporting" maxLines={1}>
                {user?.name || 'LibreStream'}
              </Text>
            </HStack>
          </HStack>

          <HStack as="nav" className="app-nav" aria-label="Main navigation" gap={2}>
            {[
              ['home', 'Browse', House],
              ['search', 'Search', SearchIcon],
              ['library', 'Saved', Bookmark],
              ['settings', 'Settings', SettingsIcon]
            ].map(([id, label, glyph]) => (
              <Button
                key={id}
                href={'#' + id}
                label={label}
                variant={route === id ? 'secondary' : 'ghost'}
                aria-current={route === id ? 'page' : undefined}
              >
                <VStack className="nav-content" gap={1} hAlign="center">
                  <Icon icon={glyph} size="md" />
                  <Text type="supporting" color="inherit" textWrap="nowrap">
                    {label}
                  </Text>
                </VStack>
              </Button>
            ))}
          </HStack>
        </VStack>
      }
    >
      <div className="app-main">
        {error ? (
          <VStack gap={4} style={{ padding: 'var(--spacing-8)' }}>
            <Message>{error}</Message>
            <Button icon={<Icon icon={RotateCw} />} label="Try again" onClick={boot} />
          </VStack>
        ) : !addons ? (
          <VStack gap={3} style={{ padding: 'var(--spacing-8)' }}>
            <Message>Loading your streaming catalogs…</Message>
          </VStack>
        ) : route === 'search' ? (
          <Layout
            height="auto"
            padding={6}
            header={<LayoutHeader hasDivider={false}><Heading level={1}>Search Catalogs</Heading></LayoutHeader>}
            content={<LayoutContent><Search addons={addons} onOpen={setItem} /></LayoutContent>}
          />
        ) : route === 'library' ? (
          <Layout
            height="auto"
            padding={6}
            header={<LayoutHeader hasDivider={false}><Heading level={1}>Your Watchlist</Heading></LayoutHeader>}
            content={
              <LayoutContent>
                {saved.length ? (
                  <Shelf title="Saved titles" items={saved} grid onOpen={setItem} />
                ) : (
                  <VStack gap={3} style={{ padding: '0 var(--spacing-6)' }}>
                    <Message>Nothing saved yet. Open any movie or series and tap Save to add it to your watchlist.</Message>
                  </VStack>
                )}
              </LayoutContent>
            }
          />
        ) : route === 'settings' ? (
          <Layout
            height="auto"
            padding={6}
            header={<LayoutHeader hasDivider={false}><Heading level={1}>Settings & Configuration</Heading></LayoutHeader>}
            content={
              <LayoutContent>
                <VStack gap={5} style={{ padding: '0 var(--spacing-6)', maxWidth: '48rem' }}>
                  <Text>
                    Signed in as <strong>{user?.name || 'User'}</strong> through Authentik forward-auth. Your watchlist, appearance theme, and playback resume points are securely scoped to your identity.
                  </Text>

                  <HStack gap={3} vAlign="center" className="appearance-trigger-box">
                    <Button
                      variant="primary"
                      icon={<Icon icon={Palette} />}
                      label="Customize Appearance & Themes"
                      onClick={() => setShowSettingsModal(true)}
                    />
                  </HStack>

                  <Heading level={2}>Connected Addon Sources ({addons.length})</Heading>
                  <VStack gap={2}>
                    {addons.map((a) => (
                      <HStack
                        key={a.index}
                        gap={3}
                        hAlign="between"
                        vAlign="center"
                        style={{
                          padding: '0.6rem 0.9rem',
                          background: 'var(--color-background-surface)',
                          borderRadius: '8px'
                        }}
                      >
                        <VStack gap={0}>
                          <Text weight={600}>{a.name}</Text>
                          <Text type="supporting" color="secondary">
                            {a.catalogs?.length || 0} catalogs · {a.resources?.join(', ')}
                          </Text>
                        </VStack>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: a.ok ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: a.ok ? '#22c55e' : '#ef4444'
                          }}
                        >
                          {a.ok ? 'Active' : 'Offline'}
                        </span>
                      </HStack>
                    ))}
                  </VStack>

                  <Button
                    icon={<Icon icon={RotateCw} />}
                    label="Refresh addon connections"
                    onClick={async () => setAddons(await api('/api/addons'))}
                  />
                </VStack>
              </LayoutContent>
            }
          />
        ) : (
          /* Browse / Home Route */
          <VStack gap={0} width="100%">
            {/* Hero Stage Banner */}
            {featuredItem && (
              <HeroBanner
                item={featuredItem}
                layout={preferences.layout}
                onPlay={(item) => setItem(item)}
                onDetails={(item) => setItem(item)}
                isSaved={saved.some((s) => s.id === featuredItem.id)}
                onToggleSave={toggleSave}
              />
            )}

            {/* Collection layout filter pills */}
            {preferences.layout === 'collection' && (
              <div className="filter-pills-row">
                {[
                  ['all', 'All titles'],
                  ['movies', 'Movies'],
                  ['series', 'Series'],
                  ['4k', '4K Ultra HD'],
                  ['cached', 'TorBox Cached']
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
              </div>
            )}

            {/* Continue Watching Section */}
            {resume.length > 0 && <ContinueWatchingShelf items={resume} onOpen={setItem} />}

            {/* Catalogue Shelves */}
            {catalogs.map(({ a, c }, idx) => (
              <Catalog
                key={a.index + ':' + c.type + ':' + c.id}
                addon={a}
                catalog={c}
                onOpen={setItem}
                onFeaturedFound={idx === 0 && !featuredItem ? setFeaturedItem : undefined}
              />
            ))}
          </VStack>
        )}
      </div>

      {/* Title Details / Stream Picker Dialog */}
      {item && (
        <TitleDialog
          key={(item.type || 'media') + ':' + item.id}
          item={item}
          addons={addons}
          saved={saved}
          onSave={toggleSave}
          onPlayStream={startPlayback}
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
