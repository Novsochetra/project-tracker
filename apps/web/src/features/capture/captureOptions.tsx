import { PRIORITIES, PRIORITY_LABELS, type Priority } from '@tracker/shared';
import { PriorityBars, type DropdownOption } from '../../components';
import type { ProjectChoice } from './captureProjects';
import styles from './CaptureSheet.module.css';

export const PRIORITY_OPTIONS: readonly DropdownOption<Priority>[] = PRIORITIES.map((priority) => ({
  value: priority,
  label: PRIORITY_LABELS[priority],
  icon: <PriorityBars priority={priority} />,
}));

export const projectOptions = (choices: readonly ProjectChoice[]): DropdownOption[] =>
  choices.map((choice) => ({
    value: choice.key,
    label: choice.name,
    icon: <span className={styles.square} style={{ background: choice.color }} />,
  }));
