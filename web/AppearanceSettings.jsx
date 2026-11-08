import React, { useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Check, RotateCcw, Palette, Layout as LayoutIcon, PlaySquare } from 'lucide-react';
import {
  PALETTES,
  HOMEPAGE_LAYOUTS,
  PLAYER_STYLES,
  DEFAULT_PREFERENCES
} from './palettes';

export function AppearanceSettings({
  isOpen,
  currentPreferences,
  onApply,
  onClose
}) {
  const [draft, setDraft] = useState(currentPreferences || DEFAULT_PREFERENCES);

  const selectedPalette = PALETTES.find((p) => p.id === draft.palette) || PALETTES[0];

  const handleSelectPalette = (palette) => {
    const next = {
      ...draft,
      palette: palette.id,
      accent: palette.accent
    };
    setDraft(next);
    applyPreviewToDOM(next);
  };

  const handleSelectAccent = (color) => {
    const next = { ...draft, accent: color };
    setDraft(next);
    applyPreviewToDOM(next);
  };

  const handleSelectLayout = (layoutId) => {
    const next = { ...draft, layout: layoutId };
    setDraft(next);
    applyPreviewToDOM(next);
  };

  const handleSelectPlayer = (playerId) => {
    const next = { ...draft, player: playerId };
    setDraft(next);
    applyPreviewToDOM(next);
  };

  const applyPreviewToDOM = (prefs) => {
    document.documentElement.setAttribute('data-palette', prefs.palette);
    document.documentElement.style.setProperty('--ls-accent', prefs.accent);
  };

  const handleSave = () => {
    onApply(draft);
    onClose();
  };

  const handleCancel = () => {
    applyPreviewToDOM(currentPreferences);
    setDraft(currentPreferences);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_PREFERENCES);
    applyPreviewToDOM(DEFAULT_PREFERENCES);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleCancel();
      }}
      width="48rem"
      maxHeight="90dvh"
      padding={4}
    >
      <DialogHeader
        title="Appearance Settings"
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      />

      <VStack gap={5} className="dialog-scroll appearance-dialog-body">
        <Text color="secondary">
          Personalize your layout, video player controls, and colour theme. Your preferences are saved per profile.
        </Text>

        {/* Homepage Layout Picker */}
        <VStack gap={2}>
          <HStack gap={2} vAlign="center">
            <Icon icon={LayoutIcon} size="sm" />
            <Heading level={4}>Homepage Layout</Heading>
          </HStack>
          <div className="layout-picker-grid">
            {HOMEPAGE_LAYOUTS.map((l) => (
              <button
                type="button"
                key={l.id}
                className={`choice-card ${draft.layout === l.id ? 'active' : ''}`}
                onClick={() => handleSelectLayout(l.id)}
              >
                <HStack vAlign="center" hAlign="between" width="100%">
                  <span className="card-badge">{l.badge}</span>
                  {draft.layout === l.id && <Check size={18} className="check-icon" />}
                </HStack>
                <Heading level={4} className="choice-title">{l.name}</Heading>
                <Text type="supporting" color="secondary">{l.description}</Text>
              </button>
            ))}
          </div>
        </VStack>

        {/* Player Controls Picker */}
        <VStack gap={2}>
          <HStack gap={2} vAlign="center">
            <Icon icon={PlaySquare} size="sm" />
            <Heading level={4}>Player Controls Style</Heading>
          </HStack>
          <div className="layout-picker-grid">
            {PLAYER_STYLES.map((ps) => (
              <button
                type="button"
                key={ps.id}
                className={`choice-card ${draft.player === ps.id ? 'active' : ''}`}
                onClick={() => handleSelectPlayer(ps.id)}
              >
                <HStack vAlign="center" hAlign="between" width="100%">
                  <span className="card-badge">{ps.badge}</span>
                  {draft.player === ps.id && <Check size={18} className="check-icon" />}
                </HStack>
                <Heading level={4} className="choice-title">{ps.name}</Heading>
                <Text type="supporting" color="secondary">{ps.description}</Text>
              </button>
            ))}
          </div>
        </VStack>

        {/* Colour Palette Picker */}
        <VStack gap={2}>
          <HStack gap={2} vAlign="center">
            <Icon icon={Palette} size="sm" />
            <Heading level={4}>Colour Palette</Heading>
          </HStack>
          <div className="palette-picker-grid">
            {PALETTES.map((pal) => (
              <button
                type="button"
                key={pal.id}
                className={`choice-card palette-card ${draft.palette === pal.id ? 'active' : ''}`}
                onClick={() => handleSelectPalette(pal)}
              >
                <HStack vAlign="center" hAlign="between" width="100%">
                  <span className="choice-title">{pal.name}</span>
                  {draft.palette === pal.id && <Check size={18} className="check-icon" />}
                </HStack>
                <div className="swatch-strip">
                  {pal.swatches.map((color, idx) => (
                    <span key={idx} className="swatch-block" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <Text type="supporting" color="secondary">{pal.description}</Text>
              </button>
            ))}
          </div>
        </VStack>

        {/* Accent Color Picker for selected palette */}
        {selectedPalette.accents && (
          <VStack gap={2}>
            <Heading level={5}>Accent Colour</Heading>
            <HStack gap={3} vAlign="center" wrap="wrap">
              {selectedPalette.accents.map((acc) => (
                <button
                  type="button"
                  key={acc.id}
                  className={`accent-circle ${draft.accent === acc.color ? 'active' : ''}`}
                  style={{ backgroundColor: acc.color }}
                  title={acc.name}
                  onClick={() => handleSelectAccent(acc.color)}
                >
                  {draft.accent === acc.color && <Check size={16} />}
                </button>
              ))}
            </HStack>
          </VStack>
        )}

        {/* Actions bar */}
        <HStack gap={3} vAlign="center" hAlign="between" className="appearance-actions">
          <Button
            variant="ghost"
            label="Reset defaults"
            icon={<Icon icon={RotateCcw} />}
            onClick={handleReset}
          />
          <HStack gap={2}>
            <Button variant="ghost" label="Cancel" onClick={handleCancel} />
            <Button variant="primary" label="Apply appearance" onClick={handleSave} />
          </HStack>
        </HStack>
      </VStack>
    </Dialog>
  );
}
