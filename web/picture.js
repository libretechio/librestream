// Where the picture lands inside the stage, after object-fit and zoom.
// Subtitles and overlays anchor to this rect, not to the video element box.
export const FIT_CSS = { fit: 'contain', fill: 'cover', stretch: 'fill' };

export function pictureRect(stageW, stageH, videoW, videoH, fit = 'fit', zoom = 1) {
  if (!stageW || !stageH) return { left: 0, top: 0, width: 0, height: 0 };
  if (!videoW || !videoH) return { left: 0, top: 0, width: stageW, height: stageH };
  let width;
  let height;
  if (fit === 'stretch') {
    width = stageW;
    height = stageH;
  } else {
    const scale = fit === 'fill'
      ? Math.max(stageW / videoW, stageH / videoH)
      : Math.min(stageW / videoW, stageH / videoH);
    width = videoW * scale;
    height = videoH * scale;
  }
  width *= zoom;
  height *= zoom;
  const x = (stageW - width) / 2;
  const y = (stageH - height) / 2;
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  const right = Math.min(stageW, x + width);
  const bottom = Math.min(stageH, y + height);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
