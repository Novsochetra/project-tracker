import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
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

function statusText({ items, pending, text }: Palette): string {
  if (items.length > 0) return '';
  if (pending) return 'Searching…';

  return text.trim() ? `No matches for “${text.trim()}”` : '';
}

// Outside the listbox, which may hold only options. Always there, so a screen reader hears it
// change.
function StatusLine({ palette }: { palette: Palette }) {
  const { query } = palette;
  if (palette.items.length === 0 && query.isError && !query.data) {
    return (
      <p role="alert" className={styles.status}>
        {errorMessage(query.error)}
      </p>
    );
  }

  return (
    <p role="status" className={styles.status}>
      {statusText(palette)}
    </p>
  );
}

function Results({ palette }: { palette: Palette }) {
  const { activeId } = palette;
  // jsdom has no scrollIntoView.
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  return (
    <div className={styles.results}>
      <div id={LIST_ID} role="listbox" aria-label="Results">
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
                  onHover={() => palette.highlightItem(item)}
                  onOpen={() => palette.open(item)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
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

// Shift-Tab from Close would land on the last result, which takes no Tab stop of its own.
function backToField(event: KeyboardEvent, field: RefObject<HTMLInputElement | null>) {
  if (event.key !== 'Tab' || !event.shiftKey || !field.current) return;
  event.preventDefault();
  field.current.focus();
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
      left={
        <SheetTextButton onClick={onClose} onKeyDown={(event) => backToField(event, inputRef)}>
          Close
        </SheetTextButton>
      }
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
