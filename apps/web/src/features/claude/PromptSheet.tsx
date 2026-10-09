import { useState } from 'react';
import { useProject, useTicket } from '../../api';
import { useProjectPrompt, useTicketPrompt } from '../../api/hooks/prompts';
import type { PromptScope, SheetProps } from '../../app/sheets/types';
import { PromptView } from './PromptView';
import {
  joinSubtitle,
  movesOnSend,
  openTicketsLabel,
  sendTarget,
  showsSwitch,
  switchLabel,
} from './sendPrompt';
import { SendSwitch } from './SendSwitch';
import { useMarkSentOnce } from './useMarkSentOnce';
import { usePromptDraft } from './usePromptDraft';

export function PromptSheet({ open, onClose, scope }: SheetProps & { scope: PromptScope }) {
  return scope.kind === 'ticket' ? (
    <TicketPromptSheet open={open} onClose={onClose} ticketKey={scope.ticketKey} />
  ) : (
    <ProjectPromptSheet open={open} onClose={onClose} projectKey={scope.projectKey} />
  );
}

function TicketPromptSheet({ open, onClose, ticketKey }: SheetProps & { ticketKey: string }) {
  const query = useTicketPrompt(ticketKey, { enabled: open });
  const draft = usePromptDraft(query);
  const ticket = useTicket(ticketKey);
  const [switchOn, setSwitchOn] = useState(true);
  const { sent, mark, error } = useMarkSentOnce(ticketKey);
  const target = sendTarget(ticket.data);
  const key = ticket.data?.ticket.key ?? ticketKey;
  return (
    <PromptView
      open={open}
      onClose={onClose}
      subtitle={joinSubtitle(key, ticket.data?.project.name)}
      query={query}
      draft={draft}
      onSent={() => mark(movesOnSend(target, switchOn))}
      sendSwitch={
        target &&
        draft.result &&
        showsSwitch(target, sent) && (
          <SendSwitch label={switchLabel(key, target)} checked={switchOn} onChange={setSwitchOn} />
        )
      }
      sendError={error}
    />
  );
}

function ProjectPromptSheet({ open, onClose, projectKey }: SheetProps & { projectKey: string }) {
  const query = useProjectPrompt(projectKey, { enabled: open });
  const draft = usePromptDraft(query);
  const project = useProject(projectKey);
  const count = draft.result?.ticketCount;
  return (
    <PromptView
      open={open}
      onClose={onClose}
      subtitle={joinSubtitle(
        count === undefined ? undefined : openTicketsLabel(count),
        project.data?.project.name,
      )}
      query={query}
      draft={draft}
      onSent={() => undefined}
    />
  );
}
