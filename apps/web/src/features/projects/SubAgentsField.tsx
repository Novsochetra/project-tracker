import { MAX_SUB_AGENTS_MAX } from '@tracker/shared';
import { Network } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';
import { GroupedCard, Icon, InputRow } from '../../components';
import { SUB_AGENTS_HINT } from './projectForm';
import styles from './ProjectSheet.module.css';
import type { ProjectForm } from './useProjectForm';

interface SubAgentsFieldProps {
  form: ProjectForm;
  onEnter: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function SubAgentsField({ form: { values, setField }, onEnter }: SubAgentsFieldProps) {
  const hintId = useId();
  return (
    <>
      <GroupedCard>
        <InputRow
          icon={<Icon icon={Network} className={styles.fieldIcon} />}
          label="Sub agents per ticket"
          aria-label="Max sub agents per ticket"
          aria-describedby={hintId}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_SUB_AGENTS_MAX}
          value={values.maxSubAgents}
          onChange={(event) => setField('maxSubAgents', event.currentTarget.value)}
          onKeyDown={onEnter}
        />
      </GroupedCard>
      <p id={hintId} className={styles.hint}>
        {SUB_AGENTS_HINT}
      </p>
    </>
  );
}
