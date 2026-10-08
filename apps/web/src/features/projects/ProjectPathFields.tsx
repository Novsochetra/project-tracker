import { Folder, Hash } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { GroupedCard, Icon, InputRow } from '../../components';
import { prefixPlaceholder, type ProjectFormMode } from './projectForm';
import styles from './ProjectSheet.module.css';
import type { ProjectForm } from './useProjectForm';

interface ProjectPathFieldsProps {
  mode: ProjectFormMode;
  form: ProjectForm;
  onEnter: (event: KeyboardEvent<HTMLInputElement>) => void;
}

const CODE_INPUT = { mono: true, autoCorrect: 'off', spellCheck: false } as const;

/** Repository, plus the ticket prefix when creating: it can't change later. */
export function ProjectPathFields({
  mode,
  form: { values, setField },
  onEnter,
}: ProjectPathFieldsProps) {
  return (
    <GroupedCard>
      <InputRow
        {...CODE_INPUT}
        icon={<Icon icon={Folder} className={styles.fieldIcon} />}
        label="Repository"
        aria-label="Repository or folder"
        placeholder="~/code/my-app"
        autoCapitalize="none"
        value={values.repo}
        onChange={(event) => setField('repo', event.currentTarget.value)}
        onKeyDown={onEnter}
      />
      {mode === 'new' && (
        <InputRow
          {...CODE_INPUT}
          icon={<Icon icon={Hash} className={styles.fieldIcon} />}
          label="Ticket prefix"
          className={styles.prefix}
          placeholder={prefixPlaceholder(values)}
          autoCapitalize="characters"
          value={values.prefix}
          onChange={(event) => setField('prefix', event.currentTarget.value)}
          onKeyDown={onEnter}
        />
      )}
    </GroupedCard>
  );
}
