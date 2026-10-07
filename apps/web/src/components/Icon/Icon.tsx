import type { LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';

export type IconSize = 14 | 16 | 20;

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  className?: string | undefined;
  style?: CSSProperties;
}

export function Icon({ icon: Glyph, size = 16, className, style }: IconProps) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    />
  );
}
