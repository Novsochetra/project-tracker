import clsx from 'clsx';
import { PenLine } from 'lucide-react';
import { useId } from 'react';
import { AutoTextarea, GroupedCard, Icon } from '../../components';
import { INSTRUCTIONS_HINT } from './projectForm';
import styles from './ProjectSheet.module.css';
import type { ProjectForm } from './useProjectForm';

export function ProjectInstructionsField({ form: { values, setField } }: { form: ProjectForm }) {
  const id = useId();
  return (
    <>
      <GroupedCard>
        <div className={clsx('ring-inside', styles.instructions)}>
          <label htmlFor={id} className={styles.instructionsLabel}>
            <Icon icon={PenLine} className={styles.fieldIcon} />
            Instructions for Claude
          </label>
          <AutoTextarea
            id={id}
            className={styles.instructionsInput}
            placeholder="How to work on this project: the voice, the sources, what to check."
            rows={3}
            value={values.instructions}
            onChange={(event) => setField('instructions', event.currentTarget.value)}
          />
        </div>
      </GroupedCard>
      <p className={styles.hint}>{INSTRUCTIONS_HINT}</p>
    </>
  );
}
