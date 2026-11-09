import { useEffect, useRef, useState } from 'react';

// Subtitle files are untrusted input: allow inline emphasis only, never markup.
const ALLOWED = /&lt;(\/?)(i|b|u|em|strong)&gt;/gi;

function sanitizeLine(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(ALLOWED, '<$1$2>')
    .replace(/&lt;\/?[a-z][^&]*?&gt;/gi, '');
}

function cueLines(cue) {
  const raw = typeof cue?.text === 'string' ? cue.text : '';
  return raw
    .replace(/\r/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(sanitizeLine);
}

// Renders active cues over the visible picture, not over the video element box.
export function SubtitleLayer({ track, rect, bottomInset, size, scale }) {
  const [lines, setLines] = useState([]);
  const lastRef = useRef('');

  useEffect(() => {
    if (!track) {
      setLines([]);
      lastRef.current = '';
      return;
    }
    const read = () => {
      const cues = track.activeCues;
      const next = [];
      if (cues) {
        for (let index = 0; index < cues.length; index += 1) next.push(...cueLines(cues[index]));
      }
      const signature = next.join('\u0000');
      if (signature === lastRef.current) return;
      lastRef.current = signature;
      setLines(next);
    };
    track.addEventListener('cuechange', read);
    read();
    return () => {
      track.removeEventListener('cuechange', read);
      setLines([]);
      lastRef.current = '';
    };
  }, [track]);

  if (!rect || !lines.length) return null;

  // Size against the picture, not the window: letterboxed video has little height to spend.
  const base = Math.min(rect.height * 0.055, rect.width * 0.035);
  const fontSize = Math.min(Math.max(base, 13), 34) * scale;

  return (
    <div
      className="ls-sub-layer"
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      }}
      aria-live="off"
    >
      <div
        className="ls-sub-stack"
        style={{ bottom: `${Math.round(bottomInset)}px`, fontSize: `${fontSize.toFixed(1)}px` }}
      >
        {lines.map((line, index) => (
          <span
            key={index}
            className="ls-sub-line"
            dangerouslySetInnerHTML={{ __html: line }}
          />
        ))}
      </div>
    </div>
  );
}
