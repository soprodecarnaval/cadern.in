/**
 * The playback position: a yellow band across the staff, about two noteheads
 * wide. Multiplied over the page, so the notes under it stay black.
 */
export function PlaybackBand({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  const height = bottom - top;
  const width = height * 0.28;
  return (
    <div
      aria-hidden="true"
      data-testid="playback-cursor"
      style={{
        position: "absolute",
        left: x - width / 2,
        top,
        width,
        height,
        background: "var(--ds-yellow)",
        mixBlendMode: "multiply",
        opacity: 0.75,
        borderRadius: 2,
        pointerEvents: "none",
      }}
    />
  );
}
