import clsx from 'clsx';
import { useId } from 'react';
import { GroupedCard } from '../../components';
import { Switch } from '../../components/Switch';
import type { ProjectSwitch } from './projectForm';
import { PROJECT_SWITCH_TEXT } from './projectSwitches';
import styles from './ProjectSheet.module.css';
import type { ProjectForm } from './useProjectForm';

interface ProjectSwitchFieldProps {
  form: ProjectForm;
  field: ProjectSwitch;
}

export function ProjectSwitchField({
  form: { values, setSwitch },
  field,
}: ProjectSwitchFieldProps) {
  const hintId = useId();
  const { label, hint } = PROJECT_SWITCH_TEXT[field];
  return (
    <>
      <GroupedCard>
        <div className={clsx('ring-inside', styles.switchRow)}>
          <span className={styles.switchLabel}>{label}</span>
          <Switch
            checked={values[field]}
            onChange={(on) => setSwitch(field, on)}
            aria-label={label}
            aria-describedby={hintId}
          />
        </div>
      </GroupedCard>
      <p id={hintId} className={styles.hint}>
        {hint}
      </p>
    </>
  );
}
