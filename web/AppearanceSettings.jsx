import React from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Check, RotateCcw, Type, Layout as LayoutIcon, PlaySquare, Sparkles } from 'lucide-react';
import { NuvioPaletteIcon } from './Icons.jsx';
import {
  PALETTES,
  FONT_PRESETS,
  HOMEPAGE_LAYOUTS,
  POSTER_SHAPES,
  PLAYER_STYLES,
  DEFAULT_PREFERENCES,
  applyPaletteToDOM
} from './palettes.js';

export function AppearanceContent({ currentPreferences, onApply }) {
  const prefs = { ...DEFAULT_PREFERENCES, ...currentPreferences };
  const selectedPalette = PALETTES.find((p) => p.id === prefs.palette) || PALETTES[0];

  const update = (patch) => {
    const next = { ...prefs, ...patch };
    applyPaletteToDOM(next);
    onApply(next);
  };

  const handleSelectPalette = (pal) => {
    update({
      palette: pal.id,
      accent: pal.accent,
      font: pal.defaultFont || prefs.font
    });
  };

  const handleReset = () => {
    applyPaletteToDOM(DEFAULT_PREFERENCES);
    onApply(DEFAULT_PREFERENCES);
  };

  return (
    <VStack gap={5} className="appearance-content">
      {/* Live Active Theme Preview Banner */}
      <div className="theme-live-banner">
        <div className="theme-live-info">
          <span className="theme-live-eyebrow">Active Theme · Changes apply instantly</span>
          <strong className="theme-live-title">
            {selectedPalette.name} · {FONT_PRESETS.find((f) => f.id === prefs.font)?.name || 'Nuvio Sans'}
          </strong>
          <span className="theme-live-sub">{selectedPalette.description}</span>
        </div>
        <div className="theme-live-swatches">
          {selectedPalette.swatches.map((c, i) => (
            <span key={i} className="theme-live-dot" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      {/* Colour Palette Picker */}
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center">
            <NuvioPaletteIcon size={18} />
            <Heading level={4}>Theme & Colour Palette</Heading>
          </HStack>
          <Badge variant="neutral" label={`${PALETTES.length} themes`} />
        </HStack>
        <div className="palette-picker-grid">
          {PALETTES.map((pal) => {
            const isSelected = prefs.palette === pal.id;
            return (
              <button
                type="button"
                key={pal.id}
                className={`choice-card palette-card ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectPalette(pal)}
                aria-pressed={isSelected}
              >
                <div className="choice-card-top">
                  <span className="card-category-pill">{pal.category}</span>
                  {isSelected && <Check size={16} className="check-icon" />}
                </div>
                <span className="choice-title">{pal.name}</span>
                <div className="swatch-strip">
                  {pal.swatches.map((color, idx) => (
                    <span
                      key={idx}
                      className="swatch-block"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="choice-desc">{pal.description}</span>
              </button>
            );
          })}
        </div>
      </VStack>

      {/* Accent Colour Swatches */}
      {selectedPalette.accents && (
        <VStack gap={2}>
          <Heading level={4}>Accent Highlight</Heading>
          <HStack gap={3} vAlign="center" wrap="wrap">
            {selectedPalette.accents.map((acc) => {
              const isSelected = prefs.accent?.toLowerCase() === acc.color.toLowerCase();
              return (
                <button
                  type="button"
                  key={acc.id}
                  className={`accent-pill-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => update({ accent: acc.color })}
                  aria-pressed={isSelected}
                >
                  <span className="accent-swatch-dot" style={{ backgroundColor: acc.color }} />
                  <span>{acc.name}</span>
                  {isSelected && <Check size={14} />}
                </button>
              );
            })}
          </HStack>
        </VStack>
      )}

      {/* Typography Pairing */}
      <VStack gap={2}>
        <HStack gap={2} vAlign="center">
          <Icon icon={Type} size="sm" />
          <Heading level={4}>Typography Pairing</Heading>
        </HStack>
        <div className="layout-picker-grid">
          {FONT_PRESETS.map((fp) => {
            const isSelected = prefs.font === fp.id;
            return (
              <button
                type="button"
                key={fp.id}
                className={`choice-card ${isSelected ? 'active' : ''}`}
                onClick={() => update({ font: fp.id })}
                aria-pressed={isSelected}
              >
                <div className="choice-card-top">
                  <span className="card-category-pill">{fp.badge}</span>
                  {isSelected && <Check size={16} className="check-icon" />}
                </div>
                <span className="choice-title" style={{ fontFamily: fp.heading }}>
                  {fp.name}
                </span>
                <span className="choice-desc" style={{ fontFamily: fp.body }}>
                  {fp.description}
                </span>
              </button>
            );
          })}
        </div>
      </VStack>

      {/* Catalog Poster Shape (Nuvio Portrait 2:3 vs Widescreen 16:9) */}
      <VStack gap={2}>
        <HStack gap={2} vAlign="center">
          <Icon icon={Sparkles} size="sm" />
          <Heading level={4}>Catalog Card Shape</Heading>
        </HStack>
        <SegmentedControl
          label="Catalog card shape"
          value={prefs.posterShape || 'poster'}
          onChange={(val) => update({ posterShape: val })}
        >
          {POSTER_SHAPES.map((ps) => (
            <SegmentedControlItem key={ps.id} value={ps.id} label={ps.name} />
          ))}
        </SegmentedControl>
      </VStack>

      {/* Homepage Layout Picker */}
      <VStack gap={2}>
        <HStack gap={2} vAlign="center">
          <Icon icon={LayoutIcon} size="sm" />
          <Heading level={4}>Homepage Layout</Heading>
        </HStack>
        <div className="layout-picker-grid">
          {HOMEPAGE_LAYOUTS.map((l) => {
            const isSelected = prefs.layout === l.id;
            return (
              <button
                type="button"
                key={l.id}
                className={`choice-card ${isSelected ? 'active' : ''}`}
                onClick={() => update({ layout: l.id })}
                aria-pressed={isSelected}
              >
                <div className="choice-card-top">
                  <span className="card-category-pill">{l.badge}</span>
                  {isSelected && <Check size={16} className="check-icon" />}
                </div>
                <span className="choice-title">{l.name}</span>
                <span className="choice-desc">{l.description}</span>
              </button>
            );
          })}
        </div>
      </VStack>

      {/* Player Controls Picker */}
      <VStack gap={2}>
        <HStack gap={2} vAlign="center">
          <Icon icon={PlaySquare} size="sm" />
          <Heading level={4}>Video Player Controls</Heading>
        </HStack>
        <div className="layout-picker-grid">
          {PLAYER_STYLES.map((ps) => {
            const isSelected = prefs.player === ps.id;
            return (
              <button
                type="button"
                key={ps.id}
                className={`choice-card ${isSelected ? 'active' : ''}`}
                onClick={() => update({ player: ps.id })}
                aria-pressed={isSelected}
              >
                <div className="choice-card-top">
                  <span className="card-category-pill">{ps.badge}</span>
                  {isSelected && <Check size={16} className="check-icon" />}
                </div>
                <span className="choice-title">{ps.name}</span>
                <span className="choice-desc">{ps.description}</span>
              </button>
            );
          })}
        </div>
      </VStack>

      <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap" className="appearance-actions">
        <Button
          variant="secondary"
          label="Reset defaults"
          icon={<Icon icon={RotateCcw} />}
          onClick={handleReset}
        />
      </HStack>
    </VStack>
  );
}

export function AppearanceSettings({
  isOpen,
  currentPreferences,
  onApply,
  onClose
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width="50rem"
      maxHeight="90dvh"
      padding={4}
    >
      <DialogHeader
        title="Appearance & Themes"
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />
      <div className="dialog-scroll appearance-dialog-body">
        <AppearanceContent
          currentPreferences={currentPreferences}
          onApply={onApply}
        />
        <div className="appearance-modal-footer">
          <Button variant="primary" label="Done" onClick={onClose} />
        </div>
      </div>
    </Dialog>
  );
}
