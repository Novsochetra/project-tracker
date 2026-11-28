import { useMarkColor } from '../../appearance';

export interface ColorMarkProps {
  color: string | undefined;
  className?: string | undefined;
}

// A project's color square, or any mark filled with a data color: drawn with markColor, so a
// dark color keeps 3:1 in the dark appearance. Its shape comes from the caller's class.
export function ColorMark({ color, className }: ColorMarkProps) {
  return (
    <span className={className} style={{ background: useMarkColor(color) }} aria-hidden="true" />
  );
}
