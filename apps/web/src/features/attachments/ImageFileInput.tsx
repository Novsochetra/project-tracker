import type { Ref } from 'react';

export interface ImageFileInputProps {
  label: string;
  onFiles: (files: File[]) => void;
  ref?: Ref<HTMLInputElement>;
}

export function ImageFileInput({ label, onFiles, ref }: ImageFileInputProps) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple
      hidden
      aria-label={label}
      onChange={(event) => {
        const input = event.currentTarget;
        const files = Array.from(input.files ?? []);
        // Cleared so picking the same photo again still fires a change.
        input.value = '';
        if (files.length > 0) onFiles(files);
      }}
    />
  );
}
