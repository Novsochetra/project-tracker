import { Sheet, SheetCancelButton } from '../../overlays';
import { LabelPicker } from './LabelPicker';
import { PICKER_LABEL } from './LabelMenu';
import type { LabelPickerInput } from './useLabelPicker';

export interface LabelSheetProps extends LabelPickerInput {
  open: boolean;
  onClose: () => void;
  subtitle?: string | undefined;
  onManage?: (() => void) | undefined;
}

// On a phone the labels are chips in a sheet, which a swipe down closes: a dropdown's rows were
// small for a thumb, and its field would sit under the keyboard.
export function LabelSheet({ open, onClose, subtitle, ...picker }: LabelSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={PICKER_LABEL}
      title="Labels"
      subtitle={subtitle}
      right={<SheetCancelButton>Done</SheetCancelButton>}
    >
      <LabelPicker layout="chips" {...picker} />
    </Sheet>
  );
}
