import { textRuns } from '../../../lib/textRuns';
import styles from './Markdown.module.css';
import { InlineContent } from './MarkdownInline';
import { MarkdownTable } from './MarkdownTable';
import type { Block } from './types';

type ListBlock = Extract<Block, { kind: 'list' }>;
type HeadingBlock = Extract<Block, { kind: 'heading' }>;

function List({ block }: { block: ListBlock }) {
  const items = block.items.map((item, index) => (
    <li key={index} className={styles.flow}>
      <Blocks blocks={item} />
    </li>
  ));
  return block.ordered ? (
    <ol className={styles.list} start={block.start}>
      {items}
    </ol>
  ) : (
    <ul className={styles.list}>{items}</ul>
  );
}

function Heading({ block }: { block: HeadingBlock }) {
  const Tag = `h${block.level}` as const;
  return (
    <Tag className={`${styles.heading} ${styles[Tag] ?? ''}`}>
      <InlineContent content={block.content} />
    </Tag>
  );
}

function BlockNode({ block }: { block: Block }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className={styles.paragraph}>
          <InlineContent content={block.content} />
        </p>
      );
    case 'heading':
      return <Heading block={block} />;
    case 'code':
      return (
        <pre className={`${styles.scrollBox} ${styles.code}`}>
          <code>{textRuns(block.text)}</code>
        </pre>
      );
    case 'list':
      return <List block={block} />;
    case 'quote':
      return (
        <blockquote className={`${styles.flow} ${styles.quote}`}>
          <Blocks blocks={block.blocks} />
        </blockquote>
      );
    case 'table':
      return <MarkdownTable block={block} />;
    case 'rule':
      return <hr className={styles.rule} />;
  }
}

export function Blocks({ blocks }: { blocks: readonly Block[] }) {
  return blocks.map((block, index) => <BlockNode key={index} block={block} />);
}
