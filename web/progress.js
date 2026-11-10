export function resumePosition(meta, saved) {
  if (meta.resumePosition) return meta.resumePosition;
  return saved && saved.playbackId === meta.playbackId ? saved.position || 0 : 0;
}
