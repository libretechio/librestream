import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack } from '@astryxdesign/core/HStack';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Play, Info, Bookmark, BookmarkCheck } from 'lucide-react';
import { safeURL } from './api';

export function HeroBanner({
  item,
  layout = 'premiere',
  onPlay,
  onDetails,
  isSaved,
  onToggleSave
}) {
  if (!item) return null;

  const backdrop = safeURL(item.background || item.poster);
  const title = item.name || item.id;
  const rating = item.imdbRating || item.rating;
  const year = item.year || item.releaseInfo;
  const ageRating = item.certification || item.ageRating || (item.type === 'movie' ? 'PG-13' : 'TV-MA');
  const description = item.description || item.synopsis || 'Explore streaming sources from your configured addons.';

  return (
    <div className={`ls-hero-stage hero-${layout}`} style={{ backgroundImage: backdrop ? `url(${backdrop})` : 'none' }}>
      <div className="hero-gradient-left" />
      <div className="hero-gradient-bottom" />

      <div className="hero-content">
        <VStack gap={3} className="hero-details">
          <HStack gap={2} vAlign="center" className="hero-tag-row">
            <span className="hero-tag featured">Featured</span>
            {item.genres?.slice(0, 2).map((g) => (
              <span key={g} className="hero-tag genre">{g}</span>
            ))}
          </HStack>

          <Heading level={1} className="hero-title">{title}</Heading>

          <HStack gap={3} vAlign="center" className="hero-metadata">
            {rating && (
              <span className="rating-pill">
                <span className="rating-star">★</span> IMDb {rating}
              </span>
            )}
            {ageRating && <span className="age-pill">{ageRating}</span>}
            {year && <span className="year-text">{year}</span>}
            {item.runtime && <span className="runtime-text">{item.runtime}</span>}
          </HStack>

          <Text className="hero-synopsis" maxLines={3}>
            {description}
          </Text>

          <HStack gap={3} vAlign="center" className="hero-actions">
            <Button
              variant="primary"
              label="Choose source"
              icon={<Icon icon={Play} />}
              onClick={() => onPlay(item)}
            />
            <Button
              variant="secondary"
              label="Details"
              icon={<Icon icon={Info} />}
              onClick={() => onDetails(item)}
            />
            {onToggleSave && (
              <Button
                variant="ghost"
                label={isSaved ? 'Saved' : 'Save'}
                icon={<Icon icon={isSaved ? BookmarkCheck : Bookmark} />}
                onClick={() => onToggleSave(item)}
              />
            )}
          </HStack>
        </VStack>
      </div>
    </div>
  );
}
