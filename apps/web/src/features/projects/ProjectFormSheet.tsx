import clsx from 'clsx';
import { useRef, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import type { SheetProps } from '../../app/sheets/types';
import { AutoTextarea } from '../../components';
import { Sheet, SheetActionButton, SheetCancelButton } from '../../overlays';
import { hasName, projectHint, type ProjectFormMode } from './projectForm';
import { ProjectPathFields } from './ProjectPathFields';
import styles from './ProjectSheet.module.css';
import type { ProjectForm } from './useProjectForm';

interface ProjectFormSheetProps extends SheetProps {
  mode: ProjectFormMode;
  form: ProjectForm;
  pending: boolean;
  onSubmit: () => void;
  children?: ReactNode;
}

interface FieldsProps {
  form: ProjectForm;
  nameRef: RefObject<HTMLInputElement | null>;
  onEnter: (event: KeyboardEvent<HTMLInputElement>) => void;
}

const TEXT = {
  new: { title: 'New project', action: 'Create' },
  edit: { title: 'Edit project', action: 'Save' },
} as const;

function NameFields({ form: { values, setField }, nameRef, onEnter }: FieldsProps) {
  return (
    <div className={styles.fields}>
      <input
        ref={nameRef}
        className={styles.name}
        aria-label="Project name"
        placeholder="Project name"
        value={values.name}
        onChange={(event) => setField('name', event.currentTarget.value)}
        onKeyDown={onEnter}
      />
      <AutoTextarea
        className={styles.description}
        aria-label="Description"
        placeholder="What is this project about?"
        rows={2}
        value={values.description}
        onChange={(event) => setField('description', event.currentTarget.value)}
      />
    </div>
  );
}

export function ProjectFormSheet({
  mode,
  form,
  pending,
  onSubmit,
  children,
  ...sheet
}: ProjectFormSheetProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const named = hasName(form.values);
  // With Create disabled the browser ignores Enter, but a blank name should still explain itself.
  const explainBlankName = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || named) return;
    event.preventDefault();
    onSubmit();
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <Sheet
      {...sheet}
      label={TEXT[mode].title}
      title={TEXT[mode].title}
      left={<SheetCancelButton />}
      right={
        <SheetActionButton type="submit" disabled={!named || pending}>
          {TEXT[mode].action}
        </SheetActionButton>
      }
      initialFocusRef={nameRef}
      onSubmit={submit}
      dirty={form.changed}
    >
      <NameFields form={form} nameRef={nameRef} onEnter={explainBlankName} />
      <div className={styles.details}>
        <ProjectPathFields mode={mode} form={form} onEnter={explainBlankName} />
        <p className={styles.hint}>{projectHint(mode, form.values)}</p>
        {children}
        {form.error && (
          <p role="alert" className={clsx(styles.error, 'fade-in')}>
            {form.error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
