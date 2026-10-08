import { findStatusByCategory, type Status } from '@tracker/shared';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { StatusGlyph } from '../../../components';
import cardStyles from './ActivityCard.module.css';
import { LinkedText } from './LinkedText';
import styles from './ReportBody.module.css';
import type { ReportSections } from './reportSections';

export interface ReportBodyProps {
  text: string;
  sections: ReportSections | null;
  statuses: readonly Status[];
}

export function ReportBody({ text, sections, statuses }: ReportBodyProps) {
  if (!sections) {
    return (
      <p className={cardStyles.reportBody}>
        <LinkedText text={text} />
      </p>
    );
  }
  return (
    <>
      {sections.status && <StatusLine status={sections.status} statuses={statuses} />}
      <SectionList sections={sections} />
    </>
  );
}

// Next comes before Files: it is the part meant for the owner, and file lists run long.
function SectionList({ sections: { summary, next, files } }: { sections: ReportSections }) {
  return (
    <dl className={styles.sections}>
      <Section label="Summary">
        <LinkedText text={summary} />
      </Section>
      {next && (
        <Section label="Next" className={styles.next}>
          <LinkedText text={next} />
        </Section>
      )}
      {files.length > 0 && (
        <Section label="Files">
          <ul className={styles.files}>
            {files.map((file, index) => (
              <li key={index}>
                <LinkedText text={file} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </dl>
  );
}

interface SectionProps {
  label: string;
  className?: string;
  children: ReactNode;
}

function Section({ label, className, children }: SectionProps) {
  return (
    <div className={clsx(styles.section, className)}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}

interface StatusLineProps {
  status: NonNullable<ReportSections['status']>;
  statuses: readonly Status[];
}

// Submissions say "STATUS: done" while the ticket waits for review, so that status reads as what
// it did. Other words stay as written.
function StatusLine({ status: { category, text }, statuses }: StatusLineProps) {
  const color = category ? findStatusByCategory(statuses, category)?.color : undefined;
  return (
    <p className={styles.status}>
      {category && color && (
        <StatusGlyph
          category={category}
          color={color}
          size={14}
          animated={false}
          className={styles.glyph}
        />
      )}
      {category === 'in_review' ? 'Submitted for review' : `Status: ${text}`}
    </p>
  );
}
