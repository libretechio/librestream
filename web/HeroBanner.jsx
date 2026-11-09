import React, { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Button, IconButton } from './ui.jsx';
import { ImdbBadge } from './Icons.jsx';
import { safeURL } from './api';
import { runtimeLabel } from './badges.js';

export function HeroBanner({ items = [], onPlay, onChooseStream, onDetails, saved = [], onToggleSave }) {
  const slides = items.slice(0, 8);
  const [index, setIndex] = useState(0);
  const [logoBroken, setLogoBroken] = useState({});

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  if (!slides.length) return null;

  const active = slides[index];
  const backdrop = safeURL(active.background || active.banner || active.poster);
  const logo = !logoBroken[active.id] ? safeURL(active.logo) : '';
  const title = active.name || active.title || active.id;
  const rating = active.imdbRating || active.rating;
  const runtime = runtimeLabel(active.runtime);
  const cert = active.certification || active.ageRating || '';
  const genres = (active.genres || active.genre || []).slice(0, 3);
  const isSaved = saved.some((entry) => entry.id === active.id && entry.type === active.type);
  const year = active.year || active.releaseInfo;

  return (
    <section className="ls-hero" aria-label="Featured">
      {backdrop && <img className="ls-hero-art" src={backdrop} alt="" />}
      <div className="ls-hero-scrim" aria-hidden="true" />

      <div className="ls-hero-body">
        <div className="ls-hero-eyebrow">Featured</div>

        {logo ? (
          <button
            type="button"
            onClick={() => onDetails(active)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            <img
              className="ls-hero-logo"
              src={logo}
              alt={title}
              onError={() => setLogoBroken((old) => ({ ...old, [active.id]: true }))}
            />
          </button>
        ) : (
          <h1 className="ls-hero-title">{title}</h1>
        )}

        <div className="ls-hero-facts">
          {rating && <ImdbBadge rating={rating} size="sm" />}
          {year && <span>{String(year)}</span>}
          {runtime && (
            <>
              <span className="sep">·</span>
              <span>{runtime}</span>
            </>
          )}
          {cert && (
            <>
              <span className="sep">·</span>
              <span className="is-cert">{cert}</span>
            </>
          )}
          {genres.length > 0 && (
            <>
              <span className="sep">·</span>
              <span>{genres.join(', ')}</span>
            </>
          )}
        </div>

        {(active.description || active.synopsis) && (
          <p className="ls-hero-synopsis">{active.description || active.synopsis}</p>
        )}

        <div className="ls-hero-actions">
          <Button
            variant="primary"
            icon={<Play size={15} fill="currentColor" strokeWidth={0} />}
            label="Play"
            onClick={() => onPlay(active)}
          />
          <Button variant="secondary" label="Choose stream" onClick={() => onChooseStream(active)} />
          <Button
            variant="secondary"
            icon={isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            label={isSaved ? 'Saved' : 'Watchlist'}
            aria-pressed={isSaved}
            onClick={() => onToggleSave(active)}
          />
        </div>

        {slides.length > 1 && (
          <div className="ls-hero-pager">
            <div className="ls-hero-dots" role="group" aria-label="Featured titles">
              {slides.map((slide, slideIndex) => (
                <button
                  key={(slide.type || 'm') + ':' + slide.id}
                  type="button"
                  aria-pressed={slideIndex === index}
                  aria-label={`Featured: ${slide.name || slide.id}`}
                  onClick={() => setIndex(slideIndex)}
                />
              ))}
            </div>
            <div className="ls-hero-arrows">
              <IconButton
                icon={<ChevronLeft size={16} />}
                label="Previous featured title"
                onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)}
              />
              <IconButton
                icon={<ChevronRight size={16} />}
                label="Next featured title"
                onClick={() => setIndex((current) => (current + 1) % slides.length)}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
