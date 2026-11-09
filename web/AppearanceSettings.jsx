import React, { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button, Modal, ModalHeader, Segmented } from './ui.jsx';
import { PALETTES, FONT_PRESETS } from './palettes.js';

const POSTER_SHAPES = [
  { id: 'poster', name: 'Portrait posters' },
  { id: 'landscape', name: 'Widescreen cards' }
];

const HOMEPAGE_LAYOUTS = [
  { id: 'premiere', name: 'Cinematic', badge: 'Default', description: 'Full-bleed hero with pager, then poster rails.' },
  { id: 'collection', name: 'Collection', badge: 'Dense', description: 'Compact hero, filter row, tighter shelves.' },
  { id: 'focus', name: 'Focus', badge: 'Minimal', description: 'Restrained banner, watch-first hierarchy.' }
];

const PLAYER_STYLES = [
  { id: 'compact', name: 'Floating deck', badge: 'Default', description: 'One glass card: timeline and transport.' },
  { id: 'edge', name: 'Edge deck', badge: 'Wide', description: 'Deck pinned to the bottom edge.' },
  { id: 'panel', name: 'Panel', badge: 'Compact', description: 'Minimal deck with a side panel for tracks.' }
];

export function AppearanceContent({ currentPreferences, onApply }) {
  const [prefs, setPrefs] = useState(currentPreferences);
  const activePalette = PALETTES.find((palette) => palette.id === prefs.palette) || PALETTES[0];
  const activeFont = FONT_PRESETS.find((font) => font.id === prefs.font) || FONT_PRESETS[0];

  const update = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    onApply(next);
  };

  return (
    <div className="ls-appearance">
      <div className="ls-theme-live">
        <div>
          <b>{activePalette.name} · {activeFont.name}</b>
          <span>{activePalette.description}</span>
        </div>
        <div className="ls-swatches">
          {activePalette.swatches.map((color) => (
            <i key={color} style={{ background: color }} />
          ))}
        </div>
      </div>

      <section>
        <h2 className="ls-section-title">Palette</h2>
        <div className="ls-option-grid">
          {PALETTES.map((palette) => {
            const isActive = prefs.palette === palette.id;
            return (
              <button
                key={palette.id}
                type="button"
                className={`ls-option ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => update({ palette: palette.id, accent: palette.accent })}
              >
                <span className="ls-option-badge">{palette.category}</span>
                <span className="ls-option-title">{palette.name}</span>
                <span className="ls-swatches">
                  {palette.swatches.map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
                <span className="ls-option-desc">{palette.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="ls-section-title">Typography</h2>
        <div className="ls-option-grid">
          {FONT_PRESETS.map((font) => {
            const isActive = prefs.font === font.id;
            return (
              <button
                key={font.id}
                type="button"
                className={`ls-option ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => update({ font: font.id })}
              >
                <span className="ls-option-badge">{font.badge}</span>
                <span className="ls-option-title" style={{ fontFamily: font.heading }}>{font.name}</span>
                <span className="ls-option-desc">{font.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="ls-section-title">Card shape</h2>
        <Segmented
          label="Card shape"
          value={prefs.posterShape || 'poster'}
          onChange={(value) => update({ posterShape: value })}
          options={POSTER_SHAPES.map((shape) => ({ value: shape.id, label: shape.name }))}
        />
      </section>

      <section>
        <h2 className="ls-section-title">Homepage</h2>
        <div className="ls-option-grid">
          {HOMEPAGE_LAYOUTS.map((layout) => {
            const isActive = prefs.layout === layout.id;
            return (
              <button
                key={layout.id}
                type="button"
                className={`ls-option ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => update({ layout: layout.id })}
              >
                <span className="ls-option-badge">{layout.badge}</span>
                <span className="ls-option-title">{layout.name}</span>
                <span className="ls-option-desc">{layout.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="ls-section-title">Player</h2>
        <div className="ls-option-grid">
          {PLAYER_STYLES.map((style) => {
            const isActive = prefs.player === style.id;
            return (
              <button
                key={style.id}
                type="button"
                className={`ls-option ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => update({ player: style.id })}
              >
                <span className="ls-option-badge">{style.badge}</span>
                <span className="ls-option-title">{style.name}</span>
                <span className="ls-option-desc">{style.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div>
        <Button
          variant="secondary"
          icon={<RotateCcw size={15} />}
          label="Reset to defaults"
          onClick={() => {
            const next = {
              ...prefs,
              palette: PALETTES[0].id,
              accent: PALETTES[0].accent,
              font: 'graphite',
              posterShape: 'poster',
              layout: 'premiere',
              player: 'compact'
            };
            setPrefs(next);
            onApply(next);
          }}
        />
      </div>
    </div>
  );
}

export function AppearanceSettings({ isOpen, currentPreferences, onApply, onClose }) {
  return (
    <Modal open={isOpen} onClose={onClose} wide labelledBy="appearance-title">
      <ModalHeader title="Appearance" id="appearance-title" onClose={onClose} />
      <div className="ls-modal-body">
        <AppearanceContent currentPreferences={currentPreferences} onApply={onApply} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" label="Done" onClick={onClose} />
        </div>
      </div>
    </Modal>
  );
}
