import React, { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack } from '@astryxdesign/core/HStack';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Info, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { NuvioPlayIcon, ImdbBadge } from './Icons.jsx';
import { safeURL } from './api';

export function HeroBanner({
  items = [],
  item,
  layout = 'premiere',
  onPlay,
  onDetails,
  saved = [],
  isSaved: isSavedProp,
  onToggleSave
}) {
  const slides = items.length > 0 ? items.slice(0, 8) : item ? [item] : [];
  const [index, setIndex] = useState(0);
  const [logoBroken, setLogoBroken] = useState({});

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  if (!slides.length) return null;

  const active = slides[index] || slides[0];
  const backdrop = safeURL(active.background || active.banner || active.poster);
  const poster = safeURL(active.poster || active.background);
  const logo = !logoBroken[active.id] ? safeURL(active.logo) : '';
  const title = active.name || active.title || active.id;
  const rating = active.imdbRating || active.rating;
  const year = active.year || active.releaseInfo;
  const runtime = active.runtime;
  const typeLabel = active.type === 'series' ? 'Series' : 'Movie';
  const ageRating = active.certification || active.ageRating;
  const genres = Array.isArray(active.genres) ? active.genres.slice(0, 3) : [];
  const description =
    active.description ||
    active.synopsis ||
    '';
  const isSaved =
    typeof isSavedProp === 'boolean'
      ? isSavedProp
      : saved.some((s) => s.id === active.id && s.type === active.type);

  const prevSlide = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const nextSlide = () => setIndex((i) => (i + 1) % slides.length);

  return (
    <section
      className={`ls-hero-stage hero-${layout}`}
      aria-label="Featured spotlight"
    >
      {/* Ambient blurred backdrop layer + sharp focal artwork */}
      {backdrop && (
        <>
          <div
            className="hero-backdrop-ambient"
            style={{ backgroundImage: `url(${backdrop})` }}
            aria-hidden="true"
          />
          <div
            className="hero-backdrop-sharp"
            style={{ backgroundImage: `url(${backdrop})` }}
            aria-hidden="true"
          />
        </>
      )}
      <div className="hero-scrim-vignette" aria-hidden="true" />
      <div className="hero-scrim-bottom" aria-hidden="true" />

      <div className="hero-inner">
        <div className="hero-content">
          <VStack gap={3} className="hero-details">
            {/* Nuvio-style metadata pill row */}
            <div className="hero-meta-top">
              <span className="hero-pill-accent">{typeLabel}</span>
              {genres.map((g) => (
                <span key={g} className="hero-pill-subtle">
                  {g}
                </span>
              ))}
              {ageRating && <span className="hero-pill-outline">{ageRating}</span>}
            </div>

            {/* Clearlogo or Display Title */}
            {logo ? (
              <div
                className="hero-logo-wrap"
                onClick={() => onDetails(active)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onDetails(active)}
              >
                <img
                  src={logo}
                  alt={title}
                  className="hero-clearlogo"
                  onError={() => setLogoBroken((old) => ({ ...old, [active.id]: true }))}
                />
              </div>
            ) : (
              <Heading level={1} className="hero-title">
                {title}
              </Heading>
            )}

            {/* Nuvio HomeHeroMetaRows: IMDb yellow badge + dot-separated facts */}
            <div className="hero-meta-facts">
              {rating && <ImdbBadge rating={rating} />}
              {year && <span className="hero-fact-item">{String(year)}</span>}
              {runtime && (
                <>
                  <span className="hero-fact-dot" aria-hidden="true" />
                  <span className="hero-fact-item">{runtime}</span>
                </>
              )}
            </div>

            {description && (
              <Text className="hero-synopsis" maxLines={2}>
                {description}
              </Text>
            )}

            {/* Primary CTA bar */}
            <HStack gap={3} vAlign="center" wrap="wrap" className="hero-actions">
              <Button
                variant="primary"
                label="Choose stream"
                icon={<NuvioPlayIcon size={16} />}
                onClick={() => onPlay(active)}
              />
              <Button
                variant="secondary"
                label="Details"
                icon={<Icon icon={Info} />}
                onClick={() => onDetails(active)}
              />
              {onToggleSave && (
                <Button
                  variant="ghost"
                  label={isSaved ? 'In Watchlist' : 'Watchlist'}
                  icon={<Icon icon={isSaved ? BookmarkCheck : Bookmark} />}
                  onClick={() => onToggleSave(active)}
                />
              )}
            </HStack>
          </VStack>

          {/* Desktop floating poster preview card */}
          {poster && (
            <div
              className="hero-SidePoster"
              onClick={() => onDetails(active)}
              role="presentation"
            >
              <img src={poster} alt="" className="hero-side-poster-img" />
            </div>
          )}
        </div>

        {/* Multi-slide Hero Pager Controls (Nuvio HomeHeroSection pill indicator) */}
        {slides.length > 1 && (
          <div className="hero-pager-bar">
            <div className="hero-dots" role="group" aria-label="Featured slides">
              {slides.map((s, idx) => {
                const isCurrent = idx === index;
                return (
                  <button
                    key={(s.type || 'm') + ':' + s.id}
                    type="button"
                    aria-pressed={isCurrent}
                    aria-label={`Featured: ${s.name || s.title || idx + 1}`}
                    className={`hero-dot ${isCurrent ? 'active' : ''}`}
                    onClick={() => setIndex(idx)}
                  />
                );
              })}
            </div>
            <div className="hero-pager-arrows">
              <button
                type="button"
                className="hero-arrow-btn"
                aria-label="Previous featured title"
                onClick={prevSlide}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="hero-arrow-btn"
                aria-label="Next featured title"
                onClick={nextSlide}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
