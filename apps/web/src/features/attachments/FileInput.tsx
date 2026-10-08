import { ATTACHMENT_ACCEPT } from '@tracker/shared';
import type { Ref } from 'react';

export interface FileInputProps {
  label: string;
  onFiles: (files: File[]) => void;
  ref?: Ref<HTMLInputElement>;
}

// Phones offer the photo library, the camera and their files for it.
export function FileInput({ label, onFiles, ref }: FileInputProps) {
  return (
    <input
      ref={ref}
      type="file"
      accept={ATTACHMENT_ACCEPT}
      multiple
      hidden
      aria-label={label}
      onChange={(event) => {
        const input = event.currentTarget;
        const files = Array.from(input.files ?? []);
        // Cleared so picking the same file again still fires a change.
        input.value = '';
        if (files.length > 0) onFiles(files);
      }}
    />
  );
}
