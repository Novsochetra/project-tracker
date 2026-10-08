import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';

function showPicker(input: HTMLInputElement) {
  try {
    input.showPicker();
  } catch {
    // Browsers without showPicker, or that refuse it here, still open their own picker.
  }
}

// Phones keep the system's date picker (docs/architecture.md §1.7): a date input covers its row
// or chip at opacity 0, so a tap anywhere on it opens the picker.
export const nativeDatePicker = (label: string, onChange: (value: string) => void) => ({
  type: 'date',
  'aria-label': label,
  onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
  onClick: (event: MouseEvent<HTMLInputElement>) => showPicker(event.currentTarget),
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== ' ') return;
    event.preventDefault();
    showPicker(event.currentTarget);
  },
});
