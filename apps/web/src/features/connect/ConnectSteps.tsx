import { DEFAULT_STATUSES, type StatusCategory } from '@tracker/shared';
import type { ReactNode } from 'react';
import { GroupedCard, StatusGlyph } from '../../components';
import styles from './ConnectSheet.module.css';

const colorOf = (category: StatusCategory): string =>
  DEFAULT_STATUSES.find((status) => status.category === category)?.color ?? '';

const Actor = ({ children }: { children: ReactNode }) => (
  <span className={styles.actor}>{children}</span>
);

const Status = ({ children }: { children: ReactNode }) => (
  <span className={styles.status}>{children}</span>
);

const STEPS: { category: StatusCategory; text: ReactNode }[] = [
  {
    category: 'in_progress',
    text: (
      <>
        <Actor>Workers</Actor> claim a ticket, work on it and submit it. It moves to{' '}
        <Status>Need review</Status>.
      </>
    ),
  },
  {
    category: 'in_review',
    text: (
      <>
        <Actor>Reviewers</Actor> check the work against the ticket and rate it 1–5. They approve it
        to <Status>Reviewed</Status> or send it back to <Status>To do</Status>.
      </>
    ),
  },
  {
    category: 'done',
    text: (
      <>
        <Actor>You</Actor> move reviewed work to <Status>Done</Status>. Agents never can.
      </>
    ),
  },
];

export function ConnectSteps() {
  return (
    <GroupedCard>
      <ol className={styles.steps}>
        {STEPS.map((step) => (
          <li key={step.category} className={styles.step}>
            <span className={styles.stepGlyph}>
              <StatusGlyph
                category={step.category}
                color={colorOf(step.category)}
                animated={false}
              />
            </span>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
    </GroupedCard>
  );
}
