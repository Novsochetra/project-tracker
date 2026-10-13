import type { CardSegment, ChatMessage, Runner, TicketCard } from '@tracker/shared';
import { Fragment, useState } from 'react';
import { cardsOf, cardTicketKey, offersCreateAll, pendingCards, type MessageCards } from './cards';
import { CreateAllButton } from './CreateAllButton';
import { MessageText } from './MessageText';
import { TicketCardView } from './TicketCardView';
import { useCreateAll } from './useCreateAll';

export interface CardThreadProps {
  chatId: string;
  message: ChatMessage;
  cards: MessageCards;
  helper: Runner | null;
}

const lastCardIndex = (segments: readonly CardSegment[]) => cardsOf(segments).length - 1;

// The message keeps each card's fields, so Create all sends what the person changed in any of them.
export function CardThread({ chatId, message, cards, helper }: CardThreadProps) {
  const [drafts, setDrafts] = useState(() => cardsOf(cards.segments));
  const createAll = useCreateAll(chatId, message.id);
  const pending = pendingCards(message, drafts);
  const last = lastCardIndex(cards.segments);
  const edit = (index: number) => (patch: Partial<TicketCard>) =>
    setDrafts((shown) => shown.map((card, at) => (at === index ? { ...card, ...patch } : card)));
  const cardView = (index: number, card: TicketCard) => {
    const ticketKey = cardTicketKey(message, index);
    return (
      <TicketCardView
        chatId={chatId}
        messageId={message.id}
        index={index}
        card={card}
        fields={drafts[index] ?? card}
        onEdit={edit(index)}
        creatingAll={createAll.busy}
        ticketKey={ticketKey}
        replaced={!cards.latest && ticketKey === null}
        helper={helper}
      />
    );
  };
  return (
    <>
      {cards.segments.map((segment, at) =>
        segment.kind === 'text' ? (
          <MessageText key={at} text={segment.text} />
        ) : (
          <Fragment key={at}>
            {cardView(segment.index, segment.card)}
            {segment.index === last && offersCreateAll(cards, pending) && (
              <CreateAllButton pending={pending} createAll={createAll} />
            )}
          </Fragment>
        ),
      )}
    </>
  );
}
