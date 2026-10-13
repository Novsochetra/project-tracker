import { Paperclip } from 'lucide-react';
import { useRef } from 'react';
import { IconButton } from '../../components';
import { FileInput } from '../attachments/FileInput';
import styles from './ChatScreen.module.css';

// The comment box's Attach files: on phones the photo library, the camera and Files.
export function AttachButton({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <IconButton
        aria-label="Attach files"
        icon={Paperclip}
        size="sm"
        className={styles.attach}
        onClick={() => inputRef.current?.click()}
      />
      <FileInput ref={inputRef} label="Attach files to question" onFiles={onFiles} />
    </>
  );
}
