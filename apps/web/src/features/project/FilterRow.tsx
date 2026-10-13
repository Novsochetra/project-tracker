import { filterTabs, resolveFilter, type ProjectBoard } from '@tracker/shared';
import { SearchField } from '../../components/SearchField';
import { Segmented, type SegmentedOption } from '../../components/Segmented';
import { LabelFilter } from './LabelFilter';
import {
  pickedLabel,
  setListFilter,
  setListLabel,
  setListQuery,
  useListView,
} from './listViewStore';
import styles from './ProjectScreen.module.css';
import { FilterTabs } from './tabs/FilterTabs';
import { setViewMode, useViewMode, type ViewMode } from './viewModeStore';

export interface FilterRowProps {
  board: ProjectBoard;
}

const viewOptions: SegmentedOption<ViewMode>[] = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
];

export function FilterRow({ board }: FilterRowProps) {
  const { project, statuses, tickets, labels = [] } = board;
  const view = useListView(project.key);
  const { filter, query } = view;
  const viewMode = useViewMode(project.key);
  return (
    <div className={styles.filters}>
      <div className={styles.statusFilters}>
        <FilterTabs
          tabs={filterTabs(statuses, tickets)}
          value={resolveFilter(statuses, filter)}
          onChange={(next) => setListFilter(project.key, next)}
        />
        {labels.length > 0 && (
          <LabelFilter
            labels={labels}
            picked={pickedLabel(view, labels)}
            onChange={(label) => setListLabel(project.key, label)}
          />
        )}
      </div>
      <div className={styles.tools}>
        <SearchField
          aria-label="Search tickets"
          placeholder="Search tickets"
          value={query}
          onChange={(event) => setListQuery(project.key, event.currentTarget.value)}
        />
        <Segmented
          aria-label="Show tickets as"
          options={viewOptions}
          value={viewMode}
          onChange={(next) => setViewMode(project.key, next)}
          className={styles.viewSwitch}
        />
      </div>
    </div>
  );
}
