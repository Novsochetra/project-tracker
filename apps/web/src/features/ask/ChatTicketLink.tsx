import { formatTicketKey, type ChatDetail, type ChatTicket } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronRight, Ticket } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTicket } from '../../api';
import { Icon } from '../../components';
import { routePath, useNavigation } from '../../navigation';
import styles from './ChatTicketLink.module.css';
import { ticketRoute } from './ticketChat';

function TicketLink({ ticket }: { ticket: ChatTicket }) {
  const { push } = useNavigation();
  const route = ticketRoute(ticket.key);
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!route || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    push(route);
  };
  return (
    <a
      className={clsx(styles.link, 'press')}
      href={route ? routePath(route) : undefined}
      onClick={open}
    >
      <Icon icon={Ticket} size={16} className={styles.icon} />
      {/* The spaces keep the words apart in the link's name; a flex row doesn't show them. */}
      <span className="visually-hidden">About</span>{' '}
      <span className={styles.key}>{ticket.key}</span>{' '}
      <span className={styles.title}>{ticket.title}</span>
      <Icon icon={ChevronRight} size={16} className={styles.chevron} />
    </a>
  );
}

// A new chat has no ticket of its own yet: it shows the one its screen was opened from.
function OpeningTicket({ ticketKey }: { ticketKey: string }) {
  const title = useTicket(ticketKey).data?.ticket.title;
  return <TicketLink ticket={{ key: ticketKey, title: title ?? '' }} />;
}

export interface ChatTicketLinkProps {
  projectKey: string;
  detail: ChatDetail | null;
  ticketNum: number | undefined;
}

export function ChatTicketLink({ projectKey, detail, ticketNum }: ChatTicketLinkProps) {
  if (detail) return detail.chat.ticket && <TicketLink ticket={detail.chat.ticket} />;
  if (ticketNum === undefined) return null;
  return <OpeningTicket ticketKey={formatTicketKey(projectKey, ticketNum)} />;
}
