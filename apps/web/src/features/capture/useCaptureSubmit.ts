import type { Attachment, CreatedTicket, Ticket } from '@tracker/shared';
import { useRef, useState } from 'react';
import {
  useCreateTicket,
  useUpdateTicket,
  type CreateTicketVariables,
  type UpdateTicketVariables,
} from '../../api';
import { flashRows } from '../../app/flash';
import { useToast, type ToastApi } from '../../components';
import {
  addedToast,
  CAPTURE_TIMEOUT_MS,
  createdToast,
  createInputOf,
  FILES_NEED_CONNECTION,
  leftOutToast,
  SAVED_ON_PHONE,
  TITLE_REQUIRED,
  toQueuedCapture,
  type CaptureValues,
} from './captureForm';
import { rememberProject, type ProjectChoice } from './captureProjects';
import { addCapture, markCreated } from './captureQueue';
import type { CaptureIdentity } from './keptCapture';
import { updateQueue } from './queueStore';
import { trackSending } from './syncRunner';
import { sendCapture } from './sendCapture';
import { submitCapture, type SubmitDeps, type SubmitOutcome } from './submitCapture';

export interface CaptureSubmitInput {
  values: CaptureValues;
  project: ProjectChoice | undefined;
  attachments: readonly Attachment[];
  uploading: number;
  identity: () => CaptureIdentity;
  onDone: () => void;
}

export interface CaptureSubmit {
  submit: () => void;
  pending: boolean;
  canSubmit: boolean;
  error: string;
  clearError: () => void;
}

interface Writes {
  create: (variables: CreateTicketVariables) => Promise<CreatedTicket>;
  update: (variables: UpdateTicketVariables) => Promise<Ticket>;
}

function submitDeps({ create, update }: Writes, show: ToastApi['show']): SubmitDeps {
  return {
    create: ({ capture, attachmentIds }) =>
      sendCapture(capture, {
        create: () =>
          create({ projectKey: capture.projectKey, input: createInputOf(capture, attachmentIds) }),
        update: (ticketKey, input) => update({ ticketKey, input }),
      }),
    save: (capture) => updateQueue((queue) => addCapture(queue, capture)),
    track: trackSending,
    onLateResult: (capture, ticket) => {
      if (!ticket) return;
      updateQueue((queue) => markCreated(queue, capture.id));
      show(addedToast(1));
    },
    timeoutMs: CAPTURE_TIMEOUT_MS,
  };
}

function showCreated(show: ToastApi['show'], ticket: CreatedTicket): void {
  const leftOut = ticket.leftOutAttachmentIds?.length ?? 0;
  if (leftOut === 0) show(createdToast(ticket.key));
  else show(leftOutToast(ticket.key, leftOut), { kind: 'error' });
}

export function useCaptureSubmit(input: CaptureSubmitInput): CaptureSubmit {
  const { values, project, attachments, uploading, identity, onDone } = input;
  const { mutateAsync: create } = useCreateTicket();
  const { mutateAsync: update } = useUpdateTicket();
  const { show } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  // pending only updates on the next render; a second Enter can arrive before that.
  const busy = useRef(false);
  const titled = values.title.trim() !== '';
  const ready = titled && project !== undefined && uploading === 0;

  const finish = (outcome: SubmitOutcome, chosen: ProjectChoice) => {
    busy.current = false;
    setPending(false);
    if (outcome.kind === 'needsConnection' || outcome.kind === 'failed') {
      setError(outcome.kind === 'failed' ? outcome.message : FILES_NEED_CONNECTION);
      return;
    }
    rememberProject(chosen);
    if (outcome.kind === 'created') {
      flashRows([outcome.ticket.key]);
      showCreated(show, outcome.ticket);
    } else {
      show(SAVED_ON_PHONE);
    }
    onDone();
  };

  const submit = () => {
    if (!titled) {
      setError(TITLE_REQUIRED);
      return;
    }
    if (!project || uploading > 0 || busy.current) return;
    busy.current = true;
    setPending(true);
    const { clientId, sent } = identity();
    const capture = toQueuedCapture({
      id: clientId,
      projectKey: project.key,
      values,
      capturedAt: Date.now(),
      sent,
    });
    const draft = { capture, attachmentIds: attachments.map((attachment) => attachment.id) };
    void submitCapture(draft, submitDeps({ create, update }, show)).then((outcome) =>
      finish(outcome, project),
    );
  };

  return { submit, pending, canSubmit: ready && !pending, error, clearError: () => setError('') };
}
