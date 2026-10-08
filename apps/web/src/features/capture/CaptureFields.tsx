import clsx from 'clsx';
import type { ClipboardEvent, RefObject } from 'react';
import { AutoTextarea, GroupedCard, SelectRow, TitleField } from '../../components';
import { pasteFiles } from '../attachments';
import { TITLE_MAX_LENGTH } from '../project/newTicketForm';
import { DESCRIPTION_MAX_LENGTH, NO_PROJECTS, type CaptureValues } from './captureForm';
import { PRIORITY_OPTIONS, projectOptions } from './captureOptions';
import styles from './CaptureSheet.module.css';
import type { CaptureProject } from './useCaptureProject';

export interface CaptureTextProps {
  values: CaptureValues;
  titleRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (patch: Partial<CaptureValues>) => void;
  onEnter: () => void;
  onFiles: (files: File[]) => void;
}

export function CaptureText({ values, titleRef, onChange, onEnter, onFiles }: CaptureTextProps) {
  const onPaste = (event: ClipboardEvent<HTMLElement>) => pasteFiles(event, onFiles);
  return (
    <div className={styles.text}>
      <TitleField
        ref={titleRef}
        aria-label="Ticket title"
        placeholder="Ticket title"
        maxLength={TITLE_MAX_LENGTH}
        value={values.title}
        onChange={(title) => onChange({ title })}
        onEnter={onEnter}
        onPaste={onPaste}
      />
      <AutoTextarea
        className={styles.description}
        aria-label="Description"
        placeholder="Add details, steps or acceptance criteria…"
        rows={2}
        maxLength={DESCRIPTION_MAX_LENGTH}
        value={values.description}
        onChange={(event) => onChange({ description: event.currentTarget.value })}
        onPaste={onPaste}
      />
    </div>
  );
}

export interface CaptureDetailsProps {
  values: CaptureValues;
  project: CaptureProject;
  error: string;
  onChange: (patch: Partial<CaptureValues>) => void;
  onProject: (projectKey: string) => void;
}

export function CaptureDetails({
  values,
  project,
  error,
  onChange,
  onProject,
}: CaptureDetailsProps) {
  const noProjects = project.choices.length === 0;
  return (
    <div className={styles.details}>
      <GroupedCard>
        <SelectRow
          label="Project"
          options={projectOptions(project.choices)}
          value={project.current?.key ?? ''}
          disabled={noProjects}
          onChange={onProject}
        />
        <SelectRow
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={values.priority}
          onChange={(priority) => onChange({ priority })}
        />
      </GroupedCard>
      {noProjects && project.loaded && <p className={styles.hint}>{NO_PROJECTS}</p>}
      {error && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {error}
        </p>
      )}
    </div>
  );
}
