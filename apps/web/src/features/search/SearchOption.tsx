import { projectDisplayName, type ProjectSummary, type TicketSearchHit } from '@tracker/shared';
import clsx from 'clsx';
import { ColorMark, StatusGlyph } from '../../components';
import { highlightParts } from './highlight';
import type { PaletteItem } from './paletteItems';
import styles from './SearchPalette.module.css';

function Highlighted({ text, terms }: { text: string; terms: readonly string[] }) {
  return highlightParts(text, terms).map((part, index) =>
    part.hit ? (
      <mark key={index} className={styles.mark}>
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

function ProjectContent({ project, terms }: { project: ProjectSummary; terms: readonly string[] }) {
  return (
    <>
      <ColorMark className={styles.square} color={project.color} />
      <span className={styles.title}>
        <Highlighted text={projectDisplayName(project)} terms={terms} />
      </span>
      <span className={styles.meta}>{project.key}</span>
    </>
  );
}

function TicketContent({ hit, terms }: { hit: TicketSearchHit; terms: readonly string[] }) {
  return (
    <>
      <span className={styles.text}>
        {/* In the first line, so it stays level with the title when a snippet follows. */}
        <span className={styles.line}>
          <StatusGlyph
            category={hit.statusCategory}
            color={hit.statusColor}
            animated={false}
            className={styles.glyph}
          />
          <span className={styles.key}>{hit.key}</span>
          <span className={styles.title}>
            <Highlighted text={hit.title} terms={terms} />
          </span>
        </span>
        {hit.snippet && (
          <span className={styles.snippet}>
            <Highlighted text={hit.snippet} terms={terms} />
          </span>
        )}
      </span>
      <span className={styles.meta}>{hit.statusName}</span>
    </>
  );
}

export interface SearchOptionProps {
  item: PaletteItem;
  active: boolean;
  terms: readonly string[];
  onHover: () => void;
  onOpen: () => void;
}

// Pointer moves, not enters: a list scrolled under a still mouse by the arrow keys keeps the
// highlight where the keys put it.
export function SearchOption({ item, active, terms, onHover, onOpen }: SearchOptionProps) {
  return (
    <button
      type="button"
      id={item.id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      className={clsx(styles.option, active && styles.active)}
      onPointerMove={active ? undefined : onHover}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onOpen}
    >
      {item.kind === 'project' ? (
        <ProjectContent project={item.project} terms={terms} />
      ) : (
        <TicketContent hit={item.hit} terms={terms} />
      )}
    </button>
  );
}
