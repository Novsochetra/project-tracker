import type { Attachment, Ticket } from '@tracker/shared';
import { useRef, useState } from 'react';
import { useCreateTicket, type CreateTicketVariables } from '../../api';
import { flashRows } from '../../app/flash';
import { useToast, type ToastApi } from '../../components';
import {
  addedToast,
  CAPTURE_TIMEOUT_MS,
  createdToast,
  createInputOf,
  newCaptureId,
  PHOTOS_NEED_CONNECTION,
  SAVED_ON_PHONE,
  TITLE_REQUIRED,
  toQueuedCapture,
  type CaptureValues,
} from './captureForm';
import { rememberProject, type ProjectChoice } from './captureProjects';
import { addCapture, markCreated } from './captureQueue';
import { updateQueue } from './queueStore';
import { trackSending } from './syncRunner';
import { submitCapture, type SubmitDeps, type SubmitOutcome } from './submitCapture';

export interface CaptureSubmitInput {
  values: CaptureValues;
  project: ProjectChoice | undefined;
  photos: readonly Attachment[];
  uploading: number;
  onDone: () => void;
}

export interface CaptureSubmit {
  submit: () => void;
  pending: boolean;
  canSubmit: boolean;
  error: string;
  clearError: () => void;
}

function submitDeps(
  create: (variables: CreateTicketVariables) => Promise<Ticket>,
  show: ToastApi['show'],
): SubmitDeps {
  return {
    create: ({ capture, attachmentIds }) =>
      create({ projectKey: capture.projectKey, input: createInputOf(capture, attachmentIds) }),
    save: (capture) => updateQueue((queue) => addCapture(queue, capture)),
    track: trackSending,
    onLateResult: (capture, ticket) => {
      if (!ticket) return;
      updateQueue((queue) => markCreated(queue, capture.id));
      show(addedToast(1));
    },
    timeoutMs: CAPTURE_TIMEOUT_MS,
    isOffline: () => navigator.onLine === false,
  };
}

export function useCaptureSubmit(input: CaptureSubmitInput): CaptureSubmit {
  const { values, project, photos, uploading, onDone } = input;
  const { mutateAsync } = useCreateTicket();
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
      setError(outcome.kind === 'failed' ? outcome.message : PHOTOS_NEED_CONNECTION);
      return;
    }
    rememberProject(chosen);
    if (outcome.kind === 'created') flashRows([outcome.ticket.key]);
    show(outcome.kind === 'created' ? createdToast(outcome.ticket.key) : SAVED_ON_PHONE);
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
    const id = newCaptureId();
    const capture = toQueuedCapture({
      id,
      projectKey: project.key,
      values,
      capturedAt: Date.now(),
    });
    const draft = { capture, attachmentIds: photos.map((photo) => photo.id) };
    void submitCapture(draft, submitDeps(mutateAsync, show)).then((outcome) =>
      finish(outcome, project),
    );
  };

  return { submit, pending, canSubmit: ready && !pending, error, clearError: () => setError('') };
}
