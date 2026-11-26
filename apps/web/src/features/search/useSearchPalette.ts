import { searchTerms } from '@tracker/shared';
import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { usePrefetchBoard, useProjects } from '../../api';
import { projectKeyOf } from '../../app/crumbs';
import { routePath, useNavigation, type Route } from '../../navigation';
import { keyRoute, paletteItems, paletteSections, type PaletteItem } from './paletteItems';
import { paletteAction, stepIndex } from './paletteKeys';
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
  return { sections, items: paletteItems(sections), query, pending };
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

export function useSearchPalette(onClose: () => void) {
  const [text, setText] = useState('');
  const [highlight, setHighlight] = useState(0);
  const list = usePaletteList(text);
  const openRoute = useOpenRoute(onClose);
  const count = list.items.length;
  const activeIndex = count === 0 ? -1 : Math.min(highlight, count - 1);
  const activeItem: PaletteItem | undefined = list.items[activeIndex];

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    setHighlight(0);
  };
  const openActive = () => {
    const direct = list.pending ? keyRoute(text) : null;
    const target = direct ?? activeItem?.route;
    if (target) openRoute(target);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (tabToStart(event)) return;
    const action = paletteAction(event.nativeEvent);
    if (action === null) return;
    event.preventDefault();
    if (action === 'open') openActive();
    else setHighlight(stepIndex(activeIndex, count, action === 'next' ? 1 : -1));
  };
  return {
    text,
    terms: searchTerms(text),
    ...list,
    activeIndex,
    activeId: activeItem?.id,
    setHighlight,
    open: (item: PaletteItem) => openRoute(item.route),
    onChange,
    onKeyDown,
  };
}
