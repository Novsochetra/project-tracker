import { TICKET_TITLE_MAX, type Priority, type TicketCard } from '@tracker/shared';
import clsx from 'clsx';
import { Plus, Ticket } from 'lucide-react';
import type { MouseEvent } from 'react';
import { errorMessage } from '../../api';
import { useCreateCardTicket } from '../../api/hooks/chats';
import { AutoTextarea, Button, GroupedCard, Icon, SelectRow, TitleField } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { PRIORITY_OPTIONS } from '../project/fieldOptions';
import { canCreate, cardInput } from './cards';
import styles from './TicketCard.module.css';

export interface CardEditorProps {
  chatId: string;
  messageId: string;
  index: number;
  // Kept by the message, so Create all sends the cards as the person left them.
  fields: TicketCard;
  onEdit: (patch: Partial<TicketCard>) => void;
  creatingAll: boolean;
}

export function CardEditor({
  chatId,
  messageId,
  index,
  fields,
  onEdit,
  creatingAll,
}: CardEditorProps) {
  const create = useCreateCardTicket();
  const pending = create.isPending || creatingAll;
  const submit = () => {
    if (!canCreate(fields) || pending) return;
    create.mutate({ chatId, messageId, input: cardInput({ index, card: fields }) });
  };
  // Run takes Create's place once the ticket is made, and must not take a double tap's second tap.
  const onCreate = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) holdPresses(event.currentTarget);
    submit();
  };
  return (
    <section className={styles.card} aria-label="Ticket card">
      <div className={styles.head}>
        <Icon icon={Ticket} size={14} />
        New ticket
      </div>
      <TitleField
        aria-label="Ticket title"
        placeholder="Ticket title"
        className={styles.title}
        maxLength={TICKET_TITLE_MAX}
        value={fields.title}
        onChange={(title) => onEdit({ title })}
        onEnter={submit}
      />
      <GroupedCard className={styles.details}>
        <SelectRow<Priority>
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={fields.priority}
          onChange={(priority) => onEdit({ priority })}
        />
      </GroupedCard>
      <AutoTextarea
        aria-label="Description"
        placeholder="Add details, steps or acceptance criteria…"
        className={styles.description}
        rows={3}
        value={fields.description}
        onChange={(event) => onEdit({ description: event.currentTarget.value })}
      />
      {create.error && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {errorMessage(create.error)}
        </p>
      )}
      <Button
        variant="primary"
        size="lg"
        icon={Plus}
        className={styles.action}
        disabled={!canCreate(fields) || pending}
        onClick={onCreate}
      >
        Create
      </Button>
    </section>
  );
}
