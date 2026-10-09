import { useState } from 'react';
import { useToast } from '../../components';
import { copyText } from '../../lib/clipboard';
import { COMMAND_COPIED, COMMAND_COPY_BLOCKED } from './connectCommand';

export interface CopyMessages {
  copied: string;
  blocked: string;
}

export const COMMAND_MESSAGES: CopyMessages = {
  copied: COMMAND_COPIED,
  blocked: COMMAND_COPY_BLOCKED,
};

export type CopyHandler = (text: string, messages?: CopyMessages) => void;

export function useCopyCommand() {
  const toast = useToast();
  const [blocked, setBlocked] = useState<string | null>(null);
  const copy = async (text: string, messages: CopyMessages) => {
    const copied = await copyText(text);
    setBlocked(copied ? null : messages.blocked);
    if (copied) toast.show(messages.copied);
  };
  const handler: CopyHandler = (text, messages = COMMAND_MESSAGES) => void copy(text, messages);
  return { blocked, copy: handler };
}
