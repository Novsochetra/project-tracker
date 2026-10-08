import { useState } from 'react';
import { useToast } from '../../components';
import { copyText } from '../../lib/clipboard';
import { COMMAND_COPIED } from './connectCommand';

export function useCopyCommand() {
  const toast = useToast();
  const [blocked, setBlocked] = useState(false);
  const copy = async (command: string) => {
    const copied = await copyText(command);
    setBlocked(!copied);
    if (copied) toast.show(COMMAND_COPIED);
  };
  return { blocked, copy: (command: string) => void copy(command) };
}
