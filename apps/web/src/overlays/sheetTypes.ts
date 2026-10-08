import type { FormEvent, ReactNode, RefObject } from 'react';

export type SheetSize = 'form' | 'prompt' | 'report';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  size?: SheetSize;
  children: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  // Set while the sheet holds unsaved input, so an accidental swipe or tap outside asks first.
  dirty?: boolean;
}
