import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../components';
import type { RefusedFile } from './attachmentFiles';
import {
  NO_NOTICES,
  refusalNotice,
  withFailure,
  type FileNotice,
  type Notices,
} from './fileNotice';
import { uploadFailureReason } from './uploadFailure';

export interface FileNotices {
  notices: Notices;
  picked: (refused: readonly RefusedFile[]) => void;
  failed: (name: string, error: unknown) => void;
  // One note, or both, as when a comment is sent.
  dismiss: (problem?: FileNotice['problem']) => void;
}

// A toast is gone too soon, and on a phone cut too short, to say why a file didn't go, so the
// picker area says it until the next pick or a dismiss.
export function useFileNotice(): FileNotices {
  const [notices, setNotices] = useState(NO_NOTICES);
  const { show } = useToast();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return {
    notices,
    picked: (refused) => setNotices({ refused: refusalNotice(refused), failed: null }),
    failed: (name, error) => {
      // A ticket's files keep going after its screen closes, so only a toast can tell then.
      if (!mounted.current) show(`${name} didn't upload.`, { kind: 'error' });
      else
        setNotices((current) => ({
          ...current,
          failed: withFailure(current.failed, name, uploadFailureReason(error)),
        }));
    },
    dismiss: (problem) =>
      setNotices((current) => (problem ? { ...current, [problem]: null } : NO_NOTICES)),
  };
}
