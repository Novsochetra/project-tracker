import styles from './Markdown.module.css';
import { InlineContent } from './MarkdownInline';
import type { Align, Block, Inline } from './types';

type TableBlock = Extract<Block, { kind: 'table' }>;

const alignStyle = (align: Align | undefined) => (align ? { textAlign: align } : undefined);

function Row({ cells, align, head }: { cells: Inline[][]; align: Align[]; head?: boolean }) {
  return (
    <tr>
      {cells.map((cell, index) =>
        head ? (
          <th key={index} scope="col" style={alignStyle(align[index])}>
            <InlineContent content={cell} />
          </th>
        ) : (
          <td key={index} style={alignStyle(align[index])}>
            <InlineContent content={cell} />
          </td>
        ),
      )}
    </tr>
  );
}

// The box scrolls sideways when the table is wider than the answer; the page never does.
export function MarkdownTable({ block }: { block: TableBlock }) {
  return (
    <div className={styles.scrollBox}>
      <table className={styles.table}>
        <thead>
          <Row cells={block.head} align={block.align} head />
        </thead>
        <tbody>
          {block.rows.map((row, index) => (
            <Row key={index} cells={row} align={block.align} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
