import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../components';
import type { RefusedFile } from './attachmentFiles';
import { refusalNotice, withFailure, type FileNotice } from './fileNotice';
import { uploadFailureReason } from './uploadFailure';

export interface FileNotices {
  notice: FileNotice | null;
  picked: (refused: readonly RefusedFile[]) => void;
  failed: (name: string, error: unknown) => void;
  dismiss: () => void;
}

// A toast is gone too soon, and on a phone cut too short, to say why a file didn't go, so the
// picker area says it until the next pick or a dismiss.
export function useFileNotice(): FileNotices {
  const [notice, setNotice] = useState<FileNotice | null>(null);
  const { show } = useToast();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return {
    notice,
    picked: (refused) => setNotice(refusalNotice(refused)),
    failed: (name, error) => {
      // A ticket's files keep going after its screen closes, so only a toast can tell then.
      if (!mounted.current) show(`${name} didn't upload.`, { kind: 'error' });
      else setNotice((current) => withFailure(current, name, uploadFailureReason(error)));
    },
    dismiss: () => setNotice(null),
  };
}
