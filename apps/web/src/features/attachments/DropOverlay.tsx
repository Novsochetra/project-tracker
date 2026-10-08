import clsx from 'clsx';
import { ImagePlus } from 'lucide-react';
import { Icon } from '../../components';
import styles from './DropOverlay.module.css';

export interface DropOverlayProps {
  label?: string;
  className?: string | undefined;
}

export function DropOverlay({ label = 'Drop images to attach', className }: DropOverlayProps) {
  return (
    <div className={clsx(styles.overlay, className)} aria-hidden="true">
      <Icon icon={ImagePlus} size={20} />
      <span>{label}</span>
    </div>
  );
}
