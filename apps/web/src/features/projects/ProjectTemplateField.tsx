import { LayoutTemplate } from 'lucide-react';
import { GroupedCard, Icon, SelectRow } from '../../components';
import styles from './ProjectSheet.module.css';
import { TEMPLATE_OPTIONS, templateHint } from './projectTemplate';
import type { ProjectForm } from './useProjectForm';

export function ProjectTemplateField({ form: { values, pickTemplate } }: { form: ProjectForm }) {
  return (
    <>
      <GroupedCard>
        <SelectRow
          label="Template"
          icon={<Icon icon={LayoutTemplate} className={styles.fieldIcon} />}
          options={TEMPLATE_OPTIONS}
          value={values.template}
          onChange={pickTemplate}
        />
      </GroupedCard>
      <p className={styles.hint}>{templateHint(values.template)}</p>
    </>
  );
}
