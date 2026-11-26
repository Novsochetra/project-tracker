import type { ReactNode } from 'react';
import { stack } from './demoStyles';

export function DemoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ border: '1px solid var(--line)', borderRadius: 12 }}>
      <h2 style={{ margin: 0, padding: '14px 20px', font: 'var(--text-headline)' }}>{title}</h2>
      <div style={{ ...stack, padding: '24px 20px', background: 'var(--panel)', borderRadius: 12 }}>
        {children}
      </div>
    </section>
  );
}
