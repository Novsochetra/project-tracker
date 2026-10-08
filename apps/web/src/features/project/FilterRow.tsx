import type { FilterCounts, TicketFilter } from '@tracker/shared';
import { SearchField, Segmented, type SegmentedOption } from '../../components';
import { setListFilter, setListQuery, useListView } from './listViewStore';
import styles from './ProjectScreen.module.css';

export interface FilterRowProps {
  projectKey: string;
  counts: FilterCounts;
}

const filterOptions = (counts: FilterCounts): SegmentedOption<TicketFilter>[] => [
  { value: 'all', label: 'All', count: counts.all },
  { value: 'active', label: 'Active', count: counts.active },
  { value: 'done', label: 'Done', count: counts.done },
];

export function FilterRow({ projectKey, counts }: FilterRowProps) {
  const { filter, query } = useListView(projectKey);
  return (
    <div className={styles.filters}>
      <Segmented
        aria-label="Filter tickets"
        options={filterOptions(counts)}
        value={filter}
        onChange={(next) => setListFilter(projectKey, next)}
      />
      <SearchField
        aria-label="Search tickets"
        placeholder="Search tickets"
        value={query}
        onChange={(event) => setListQuery(projectKey, event.currentTarget.value)}
      />
    </div>
  );
}
