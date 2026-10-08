import clsx from 'clsx';
import type { ClipboardEvent, KeyboardEvent, RefObject } from 'react';
import { AutoTextarea, GroupedCard, SelectRow } from '../../components';
import { pasteImages } from '../attachments';
import {
  DESCRIPTION_MAX_LENGTH,
  NO_PROJECTS,
  TITLE_MAX_LENGTH,
  type CaptureValues,
} from './captureForm';
import { PRIORITY_OPTIONS, projectOptions } from './captureOptions';
import styles from './CaptureSheet.module.css';
import type { CaptureProject } from './useCaptureProject';

export interface CaptureTextProps {
  values: CaptureValues;
  titleRef: RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<CaptureValues>) => void;
  onEnter: () => void;
  onImages: (files: File[]) => void;
}

export function CaptureText({ values, titleRef, onChange, onEnter, onImages }: CaptureTextProps) {
  // Enter must reach the validation even while Create is disabled, which blocks implicit submit.
  const onTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onEnter();
  };
  const onPaste = (event: ClipboardEvent<HTMLElement>) => pasteImages(event, onImages);
  return (
    <div className={styles.text}>
      <input
        ref={titleRef}
        className={styles.title}
        aria-label="Ticket title"
        placeholder="Ticket title"
        enterKeyHint="done"
        maxLength={TITLE_MAX_LENGTH}
        value={values.title}
        onChange={(event) => onChange({ title: event.currentTarget.value })}
        onKeyDown={onTitleKeyDown}
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
