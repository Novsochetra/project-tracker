import type { FilterCounts, TicketFilter } from '@tracker/shared';
import { SearchField, Segmented, type SegmentedOption } from '../../components';
import { setListFilter, setListQuery, useListView } from './listViewStore';
import styles from './ProjectScreen.module.css';
import { setViewMode, useViewMode, type ViewMode } from './viewModeStore';

export interface FilterRowProps {
  projectKey: string;
  counts: FilterCounts;
}

const filterOptions = (counts: FilterCounts): SegmentedOption<TicketFilter>[] => [
  { value: 'all', label: 'All', count: counts.all },
  { value: 'active', label: 'Active', count: counts.active },
  { value: 'done', label: 'Done', count: counts.done },
];

const viewOptions: SegmentedOption<ViewMode>[] = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
];

export function FilterRow({ projectKey, counts }: FilterRowProps) {
  const { filter, query } = useListView(projectKey);
  const viewMode = useViewMode(projectKey);
  return (
    <div className={styles.filters}>
      <Segmented
        aria-label="Filter tickets"
        options={filterOptions(counts)}
        value={filter}
        onChange={(next) => setListFilter(projectKey, next)}
      />
      <div className={styles.tools}>
        <SearchField
          aria-label="Search tickets"
          placeholder="Search tickets"
          value={query}
          onChange={(event) => setListQuery(projectKey, event.currentTarget.value)}
        />
        <Segmented
          aria-label="Show tickets as"
          options={viewOptions}
          value={viewMode}
          onChange={(next) => setViewMode(projectKey, next)}
          className={styles.viewSwitch}
        />
      </div>
    </div>
  );
}
