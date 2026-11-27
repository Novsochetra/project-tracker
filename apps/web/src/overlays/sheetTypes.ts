import type { FormEvent, ReactNode, RefObject } from 'react';

export type SheetSize = 'form' | 'report' | 'wide';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  size?: SheetSize;
  // A plain white sheet, as iOS shows a search list or a document; others are grouped (gray).
  plain?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  // Set while the sheet holds unsaved input, so an accidental swipe or tap outside asks first.
  dirty?: boolean;
}
