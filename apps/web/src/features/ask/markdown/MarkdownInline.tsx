import { textRuns } from '../../../lib/textRuns';
import styles from './Markdown.module.css';
import type { Inline } from './types';

function InlineNode({ inline }: { inline: Inline }) {
  switch (inline.kind) {
    case 'text':
      return textRuns(inline.text);
    case 'code':
      return <code className={styles.inlineCode}>{textRuns(inline.text)}</code>;
    case 'link':
      return (
        <a href={inline.href} target="_blank" rel="noopener noreferrer">
          {textRuns(inline.text)}
        </a>
      );
    case 'strong':
      return (
        <strong className={styles.strong}>
          <InlineContent content={inline.children} />
        </strong>
      );
    case 'em':
      return (
        <em>
          <InlineContent content={inline.children} />
        </em>
      );
  }
}

export function InlineContent({ content }: { content: readonly Inline[] }) {
  return content.map((inline, index) => <InlineNode key={index} inline={inline} />);
}
