import type { ReactNode } from 'react';
import { Fold } from '../../../components';
import { useIsPhone } from '../../../lib/media';

// Long comments, reports and reviews fold on phones, where a few of them filled many screens and
// pushed the comment box far down (docs/architecture.md §1.7). Desktop shows them whole.
export function PhoneFold({ children }: { children: ReactNode }) {
  return <Fold enabled={useIsPhone()}>{children}</Fold>;
}
