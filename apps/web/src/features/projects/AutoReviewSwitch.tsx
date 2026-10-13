import clsx from 'clsx';
import { AUTO_REVIEW_ROUNDS } from '@tracker/shared';
import { useId } from 'react';
import { GroupedCard } from '../../components';
import { Switch } from '../../components/Switch';
import styles from './ProjectSheet.module.css';
import type { ProjectForm } from './useProjectForm';

export const AUTO_REVIEW_HINT = `When Claude finishes a ticket, Claude reviews it on the same computer. Changes it asks for go back to Claude, up to ${AUTO_REVIEW_ROUNDS} rounds.`;

export function AutoReviewSwitch({ form: { values, setAutoReview } }: { form: ProjectForm }) {
  const hintId = useId();
  return (
    <>
      <GroupedCard>
        <div className={clsx('ring-inside', styles.switchRow)}>
          <span className={styles.switchLabel}>Review automatically</span>
          <Switch
            checked={values.autoReview}
            onChange={setAutoReview}
            aria-label="Review automatically"
            aria-describedby={hintId}
          />
        </div>
      </GroupedCard>
      <p id={hintId} className={styles.hint}>
        {AUTO_REVIEW_HINT}
      </p>
    </>
  );
}
