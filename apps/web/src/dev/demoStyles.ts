import type { CSSProperties } from 'react';

const css = (style: CSSProperties) => style;
export const row = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 });
export const stack = css({ display: 'flex', flexDirection: 'column', gap: 16 });
export const caption = css({ font: 'var(--text-caption)', color: 'var(--muted)' });
export const mono = css({ ...caption, fontFamily: 'var(--font-mono)', fontWeight: 400 });
export const clip = css({ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' });
export const square = css({ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)' });
export const head = css({
  ...row,
  minHeight: 40,
  padding: '0 8px 0 16px',
  background: 'var(--fill)',
});
export const paper = css({
  ...stack,
  gap: 8,
  padding: 16,
  borderRadius: 8,
  background: 'var(--surface)',
});
export const page = css({
  ...stack,
  gap: 24,
  maxWidth: 1120,
  margin: '0 auto',
  padding: '40px 16px',
});
export const columns = 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))';
export const grid = css({
  display: 'grid',
  gridTemplateColumns: columns,
  gap: 24,
  paddingBottom: 160,
});
export const titleText = css({
  font: 'var(--text-title)',
  letterSpacing: '-0.015em',
  padding: '4px 6px',
});
