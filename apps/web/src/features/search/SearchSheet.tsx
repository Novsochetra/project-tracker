import { useEffect, useRef } from 'react';
import { errorMessage } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { SearchField } from '../../components/SearchField';
import { useIsPhone } from '../../lib/media';
import { Sheet, SheetTextButton } from '../../overlays';
import styles from './SearchPalette.module.css';
import { SearchOption } from './SearchOption';
import { useSearchPalette } from './useSearchPalette';

const LIST_ID = 'search-results';

type Palette = ReturnType<typeof useSearchPalette>;

function StatusLine({ palette }: { palette: Palette }) {
  const { items, query, pending, text } = palette;
  if (items.length > 0) return null;
  if (query.isError && !query.data) {
    return (
      <p role="alert" className={styles.status}>
        {errorMessage(query.error)}
      </p>
    );
  }
  const label = pending ? 'Searching…' : text.trim() ? `No matches for “${text.trim()}”` : '';
  return label ? <p className={styles.status}>{label}</p> : null;
}

function Results({ palette }: { palette: Palette }) {
  const { activeId } = palette;
  // jsdom has no scrollIntoView.
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);
  return (
    <div id={LIST_ID} role="listbox" aria-label="Results" className={styles.results}>
      {palette.sections.map((section) => (
        <div key={section.label} role="group" aria-label={section.label}>
          <div className={styles.sectionLabel} aria-hidden="true">
            {section.label}
          </div>
          <div className={styles.options}>
            {section.items.map((item) => (
              <SearchOption
                key={item.id}
                item={item}
                active={item.id === activeId}
                terms={palette.terms}
                onHover={() => palette.setHighlight(palette.items.indexOf(item))}
                onOpen={() => palette.open(item)}
              />
            ))}
          </div>
        </div>
      ))}
      <StatusLine palette={palette} />
    </div>
  );
}

function KeyHints() {
  return (
    <p className={styles.hints} aria-hidden="true">
      <span>
        <kbd>↑</kbd>
        <kbd>↓</kbd> to move
      </span>
      <span>
        <kbd>↵</kbd> to open
      </span>
      <span>
        <kbd>esc</kbd> to close
      </span>
    </p>
  );
}

export function SearchSheet({ open, onClose }: SheetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const palette = useSearchPalette(onClose);
  const isPhone = useIsPhone();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Search"
      title="Search"
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
      initialFocusRef={inputRef}
    >
      <div className={styles.palette}>
        <div className={styles.field}>
          <SearchField
            ref={inputRef}
            className={styles.searchField}
            aria-label="Search projects and tickets"
            placeholder="Projects, ticket keys, titles, descriptions"
            role="combobox"
            aria-expanded="true"
            aria-controls={LIST_ID}
            aria-autocomplete="list"
            aria-activedescendant={palette.activeId}
            value={palette.text}
            onChange={palette.onChange}
            onKeyDown={palette.onKeyDown}
          />
        </div>
        <Results palette={palette} />
        {!isPhone && <KeyHints />}
      </div>
    </Sheet>
  );
}
