import type { DiffFile, DiffLine } from '@tracker/shared';
import { Fragment, type ReactNode } from 'react';
import { BINARY_NOTE, NO_LINES_NOTE } from './copy';
import { lineAt, lineName, SIGNS, type LineAt } from './diffLines';
import styles from './DiffView.module.css';

export interface LineHandlers {
  onLineSelect?: ((at: LineAt) => void) | undefined;
  belowLine?: ((at: LineAt) => ReactNode) | undefined;
}

interface LineRowProps {
  line: DiffLine;
  onSelect?: ((at: LineAt) => void) | undefined;
}

function LineRow({ line, onSelect }: LineRowProps) {
  const content = (
    <>
      <span className={styles.number} aria-hidden="true">
        {line.oldLine ?? ''}
      </span>
      <span className={styles.number} aria-hidden="true">
        {line.newLine ?? ''}
      </span>
      <span className={styles.sign} aria-hidden="true">
        {SIGNS[line.kind]}
      </span>
      <span className="visually-hidden">{lineName(line)}</span>
      <span className={styles.code}>{line.text}</span>
    </>
  );
  if (!onSelect) {
    return (
      <div className={styles.line} data-kind={line.kind}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={styles.line}
      data-kind={line.kind}
      onClick={() => onSelect(lineAt(line))}
    >
      {content}
    </button>
  );
}

export function DiffHunks({ file, onLineSelect, belowLine }: { file: DiffFile } & LineHandlers) {
  if (file.binary) return <p className={styles.note}>{BINARY_NOTE}</p>;
  if (file.hunks.length === 0) return <p className={styles.note}>{NO_LINES_NOTE}</p>;
  return (
    <div className={styles.hunks}>
      {file.hunks.map((hunk, index) => (
        <div key={index} className={styles.hunk}>
          <div className={styles.hunkHeader}>{hunk.header}</div>
          {hunk.lines.map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              <LineRow line={line} onSelect={onLineSelect} />
              {belowLine?.(lineAt(line))}
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
