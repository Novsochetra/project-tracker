import clsx from 'clsx';
import { useId } from 'react';
import { GroupedCard } from '../../components';
import { Switch } from '../../components/Switch';
import { AUTO_REVIEW_HINT } from './projectForm';
import styles from './ProjectSheet.module.css';
import type { ProjectForm } from './useProjectForm';

export function AutoReviewSwitch({ form: { values, setField } }: { form: ProjectForm }) {
  const hintId = useId();
  return (
    <>
      <GroupedCard>
        <div className={clsx('ring-inside', styles.switchRow)}>
          <span className={styles.switchLabel}>Review automatically</span>
          <Switch
            checked={values.autoReview}
            onChange={(checked) => setField('autoReview', checked)}
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
