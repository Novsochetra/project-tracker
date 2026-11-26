import { searchTerms } from '@tracker/shared';
import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { usePrefetchBoard, useProjects } from '../../api';
import { projectKeyOf } from '../../app/crumbs';
import { routePath, useNavigation, type Route } from '../../navigation';
import { keyRoute, paletteItems, paletteSections, type PaletteItem } from './paletteItems';
import { paletteAction, stepIndex } from './paletteKeys';
import { isApplePlatform } from './paletteShortcut';
import { useTicketSearch } from './useTicketSearch';

function useOpenRoute(onClose: () => void) {
  const { route, push } = useNavigation();
  const prefetchBoard = usePrefetchBoard();
  return (target: Route) => {
    onClose();
    if (routePath(target) === routePath(route)) return;
    if (target.name === 'project') prefetchBoard(target.key);
    push(target);
  };
}

function usePaletteList(text: string) {
  const { route } = useNavigation();
  const projects = useProjects().data;
  const { query, searched } = useTicketSearch(text);
  // While the field is first typed in or cleared, the tickets on hand are the other kind: recent
  // ones aren't matches, and matches aren't recent.
  const sameKind = (searched === '') === (text.trim() === '');
  const hits = sameKind ? query.data?.tickets : undefined;
  const currentProjectKey = projectKeyOf(route);
  const sections = useMemo(
    () =>
      paletteSections({
        projects: projects ?? [],
        hits: hits ?? [],
        query: text,
        currentProjectKey,
      }),
    [projects, hits, text, currentProjectKey],
  );
  // Results still for older text, or on their way for this text.
  const pending = searched !== text.trim() || query.isPlaceholderData || query.isPending;
  const direct = pending ? keyRoute(text, projects ?? []) : null;
  return { sections, items: paletteItems(sections), query, pending, direct };
}

// The options take no Tab stop, so Tab from the field would leave the sheet: it goes round to the
// sheet's first button instead.
function tabToStart(event: KeyboardEvent<HTMLInputElement>): boolean {
  if (event.key !== 'Tab' || event.shiftKey) return false;
  const first = event.currentTarget.closest('[role="dialog"]')?.querySelector('button');
  if (!first) return false;
  event.preventDefault();
  first.focus();
  return true;
}

// The highlight follows its item, not its place: a live refresh reorders recent tickets, and late
// results can land after the arrows moved, and Enter must open what is highlighted.
function useHighlight(items: readonly PaletteItem[]) {
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const kept = items.findIndex((item) => item.id === highlightId);
  const activeIndex = items.length === 0 ? -1 : Math.max(kept, 0);
  const step = (by: 1 | -1) =>
    setHighlightId(items[stepIndex(activeIndex, items.length, by)]?.id ?? null);
  return { activeIndex, activeItem: items[activeIndex], setHighlightId, step };
}

export function useSearchPalette(onClose: () => void) {
  const [text, setText] = useState('');
  const list = usePaletteList(text);
  const highlight = useHighlight(list.items);
  const openRoute = useOpenRoute(onClose);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    highlight.setHighlightId(null);
  };
  const openActive = () => {
    const target = list.direct ?? highlight.activeItem?.route;
    if (target) openRoute(target);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (tabToStart(event)) return;
    const action = paletteAction(event.nativeEvent, isApplePlatform());
    if (action === null) return;
    event.preventDefault();
    if (action === 'open') openActive();
    else highlight.step(action === 'next' ? 1 : -1);
  };
  return {
    text,
    terms: searchTerms(text),
    ...list,
    activeIndex: highlight.activeIndex,
    activeId: highlight.activeItem?.id,
    highlightItem: (item: PaletteItem) => highlight.setHighlightId(item.id),
    open: (item: PaletteItem) => openRoute(item.route),
    onChange,
    onKeyDown,
  };
}
