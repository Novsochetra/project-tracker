import { useMemo } from 'react';
import styles from './Markdown.module.css';
import { Blocks } from './MarkdownBlocks';
import { parseMarkdown } from './parseMarkdown';

// The answer becomes React elements and text only, never HTML, so markup in it shows as text.
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  if (blocks.length === 0) return null;
  return (
    <div className={`${styles.flow} ${styles.markdown} ${className}`}>
      <Blocks blocks={blocks} />
    </div>
  );
}
