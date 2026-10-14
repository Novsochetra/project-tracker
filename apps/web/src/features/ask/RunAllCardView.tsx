import type { ChatMessage, Runner } from '@tracker/shared';
import { ListChecks } from 'lucide-react';
import { Icon } from '../../components';
import { RUN_ALL_TITLE, type RunAllMessageCard } from './runAllCard';
import styles from './RunAllCard.module.css';
import { RunAllConfirm } from './RunAllConfirm';
import { RunAllProgress } from './RunAllProgress';

export interface RunAllCardViewProps {
  chatId: string;
  projectKey: string;
  message: ChatMessage;
  card: RunAllMessageCard;
  helper: Runner | null;
}

function ReplacedRunAll() {
  return (
    <section className={styles.replaced} aria-label="Replaced run all card">
      <Icon icon={ListChecks} size={14} />
      <span className={styles.replacedTitle}>{RUN_ALL_TITLE}</span>
      <span className={styles.replacedNote}>Replaced</span>
    </section>
  );
}

export function RunAllCardView({ chatId, projectKey, message, card, helper }: RunAllCardViewProps) {
  if (message.batchRunId) return <RunAllProgress runId={message.batchRunId} />;
  if (card.replaced) return <ReplacedRunAll />;
  return (
    <RunAllConfirm
      chatId={chatId}
      projectKey={projectKey}
      messageId={message.id}
      limit={card.split.limit}
      helper={helper}
    />
  );
}
